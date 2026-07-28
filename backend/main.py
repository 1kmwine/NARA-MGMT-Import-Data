# -*- coding: utf-8 -*-
"""국내 수입주류 대시보드 백엔드 (FastAPI).

관세청 품목별 수출입실적 Open API(nitemtrade)를 데이터 소스로 사용한다.
금액은 모두 USD, 중량은 kg으로 반환하며 환율/포맷팅은 프런트 담당.

실행:
    uvicorn main:app --reload --port 8000
"""
from contextlib import asynccontextmanager
from pathlib import Path

import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import customs_api as C

state: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    state["df"] = C.fetch_all()
    yield
    state.clear()


app = FastAPI(title="국내 수입주류 대시보드 API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def no_cache(request, call_next):
    """로컬 개발 중 정적 파일이 브라우저에 캐시되어 예전 버전이 보이는 걸 방지."""
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    return response


def df() -> pd.DataFrame:
    return state["df"]


@app.get("/api/health")
def health():
    return {"status": "ok", "rows": int(len(df())), "source": "관세청 품목별 수출입실적 API(nitemtrade)"}


@app.get("/api/raw")
def raw():
    """전체 주류(대구분 불문) 월별 국가×대구분×중구분 원자료.

    프런트 대시보드(전체 주류/연도별 비교)가 클라이언트에서 자체 집계할 수 있도록
    year/month/country/major/minor 단위로 합산한 tidy row를 그대로 반환한다.
    """
    g = (
        df()
        .groupby(["year", "month", "country", "category", "subcategory"])[["value", "volume"]]
        .sum()
        .reset_index()
    )
    g = g[(g["value"] > 0) | (g["volume"] > 0)]
    rows = [
        {
            "year": int(r.year),
            "month": int(r.month),
            "country": r.country,
            "major": r.category,
            "minor": r.subcategory,
            "value": float(r.value),
            "volume": float(r.volume),
        }
        for r in g.itertuples(index=False)
    ]
    return {"rows": rows}


@app.post("/api/reload")
def reload_data():
    """관세청 API에서 전체 데이터를 다시 받아온다(캐시 무시, 수 분 소요)."""
    state["df"] = C.fetch_all(force=True)
    return {"status": "reloaded", "rows": int(len(state["df"]))}


@app.post("/api/reload-recent-month")
def reload_recent_month(yymm: str | None = None):
    """전월(또는 지정 월, 예: 202606)만 다시 받아 병합한다. scheduled_update.py와 동일 로직."""
    state["df"] = C.update_recent_month(target_yymm=yymm)
    return {"status": "reloaded", "rows": int(len(state["df"]))}


# 정적 프런트엔드 (있을 때만 마운트)
static_dir = Path(__file__).resolve().parent / "static"
if static_dir.exists():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")
