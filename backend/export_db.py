# -*- coding: utf-8 -*-
"""원본 캐시(customs_api.fetch_all())를 요청받은 14개 컬럼 그대로 엑셀로 뽑는다.

캐시를 그대로 읽을 뿐 API를 새로 호출하지 않는다 — 필드를 새로 반영해 재수집이
필요하면 `python -c "import customs_api as C; C.fetch_all(force=True)"`를 먼저
실행해야 한다.

실행: python export_db.py [출력경로.xlsx]  (기본: backend/data/customs_db_export.xlsx)
"""
import sys
from pathlib import Path

import pandas as pd

import customs_api as C

COLUMNS = ["YY", "MM", "Q", "기간", "국가", "HS코드", "품목명",
           "수출 중량", "수출 금액", "수입 중량", "수입 금액", "무역수지", "대구분", "재구분"]


def build_export_df(df: pd.DataFrame) -> pd.DataFrame:
    out = pd.DataFrame({
        "YY": df["year"],
        "MM": df["month"],
        "Q": (df["month"] - 1) // 3 + 1,
        "기간": df["year"].astype(str) + "-" + df["month"].astype(str).str.zfill(2),
        "국가": df["country"],
        "HS코드": df["hs"],
        "품목명": df["item"],
        "수출 중량": df["exp_volume"],
        "수출 금액": df["exp_value"],
        "수입 중량": df["volume"],
        "수입 금액": df["value"],
        "무역수지": df["balance"],
        "대구분": df["category"],
        "재구분": df["subcategory"],  # = 기존 중구분(레드/화이트/스파클링 등)
    })[COLUMNS]
    return out.sort_values(["YY", "MM", "HS코드", "국가"]).reset_index(drop=True)


def main():
    missing = [c for c in ("exp_volume", "exp_value", "balance") if c not in C.fetch_all().columns]
    if missing:
        raise SystemExit(
            f"캐시에 {missing} 컬럼이 없습니다 — 새 필드 반영 후 재수집이 아직 안 된 캐시입니다. "
            'python -c "import customs_api as C; C.fetch_all(force=True)" 먼저 실행하세요.'
        )

    out_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent / "data" / "customs_db_export.xlsx"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    df = C.fetch_all()  # 캐시 재사용, API 재호출 없음
    out = build_export_df(df)
    out.to_excel(out_path, index=False, sheet_name="raw")
    print(f"{len(out)}행 -> {out_path}")


if __name__ == "__main__":
    main()
