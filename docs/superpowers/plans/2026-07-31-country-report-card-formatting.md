# Country Report Card Formatting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip redundant 대구분 wording from 중구분 labels, compress selected-month lists into ranges (`1~5월`), and make the country report card's title follow the selected 대구분 — applied everywhere these three things already render, per [docs/superpowers/specs/2026-07-31-country-report-card-formatting-design.md](../specs/2026-07-31-country-report-card-formatting-design.md).

**Architecture:** Two new pure string-formatting functions added to the existing `frontend/app/lib/format.js` helper module, then wired into the three call sites that already build these labels by hand (`Dashboard.js` ×2, `CountryReportCard.js` ×2). No new state, no new components, no API changes.

**Tech Stack:** Next.js 16 / React 19 (client components), plain JS. No test runner is installed in this repo (`frontend/package.json` has no `test` script, no jest/vitest) — verification for the pure helpers uses Node's built-in `assert`, and verification for the wiring uses the running dev server in the Browser pane (the pattern already used earlier in this session).

## Global Constraints

- No new npm dependencies (repo has none beyond Next/React/ESLint) — helpers use plain JS only.
- Both helpers live in `frontend/app/lib/format.js` alongside the existing formatters, exported the same way (`export function ...`).
- `shortMinorLabel`/`formatMonthRange` must not change behavior when there's nothing to strip/compress (untouched major, empty month array) — existing call sites' current output for the "no filter" case must stay byte-identical, since that's the default view every user sees first.

---

### Task 1: Add `shortMinorLabel` and `formatMonthRange` to `lib/format.js`

**Files:**
- Modify: `frontend/app/lib/format.js` (append after the existing `segStyle` export at the end of the file)
- Create: `frontend/app/lib/format.selfcheck.mjs` (throwaway-free, committed runnable check — no test framework in this repo, so this is a plain Node script using `assert`)

**Interfaces:**
- Produces: `shortMinorLabel(minor: string, major: string) => string` — strips `major` from `minor` as a suffix (preferred) or prefix, trims, and falls back to the original `minor` if stripping would leave an empty string or `major` is falsy/`'all'`.
- Produces: `formatMonthRange(monthsNum: number[]) => string` — takes an array of month numbers (not necessarily sorted/deduped), groups consecutive runs, and joins as `"a~b월"` (or `"a월"` for a run of length 1), space-separated. Returns `''` for an empty/falsy input.

- [ ] **Step 1: Write the two functions**

Append to `frontend/app/lib/format.js`:

```js
// 중구분 라벨에서 이미 상위 헤더에 나와있는 대구분 이름을 잘라낸다.
// ("레드 와인" + 대구분 "와인" → "레드"). 접미 우선, 없으면 접두. 다 잘라내면
// (중구분 이름이 대구분과 완전히 같은 경우, 예: 대구분/중구분 모두 "맥주")
// 빈 문자열이 아니라 원본을 돌려준다.
export function shortMinorLabel(minor, major) {
  if (!major || major === 'all' || !minor) return minor;
  let s = minor;
  if (s.endsWith(major)) s = s.slice(0, s.length - major.length).trim();
  else if (s.startsWith(major)) s = s.slice(major.length).trim();
  return s || minor;
}

// 선택된 월 목록을 연속 구간으로 묶어 "1~5월", 끊기면 "1~5월 7~9월"로 표시.
export function formatMonthRange(monthsNum) {
  if (!monthsNum || !monthsNum.length) return '';
  const sorted = [...new Set(monthsNum)].sort((a, b) => a - b);
  const ranges = [];
  let start = sorted[0], prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const m = sorted[i];
    if (m === prev + 1) { prev = m; continue; }
    ranges.push([start, prev]);
    start = prev = m;
  }
  ranges.push([start, prev]);
  return ranges.map(([a, b]) => (a === b ? a + '월' : a + '~' + b + '월')).join(' ');
}
```

- [ ] **Step 2: Write the self-check script**

Create `frontend/app/lib/format.selfcheck.mjs`:

```js
import assert from 'node:assert/strict';
import { shortMinorLabel, formatMonthRange } from './format.js';

// shortMinorLabel
assert.equal(shortMinorLabel('레드 와인', '와인'), '레드');
assert.equal(shortMinorLabel('기타 와인', '와인'), '기타');
assert.equal(shortMinorLabel('맥주', '맥주'), '맥주'); // fully-consumed -> fallback to original
assert.equal(shortMinorLabel('논알콜 맥주', '맥주'), '논알콜');
assert.equal(shortMinorLabel('레드 와인', 'all'), '레드 와인'); // major === 'all' -> untouched
assert.equal(shortMinorLabel('레드 와인', null), '레드 와인'); // no major -> untouched

// formatMonthRange
assert.equal(formatMonthRange([]), '');
assert.equal(formatMonthRange([3]), '3월');
assert.equal(formatMonthRange([1, 2, 3, 4, 5]), '1~5월');
assert.equal(formatMonthRange([1, 2, 3, 5, 7, 8, 9]), '1~3월 5월 7~9월');
assert.equal(formatMonthRange([5, 1, 3, 2, 4]), '1~5월'); // unsorted input

console.log('format.selfcheck.mjs: all assertions passed');
```

- [ ] **Step 3: Run the self-check**

Run: `node frontend/app/lib/format.selfcheck.mjs`
Expected: `format.selfcheck.mjs: all assertions passed` printed, exit code 0. If an `assert` throws, fix the function (not the assertion) and re-run.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/lib/format.js frontend/app/lib/format.selfcheck.mjs
git commit -m "Add shortMinorLabel/formatMonthRange formatting helpers"
```

---

### Task 2: Wire `shortMinorLabel` into the three places that show a 중구분 label

**Files:**
- Modify: `frontend/app/CountryReportCard.js:4` (import), `:204` (table sub-header cell)
- Modify: `frontend/app/Dashboard.js:4` (import), `:114` (평균단가 breakdown label), `:211` (donut legend label)

**Interfaces:**
- Consumes: `shortMinorLabel(minor, major)` from Task 1.

- [ ] **Step 1: Import in `CountryReportCard.js`**

`frontend/app/CountryReportCard.js:4`, change:

```js
import { fmtM1, fmtSigned1, fmtSignedPct1, deltaColorSimple, segStyle } from './lib/format';
```
to:
```js
import { fmtM1, fmtSigned1, fmtSignedPct1, deltaColorSimple, segStyle, shortMinorLabel } from './lib/format';
```

- [ ] **Step 2: Use it in the table sub-header**

`frontend/app/CountryReportCard.js:202-206`, change the header cell body from:

```js
              {Array.from({ length: 4 }).flatMap((_, g) => cols.map((k, i) => (
                <th key={g + '-' + i} style={k === 'total' ? { background: 'var(--color-neutral-200)' } : undefined}>{k === 'total' ? '합계' : k}</th>
              )))}
```
to:
```js
              {Array.from({ length: 4 }).flatMap((_, g) => cols.map((k, i) => (
                <th key={g + '-' + i} style={k === 'total' ? { background: 'var(--color-neutral-200)' } : undefined}>{k === 'total' ? '합계' : shortMinorLabel(k, major)}</th>
              )))}
```

(When `major === 'all'`, `cols` holds 대구분 names, not 중구분s — `shortMinorLabel` already no-ops when `major === 'all'`, so this is safe without a branch.)

- [ ] **Step 3: Import in `Dashboard.js`**

`frontend/app/Dashboard.js:4`, change:
```js
import { sumField, pctDiff, deltaMeta, trendDelta, fmtMoney, fmtVolumeML, fmtUnitPrice, segStyle } from './lib/format';
```
to:
```js
import { sumField, pctDiff, deltaMeta, trendDelta, fmtMoney, fmtVolumeML, fmtUnitPrice, segStyle, shortMinorLabel, formatMonthRange } from './lib/format';
```
(this also covers Task 3's `formatMonthRange` import so it's only added once)

- [ ] **Step 4: Use it in the 평균단가 breakdown**

`frontend/app/Dashboard.js:114`, change:
```js
        return { name: mn.minor.replace(' 와인', ''), priceDisplay, yoyText: d.text, yoyColor: d.color };
```
to:
```js
        return { name: shortMinorLabel(mn.minor, '와인'), priceDisplay, yoyText: d.text, yoyColor: d.color };
```

(This block is already inside the `s.major === '와인'` guard at line 103, so `'와인'` here is correct and equivalent to the old hardcoded `.replace(' 와인', '')` — same output, now via the shared helper.)

- [ ] **Step 5: Use it in the donut legend**

`frontend/app/Dashboard.js:211`, change:
```js
      pieData = majorDef.minors.map(mn => ({ label: mn.minor, value: sumField(scoped.filter(r => r.minor === mn.minor), 'value') }));
```
to:
```js
      pieData = majorDef.minors.map(mn => ({ label: shortMinorLabel(mn.minor, s.major), value: sumField(scoped.filter(r => r.minor === mn.minor), 'value') }));
```

- [ ] **Step 6: Visual check in the browser**

Start the dev servers if not already running (`preview_start` with `name: "backend"` then `name: "frontend"` per `.claude/launch.json`), navigate to `http://localhost:3000`.

1. Default view (주종 = 와인): confirm the KPI card's 평균단가 breakdown now reads `레드`/`화이트`/`스파클링`/`기타` (unchanged from before — this is the byte-identical case from Global Constraints).
2. Click 주종 = 맥주: confirm the donut legend reads `맥주`/`논알콜` (not `논알콜 맥주`), and the report card's table headers read the same short forms.
3. Click 주종 = 전체: confirm the report card table headers are unaffected (still full major names like `위스키`, `리큐르` — nothing to strip).

- [ ] **Step 7: Commit**

```bash
git add frontend/app/CountryReportCard.js frontend/app/Dashboard.js
git commit -m "Strip redundant 대구분 wording from 중구분 labels app-wide"
```

---

### Task 3: Wire `formatMonthRange` in, and make the report card title follow 주종

**Files:**
- Modify: `frontend/app/Dashboard.js:55` (`monthSuffix`), `:347-354` (CountryReportCard invocation — pass `selMonths` as already wired, no change needed there; confirm only)
- Modify: `frontend/app/CountryReportCard.js:48` (`periodSuffix`), `:164` (title)

**Interfaces:**
- Consumes: `formatMonthRange(monthsNum)` from Task 1 (already imported into both files by Task 2).

- [ ] **Step 1: Use `formatMonthRange` in `Dashboard.js`'s `monthSuffix`**

`frontend/app/Dashboard.js:55`, change:
```js
    const monthSuffix = selMonthsNum.length ? (' · ' + selMonthsNum.map(m => m + '월').join(',')) : '';
```
to:
```js
    const monthSuffix = selMonthsNum.length ? (' · ' + formatMonthRange(selMonthsNum)) : '';
```

This one line feeds `windowLabel`, the KPI card `sub` text, and the ranking-card/donut date captions — no other changes needed for those to pick up the new format.

- [ ] **Step 2: Use `formatMonthRange` in `CountryReportCard.js`'s `periodSuffix`**

`frontend/app/CountryReportCard.js:48`, change:
```js
  const periodSuffix = months.length ? months.map(m => m + '월').join(',') : (isLatestYear ? 'M' + String(kpiMaxM).padStart(2, '0') + ' YTD' : '연간');
```
to:
```js
  const periodSuffix = months.length ? formatMonthRange(months) : (isLatestYear ? 'M' + String(kpiMaxM).padStart(2, '0') + ' YTD' : '연간');
```

- [ ] **Step 3: Change the report card title to follow 주종**

`frontend/app/CountryReportCard.js:164`, change:
```js
        <h2 style={{ margin: 0, fontSize: 19 }}>국내 {major === 'all' ? '전체 주류' : major} 수입_국가별 수입금액</h2>
```
to:
```js
        <h2 style={{ margin: 0, fontSize: 19 }}>{major === 'all' ? '전체 주류' : major}_국가별 수입금액</h2>
```

- [ ] **Step 4: Visual check in the browser**

Reload `http://localhost:3000` (or rely on HMR).

1. Default view: title reads `와인_국가별 수입금액`.
2. Select 월 = 1월,2월,3월,4월,5월 (or any 5 consecutive months): confirm the KPI card subtitle and the report card's `Y25 …`/`Y26 …` column headers both read `1~5월`, not `1월,2월,3월,4월,5월`.
3. Additionally select 7,8,9월 (now 1-5 and 7-9 selected, 6 unselected): confirm both places read `1~5월 7~9월`.
4. Deselect all months (back to 전체): confirm KPI subtitle has no trailing `· ...` and report card headers read `Y25 M06 YTD` / `Y26 M06 YTD` again (byte-identical to before this task, per Global Constraints).
5. Switch 주종 to 전체: confirm title reads `전체 주류_국가별 수입금액`.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/Dashboard.js frontend/app/CountryReportCard.js
git commit -m "Show selected months as compressed ranges; report card title follows 주종"
```
