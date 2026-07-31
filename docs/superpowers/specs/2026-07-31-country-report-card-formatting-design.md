# 국가별 수입금액 카드 — 라벨/기간 표시 정리

2026-07-31. `CountryReportCard`를 대시보드 상단 필터(연도/월/주종/중구분)에
연동시킨 직후 나온 후속 다듬기 3건. 범위 작고 컴포넌트 하나 + 공용 포맷
헬퍼 두 개로 끝나서 설계는 짧게 둔다.

## 1. 중구분 라벨에서 대구분 이름 중복 제거

`"레드 와인"`처럼 중구분 이름에 대구분(`"와인"`) 이름이 접두/접미로 붙어
있으면 잘라낸다 — 이미 상위 헤더에 대구분이 표시되므로 중복. 와인뿐 아니라
맥주(`"맥주"`/`"논알콜 맥주"`) 등 다른 대구분에도 동일 규칙 적용.

`frontend/app/lib/format.js`에 `shortMinorLabel(minor, major)` 추가:
접미 일치 우선 제거, 없으면 접두 제거, 결과가 빈 문자열이면(중구분 이름이
대구분과 완전히 같은 경우) 원본 그대로 둔다.

적용처(대시보드 전체):
- `CountryReportCard`의 표 헤더(`subItems` 라벨)
- `Dashboard`의 평균 수입단가 카드 세부 브레이크다운(`priceBreakdown`)
- 도넛차트 범례(`pieData` 라벨, 대구분이 특정 주종으로 좁혀졌을 때)

## 2. 선택 월 표시를 연속 구간으로 압축

지금은 선택한 월을 `"1월,2월,3월"`처럼 콤마 나열한다. 연속 구간은
`"1~5월"`로 묶고, 끊기면 `"1~5월 7~9월"`처럼 구간을 공백으로 이어붙인다.

`frontend/app/lib/format.js`에 `formatMonthRange(monthsNum)` 추가: 정렬 →
연속 구간으로 그룹핑 → 구간별로 `a~b월`(단일 월이면 `a월`) → 공백 조인.

적용처(대시보드 전체) — 둘 다 이미 같은 로직을 각자 구현해 두고 있던 곳:
- `Dashboard`의 `monthSuffix` (KPI 카드 소제목, 국가별순위/도넛 상단
  `windowLabel`이 이걸 그대로 씀)
- `CountryReportCard`의 `periodSuffix` (표 헤더 `Y25 …` / `Y26 …` 라벨)

## 3. 카드 제목

`"국내 와인 수입_국가별 수입금액"` (대구분 무관하게 고정) →
`"{주종}_국가별 수입금액"`으로, 선택된 대구분 따라 동적으로.
대구분이 `전체`(all)일 땐 `"전체 주류_국가별 수입금액"`.

## 영향 범위

파일 3개: `frontend/app/lib/format.js`(헬퍼 2개 추가),
`frontend/app/Dashboard.js`(monthSuffix·priceBreakdown·도넛 라벨 교체),
`frontend/app/CountryReportCard.js`(제목·표 헤더·periodSuffix 교체).
새 상태·API 변경 없음, 순수 표시 로직.
