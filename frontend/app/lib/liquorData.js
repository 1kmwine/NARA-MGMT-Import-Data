// Ported from the dc-runtime dashboard's backend/static/liquorData.js.
// Same shape: fetches the FastAPI backend's /api/raw and reshapes it into
// { year, month, key, countryId, country, major, minor, volume(kg), value(usd) } rows.

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
    .map(([major]) => ({
      major,
      minors: [...minorsByMajor.get(major).entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([minor]) => ({ minor })),
    }));
}

export async function fetchSnapshot(apiBase) {
  const raw = await fetch(apiBase + '/api/raw').then(r => r.json());

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

  return {
    rows,
    monthsList,
    COUNTRIES: buildCountries(rows),
    MAJORS: buildMajors(rows),
  };
}
