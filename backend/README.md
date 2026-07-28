# 국내 수입주류 대시보드 — 백엔드

관세청 품목별 수출입실적 Open API(`apis.data.go.kr/1220000/nitemtrade`)를 데이터 소스로
사용하는 FastAPI 백엔드. HS코드별로 전체 국가의 월별 수입실적을 받아 대구분/중구분을
붙인다(`customs_api.py`의 `HS_CLASSIFICATION`). `/api/raw`로 전체 원자료를 JSON으로
제공하면 `static/`의 프런트엔드가 클라이언트에서 자체 집계한다.

## 실행

```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

- `backend/.env`에 `CUSTOMS_API_KEY=...` 필요 (data.go.kr 공공데이터포털 인증키, 커밋 금지 — `.gitignore` 처리됨)
- 최초 기동 시 API 전체 수집(HS코드 39종 × 2018~현재, 약 350회 호출·수 분 소요) 후 `backend/.cache/`에 피클 캐시 생성 → 이후 즉시 로드
- 최신 데이터 갱신은 `POST /api/reload`로 캐시를 무시하고 전체 재수집
- Swagger 문서: http://127.0.0.1:8000/docs

## 환경변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `CUSTOMS_API_KEY` | (필수) | data.go.kr 공공데이터포털 인증키 |

## 데이터 규약

- 금액: **USD** (API `impDlr` 그대로), 중량: **kg** (API `impWgt` 그대로) — 환율 환산·단위 포맷팅은 프런트 담당
- `major`/`minor`: `customs_api.HS_CLASSIFICATION`의 대구분/중구분 (와인/맥주/위스키/와인(2L 이상) 등 17종)

## API

| 엔드포인트 | 설명 |
|---|---|
| `GET /api/health` | 상태 확인 (행 수, 데이터 소스) |
| `GET /api/raw` | 전체 주종 × 국가 × 월 원자료 — `전체 주류 대시보드`/`연도별 비교` 프런트가 자체 집계에 사용 |
| `POST /api/reload` | 캐시 무시하고 관세청 API 전체 재수집(수 분 소요) |

## 파일 구조

```
backend/
  main.py         # FastAPI 앱 + API 엔드포인트
  customs_api.py  # 관세청 API 수집 + HS코드 분류(HS_CLASSIFICATION)
  .env            # CUSTOMS_API_KEY (커밋 금지, .gitignore 처리됨)
  .cache/         # 수집 결과 피클 캐시 (자동 생성, 커밋 불필요)
  static/         # 프런트엔드 (전체 주류 대시보드, 연도별 비교)
```
