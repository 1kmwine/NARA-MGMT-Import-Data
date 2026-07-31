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

// Table-badge variant: +blue/-red, no arrow glyph.
export function pctBadge(pctVal) {
  if (pctVal === null) return { text: '—', color: 'var(--color-text)' };
  if (!isFinite(pctVal)) pctVal = 0;
  const positive = pctVal >= 0;
  return { text: (positive ? '+' : '') + pctVal.toFixed(1) + '%', color: positive ? '#2563eb' : '#dc2626' };
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
