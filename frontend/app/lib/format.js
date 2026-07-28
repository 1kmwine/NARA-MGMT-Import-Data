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

export function fmtMoney(usd, currency, exchangeRate) {
  if (currency === 'KRW') {
    const eok = usd * exchangeRate / 1e8;
    return eok.toLocaleString('ko-KR', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + '억원';
  }
  const m = usd / 1e6;
  return '$' + m.toLocaleString('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + 'M';
}

export function fmtVolumeML(kg) {
  const ml = kg / 1e6;
  return ml.toLocaleString('ko-KR', { maximumFractionDigits: 1 }) + ' milL';
}

export function fmtUnitPrice(usdPerKg, currency, exchangeRate) {
  if (currency === 'KRW') return '₩' + Math.round(usdPerKg * exchangeRate).toLocaleString('ko-KR') + '/kg';
  return '$' + usdPerKg.toFixed(2) + '/kg';
}

export function segStyle(active) {
  return active
    ? { background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)', color: 'var(--color-accent-700)', boxShadow: 'inset 0 0 0 1px var(--color-accent)' }
    : { background: 'transparent', color: 'var(--color-text)' };
}
