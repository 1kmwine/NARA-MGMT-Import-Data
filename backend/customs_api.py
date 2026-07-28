# -*- coding: utf-8 -*-
"""관세청 품목별 수출입실적 Open API(nitemtrade) 수집.

https://apis.data.go.kr/1220000/nitemtrade/getNitemtradeList 에서 HS코드별로
전체 국가의 월별 수입실적을 받아, 지정된 대구분/중구분 분류를 붙인 tidy
DataFrame으로 만든다. (cntyCd를 비우면 전체 국가가 한 번에 반환된다.)
"""
import os
import time
import pickle
import hashlib
from pathlib import Path
from datetime import date, timedelta
from xml.etree import ElementTree as ET

import requests
import pandas as pd
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

CACHE_DIR = BASE_DIR / ".cache"
API_URL = "https://apis.data.go.kr/1220000/nitemtrade/getNitemtradeList"
START_YEAR = 2018

# (HS코드, 대구분, 중구분) — 겹치는 상위 코드(2205, 220300)로 하위 코드를 묶어서
# 조회하므로, 그 하위의 특정 코드(220510/220590/2203000000/2205100000/2205900000)는
# 중복 집계를 피하기 위해 목록에서 뺐다.
HS_CLASSIFICATION = [
    ("2202910000", "맥주", "논알콜 맥주"),
    ("2204100000", "와인", "스파클링 와인"),
    ("2204211000", "와인", "레드 와인"),
    ("2204212000", "와인", "화이트 와인"),
    ("2204219000", "와인", "기타 와인"),
    ("2204221000", "와인(2L 이상)", "레드 와인"),
    ("2204222000", "와인(2L 이상)", "화이트 와인"),
    ("2204229000", "와인(2L 이상)", "기타 와인"),
    ("2204291000", "와인(2L 이상)", "레드 와인"),
    ("2204292000", "와인(2L 이상)", "화이트 와인"),
    ("2204299000", "와인(2L 이상)", "기타 와인"),
    ("2205", "베르무트", "베르무트"),
    ("2206001010", "발효주", "사과 발효주"),
    ("2206001020", "발효주", "배 발효주"),
    ("2206001090", "발효주", "기타 발효주"),
    ("2206002010", "사케", "청주"),
    ("2206002020", "발효주", "약주"),
    ("2206002030", "발효주", "탁주"),
    ("2206002090", "발효주", "기타 발효주"),
    ("2206009010", "발효주", "기타 발효주"),
    ("2206009090", "발효주", "기타 발효주"),
    ("2208201000", "꼬냑", "꼬냑"),
    ("2208209000", "꼬냑", "꼬냑"),
    ("2208301000", "위스키", "스카치 위스키"),
    ("2208302000", "위스키", "버번 위스키"),
    ("2208303000", "위스키", "라이 위스키"),
    ("2208309000", "위스키", "기타 위스키"),
    ("2208400000", "럼", "럼"),
    ("2208500000", "진", "진"),
    ("2208600000", "보드카", "보드카"),
    ("2208701000", "리큐르", "인삼주"),
    ("2208702000", "리큐르", "오가피"),
    ("2208709000", "리큐르", "기타 리큐르"),
    ("2208901000", "브랜디", "브랜디"),
    ("2208904000", "소주", "소주"),
    ("2208906000", "고량주", "고량주"),
    ("2208907000", "데낄라", "데낄라"),
    ("2208909000", "기타", "기타 주류"),
    ("220300", "맥주", "맥주"),
]


def _service_key() -> str:
    key = os.environ.get("CUSTOMS_API_KEY")
    if not key:
        raise RuntimeError(
            "CUSTOMS_API_KEY 환경변수가 없습니다. backend/.env에 CUSTOMS_API_KEY=... 를 설정하세요."
        )
    return key


def _cache_path(end_year: int) -> Path:
    sig = f"{end_year}|{len(HS_CLASSIFICATION)}"
    h = hashlib.md5(sig.encode("utf-8")).hexdigest()[:16]
    return CACHE_DIR / f"customs_api_{h}.pkl"


def _fetch_one(session: requests.Session, service_key: str, hs_sgn: str, strt_yymm: str, end_yymm: str) -> list[dict]:
    params = {
        "serviceKey": service_key,
        "strtYymm": strt_yymm,
        "endYymm": end_yymm,
        "hsSgn": hs_sgn,
    }
    last_err = None
    for attempt in range(3):
        try:
            resp = session.get(API_URL, params=params, timeout=20)
            resp.raise_for_status()
            root = ET.fromstring(resp.content)
            break
        except Exception as e:  # 네트워크/파싱 오류는 짧게 재시도
            last_err = e
            time.sleep(1.0)
    else:
        raise RuntimeError(f"API 호출 실패(hs={hs_sgn}, {strt_yymm}~{end_yymm}): {last_err}")

    result_code = root.findtext("./header/resultCode")
    if result_code != "00":
        msg = root.findtext("./header/resultMsg")
        raise RuntimeError(f"API 오류(hs={hs_sgn}, {strt_yymm}~{end_yymm}): {result_code} {msg}")

    rows = []
    for item in root.findall("./body/items/item"):
        year_txt = item.findtext("year")
        if not year_txt or year_txt == "총계":
            continue
        rows.append(
            {
                "year_month": year_txt,
                "country": item.findtext("statCdCntnKor1"),
                "hs": item.findtext("hsCd"),
                "item": item.findtext("statKor"),
                "volume": item.findtext("impWgt"),
                "value": item.findtext("impDlr"),
            }
        )
    return rows


def _tag_rows(raw_rows: list[dict], category: str, subcategory: str) -> list[dict]:
    """_fetch_one()의 원시 결과에 대구분/중구분을 붙이고 타입을 정리한다.

    HS_CLASSIFICATION에 이미 각 코드의 대구분/중구분이 정해져 있으므로, 이 함수를
    거치는 모든 행은 수작업 없이 자동으로 분류된다.
    """
    tagged = []
    for r in raw_rows:
        y, m = r["year_month"].split(".")
        tagged.append(
            {
                "year": int(y),
                "month": int(m),
                "country": r["country"],
                "hs": r["hs"],
                "item": r["item"],
                "category": category,
                "subcategory": subcategory,
                "volume": float(r["volume"] or 0),
                "value": float(r["value"] or 0),
            }
        )
    return tagged


def _dedupe(df: pd.DataFrame, progress: bool = True) -> pd.DataFrame:
    """(year, month, country, hs) 기준 중복 행을 검토하고 제거한다.

    같은 키로 값이 다른 행이 남아있으면(예: 병합 과정에서 겹친 재조회) 가장 나중에
    받은 값을 신뢰해 그것만 남긴다. fetch_all()/update_recent_month()가 캐시에
    저장하기 직전에 항상 거친다.
    """
    before = len(df)
    dup_count = int(df.duplicated(subset=["year", "month", "country", "hs"], keep=False).sum())
    df = df.drop_duplicates(subset=["year", "month", "country", "hs"], keep="last").reset_index(drop=True)
    removed = before - len(df)
    if progress and dup_count:
        print(f"[customs_api] 중복 {dup_count}행 발견 → {removed}행 제거 (최신 값 유지)")
    return df


def fetch_all(end_year: int | None = None, force: bool = False, sleep_sec: float = 0.15, progress: bool = True) -> pd.DataFrame:
    """전체 HS코드 × 연도 구간을 순회하며 관세청 API에서 수입 데이터를 받아온다.

    columns: year(int), month(int), country(str), hs(str), item(str),
             category(대구분), subcategory(중구분), volume(kg, float), value(USD, float), ym(int)
    """
    end_year = end_year or date.today().year
    CACHE_DIR.mkdir(exist_ok=True)
    cache = _cache_path(end_year)
    if cache.exists() and not force:
        with open(cache, "rb") as f:
            return pickle.load(f)

    service_key = _service_key()
    rows: list[dict] = []
    total_calls = len(HS_CLASSIFICATION) * (end_year - START_YEAR + 1)
    done = 0
    with requests.Session() as session:
        for hs_sgn, category, subcategory in HS_CLASSIFICATION:
            for year in range(START_YEAR, end_year + 1):
                raw = _fetch_one(session, service_key, hs_sgn, f"{year}01", f"{year}12")
                rows.extend(_tag_rows(raw, category, subcategory))
                done += 1
                if progress and done % 10 == 0:
                    print(f"[customs_api] {done}/{total_calls} ({hs_sgn} {year})")
                time.sleep(sleep_sec)

    df = pd.DataFrame(rows)
    df["ym"] = df["year"] * 100 + df["month"]
    df = _dedupe(df, progress=progress)
    with open(cache, "wb") as f:
        pickle.dump(df, f)
    if progress:
        print(f"[customs_api] done: {len(df)} rows -> {cache}")
    return df


def default_target_yymm() -> str:
    """전월(YYYYMM)을 계산한다. 매월 15일 자동 갱신이 기본으로 대상으로 삼는 달."""
    first_of_this_month = date.today().replace(day=1)
    prev_month_day = first_of_this_month - timedelta(days=1)
    return f"{prev_month_day.year}{prev_month_day.month:02d}"


def update_recent_month(target_yymm: str | None = None, sleep_sec: float = 0.15, progress: bool = True) -> pd.DataFrame:
    """캐시에서 지정 월(기본: 전월) 데이터만 다시 받아 병합한다.

    HS코드별 대구분/중구분은 HS_CLASSIFICATION을 그대로 적용하므로 매달 수작업이
    필요 없다. 관세청 데이터가 매월 15일경 전월치로 갱신되는 주기에 맞춰 스케줄러
    (scheduled_update.py)가 이 함수를 호출한다.
    """
    target_yymm = target_yymm or default_target_yymm()

    cache = _cache_path(date.today().year)
    if not cache.exists():
        if progress:
            print("[customs_api] 캐시가 없어 전체를 새로 받습니다.")
        return fetch_all(force=True, progress=progress)

    with open(cache, "rb") as f:
        df = pickle.load(f)

    service_key = _service_key()
    rows: list[dict] = []
    with requests.Session() as session:
        for hs_sgn, category, subcategory in HS_CLASSIFICATION:
            raw = _fetch_one(session, service_key, hs_sgn, target_yymm, target_yymm)
            rows.extend(_tag_rows(raw, category, subcategory))
            time.sleep(sleep_sec)

    new_df = pd.DataFrame(rows)
    target_ym = int(target_yymm[:4]) * 100 + int(target_yymm[4:6])
    if len(new_df):
        new_df["ym"] = target_ym

    df = df[df["ym"] != target_ym]  # 기존 해당 월 데이터를 지우고(수정치 반영) 새로 붙인다
    df = pd.concat([df, new_df], ignore_index=True) if len(new_df) else df
    df = _dedupe(df, progress=progress)

    with open(cache, "wb") as f:
        pickle.dump(df, f)
    if progress:
        print(f"[customs_api] {target_yymm} 갱신: {len(new_df)}행 (전체 {len(df)}행)")
    return df
