// Real API-backed snapshot for the liquor import dashboards.
// Fetches backend/main.py's GET /api/raw and reshapes it into the row shape
// the dashboards were built against:
// { year, month, key, countryId, country, major, minor, volume(kg), value(usd), price(usd/kg) }

const COLOR_CYCLE = [
  'var(--color-accent-700)', 'var(--color-accent-600)', 'var(--color-accent-500)', 'var(--color-accent-400)',
  'var(--color-accent-300)', 'var(--color-neutral-700)', 'var(--color-neutral-600)', 'var(--color-neutral-500)',
  'var(--color-neutral-400)', 'var(--color-neutral-300)', 'var(--color-accent-900)', 'var(--color-accent-200)',
  'var(--color-neutral-800)', 'var(--color-neutral-200)', 'var(--color-accent-800)', 'var(--color-neutral-900)',
];

function buildCountries(rows) {
  const totals = new Map();
  rows.forEach(r => totals.set(r.country, (totals.get(r.country) || 0) + r.value));
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => ({ id: name, name }));
}

function buildMajors(rows) {
  const majorTotals = new Map();
  const minorsByMajor = new Map();
  rows.forEach(r => {
    majorTotals.set(r.major, (majorTotals.get(r.major) || 0) + r.value);
    if (!minorsByMajor.has(r.major)) minorsByMajor.set(r.major, new Map());
    const mm = minorsByMajor.get(r.major);
    mm.set(r.minor, (mm.get(r.minor) || 0) + r.value);
  });
  return [...majorTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([major], i) => ({
      major,
      color: COLOR_CYCLE[i % COLOR_CYCLE.length],
      minors: [...minorsByMajor.get(major).entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([minor]) => ({ minor })),
    }));
}

const raw = await fetch('./api/raw').then(r => r.json());

const rows = raw.rows.map(r => ({
  year: r.year,
  month: r.month,
  key: r.year + '-' + r.month,
  countryId: r.country,
  country: r.country,
  major: r.major,
  minor: r.minor,
  volume: r.volume,
  value: r.value,
}));

const monthsList = [...new Set(rows.map(r => r.key))]
  .map(key => {
    const [year, month] = key.split('-').map(Number);
    return { year, month, key };
  })
  .sort((a, b) => a.year - b.year || a.month - b.month);

export const COUNTRIES = buildCountries(rows);
export const MAJORS = buildMajors(rows);

const _snapshot = { rows, monthsList };
export function generateSnapshot() {
  return _snapshot;
}
