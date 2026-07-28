# -*- coding: utf-8 -*-
"""매월 15일 전월 데이터 자동 갱신용 스크립트.

Windows 작업 스케줄러("LiquorDashboard_MonthlyUpdate")가 매월 15일 09:00에 이
스크립트를 실행하고, 그 뒤로 48시간 동안 2시간 간격으로 반복 실행되도록 등록돼
있다 — 실패하면(네트워크 문제, API 장애 등) 다음 2시간 뒤에 자동으로 재시도된다.
해당 월 갱신이 이미 성공했으면(.cache/scheduled_update_state.json) 재시도 없이
바로 건너뛴다. FastAPI 서버가 켜져 있지 않아도 동작하며, 캐시 파일을 직접 갱신한다.
"""
import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import customs_api as C

CACHE_DIR = Path(__file__).resolve().parent / ".cache"
LOG_PATH = CACHE_DIR / "scheduled_update.log"
STATE_PATH = CACHE_DIR / "scheduled_update_state.json"


def _log(message: str) -> None:
    CACHE_DIR.mkdir(exist_ok=True)
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(message + "\n")
    print(message)


def _read_state() -> dict:
    if STATE_PATH.exists():
        with open(STATE_PATH, encoding="utf-8") as f:
            return json.load(f)
    return {}


def _write_state(state: dict) -> None:
    with open(STATE_PATH, "w", encoding="utf-8") as f:
        json.dump(state, f)


def main() -> None:
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    target_yymm = C.default_target_yymm()
    state = _read_state()

    if state.get("last_success_yymm") == target_yymm:
        _log(f"{ts} SKIP {target_yymm} 이미 성공적으로 갱신됨")
        return

    try:
        df = C.update_recent_month(target_yymm=target_yymm)
        _write_state({"last_success_yymm": target_yymm, "updated_at": ts})
        _log(f"{ts} OK {target_yymm} rows={len(df)}")
    except Exception as e:
        _log(f"{ts} FAIL {target_yymm} {e}")


if __name__ == "__main__":
    main()
