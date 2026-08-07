// Formatting/delta helpers ported from index.html's Component class methods.
// exchangeRate is threaded through explicitly since these are no longer
// instance methods with access to `this.state`.

export function sumField(rows, field) {
  return rows.reduce((a, r) => a + r[field], 0);
}

export function pctDiff(c, p) {
  return p === 0 ? 0 : (c - p) / p * 100;
}

export function deltaMeta(pctVal) {
  if (!isFinite(pctVal)) pctVal = 0;
  const positive = pctVal >= 0;
  return { text: (positive ? '▲ ' : '▼ ') + Math.abs(pctVal).toFixed(1) + '%', color: positive ? 'var(--color-accent-700)' : 'var(--color-neutral-700)' };
}

// Year-summary variant: "YoY +x%" text, +blue/-red.
export function trendDelta(pctVal) {
  if (pctVal === null) return { text: '—', color: 'var(--color-text)' };
  if (!isFinite(pctVal)) pctVal = 0;
  const positive = pctVal >= 0;
  return { text: 'YoY ' + (positive ? '+' : '') + pctVal.toFixed(1) + '%', color: positive ? '#2563eb' : '#dc2626' };
}

export function fmtMoney(usd) {
  const m = usd / 1e6;
  return '$' + m.toLocaleString('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + 'M';
}

export function fmtVolumeML(kg) {
  const ml = kg / 1e6;
  return ml.toLocaleString('ko-KR', { maximumFractionDigits: 1 }) + ' milL';
}

export function fmtUnitPrice(usdPerKg) {
  return '$' + usdPerKg.toFixed(2) + '/kg';
}

// Plain 1-decimal number formatters (used by report-style tables that show
// raw magnitudes rather than "$"/"milL"-suffixed KPI values).
export function fmtM1(v) {
  return (v || 0).toLocaleString('ko-KR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
}
export function fmtSigned1(v) {
  v = v || 0;
  return (v >= 0 ? '+' : '') + v.toLocaleString('ko-KR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
}
export function fmtSignedPct1(v) {
  if (!isFinite(v)) v = 0;
  return (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
}
export function deltaColorSimple(v) {
  return v >= 0 ? '#2563eb' : '#dc2626';
}

export function segStyle(active) {
  return active
    ? { background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)', color: 'var(--color-accent-700)', boxShadow: 'inset 0 0 0 1px var(--color-accent)' }
    : { background: 'transparent', color: 'var(--color-text)' };
}

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
