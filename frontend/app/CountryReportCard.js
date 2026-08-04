'use client';

import { useEffect, useMemo, useState } from 'react';
import { fmtM1, fmtSigned1, fmtSignedPct1, deltaColorSimple, segStyle, shortMinorLabel, formatMonthRange } from './lib/format';
import { Button } from './components/Button';

const pctChange = (prev, cur) => (prev !== 0 ? (cur - prev) / Math.abs(prev) * 100 : 0);

const METRIC_OPTS = [
  { id: 'value', label: '금액' },
  { id: 'volume', label: '중량' },
  { id: 'price', label: '평균단가' },
];

// 주종(대구분)이 '전체'면 대구분끼리, 특정 주종이면 그 주종의 중구분끼리 비교한다.
function subItemsFor(major, MAJORS) {
  if (!MAJORS) return [];
  if (major === 'all') return MAJORS.map(m => m.major);
  const def = MAJORS.find(m => m.major === major);
  return def ? def.minors.map(mn => mn.minor) : [];
}

function unitLabel(metric) {
  if (metric === 'value') return '백만 달러';
  if (metric === 'volume') return '백만 리터';
  return '$/L';
}

// 금액(v, USD)/중량(q, kg)을 원자료로 갖고 있다가, 보여줄 지표에 따라 그때그때 환산한다 —
// 평균단가는 합산 후 나눠야(v/q) 맞기 때문에 원자료를 따로 들고 있어야 한다.
function metricValue(o, period, metric) {
  const v = o['v' + period], q = o['q' + period];
  if (metric === 'value') return v / 1e6;
  if (metric === 'volume') return q / 1e6;
  return q ? v / q : 0;
}

export default function CountryReportCard({ curRows, prevRows, major, MAJORS, selMonths, topYear, kpiMaxM, latestYear }) {
  const [metric, setMetric] = useState('value');
  const [comment, setComment] = useState('');
  const [bullets, setBullets] = useState(null);
  const [bulletsError, setBulletsError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [focusCountries, setFocusCountries] = useState([]);
  const [focusItems, setFocusItems] = useState([]);
  const toggleFocusCountry = (name) => setFocusCountries(cur => cur.includes(name) ? cur.filter(x => x !== name) : [...cur, name]);
  const toggleFocusItem = (key) => setFocusItems(cur => cur.includes(key) ? cur.filter(x => x !== key) : [...cur, key]);

  const isLatestYear = topYear === latestYear;
  const prevYear = topYear - 1;
  const months = selMonths || [];
  const periodSuffix = months.length ? formatMonthRange(months) : (isLatestYear ? 'M' + String(kpiMaxM).padStart(2, '0') + ' YTD' : '연간');
  const periodLabelWide = (y) => 'Y' + String(y).slice(-2) + ' ' + periodSuffix;

  const groupField = major === 'all' ? 'major' : 'minor';
  const subItems = useMemo(() => subItemsFor(major, MAJORS), [major, MAJORS]);
  const cols = [...subItems, 'total'];

  const report = useMemo(() => {
    const empty = () => ({ v25: 0, v26: 0, q25: 0, q26: 0 });
    const byCountry = new Map();
    const ensure = (country) => {
      if (!byCountry.has(country)) {
        const c = { country, total: empty() };
        subItems.forEach(k => { c[k] = empty(); });
        byCountry.set(country, c);
      }
      return byCountry.get(country);
    };
    prevRows.forEach(r => {
      const c = ensure(r.country);
      c.total.v25 += r.value; c.total.q25 += r.volume;
      const k = r[groupField]; if (c[k]) { c[k].v25 += r.value; c[k].q25 += r.volume; }
    });
    curRows.forEach(r => {
      const c = ensure(r.country);
      c.total.v26 += r.value; c.total.q26 += r.volume;
      const k = r[groupField]; if (c[k]) { c[k].v26 += r.value; c[k].q26 += r.volume; }
    });
    const countryAgg = [...byCountry.values()];

    const sumAgg = (label, list) => {
      const acc = { country: label, total: empty() };
      subItems.forEach(k => { acc[k] = empty(); });
      list.forEach(c => cols.forEach(k => {
        acc[k].v25 += c[k].v25; acc[k].v26 += c[k].v26; acc[k].q25 += c[k].q25; acc[k].q26 += c[k].q26;
      }));
      return acc;
    };
    const sorted = [...countryAgg].sort((a, b) => b.total.v26 - a.total.v26);
    const topN = sorted.slice(0, 10);
    const restAgg = sumAgg('기타', sorted.slice(10));
    const allTotal = sumAgg('합계', countryAgg);

    const buildRow = (c, bold, clickable) => {
      const vals25 = cols.map(k => metricValue(c[k], '25', metric));
      const vals26 = cols.map(k => metricValue(c[k], '26', metric));
      const gaps = vals26.map((v, i) => v - vals25[i]);
      const grw = vals26.map((v, i) => pctChange(vals25[i], v));
      const lastIdx = cols.length - 1;
      const cellsFor = (arr, fmtFn, colorFn) => arr.map((v, i) => ({
        text: fmtFn(v),
        itemKey: cols[i],
        style: { textAlign: 'right', padding: '4px 5px', ...(i === lastIdx ? { fontWeight: 700, background: 'var(--color-neutral-100)' } : {}), ...(colorFn ? { color: colorFn(v) } : {}) },
      }));
      return {
        label: c.country, bold, clickable,
        cells: [...cellsFor(vals25, fmtM1), ...cellsFor(vals26, fmtM1), ...cellsFor(gaps, fmtSigned1, deltaColorSimple), ...cellsFor(grw, fmtSignedPct1, deltaColorSimple)],
      };
    };
    const tableRows = [buildRow(allTotal, true, false), ...topN.map(c => buildRow(c, false, true)), buildRow(restAgg, false, false)];

    // 인사이트는 표에 실제로 표기되는 국가(최종 선택 연도 상위 10개국, topN)로만 한정한다 —
    // countryAgg 전체에서 뽑으면 표에 없는 국가가 인사이트에만 등장할 수 있다.
    const gapOf = c => metricValue(c.total, '26', metric) - metricValue(c.total, '25', metric);
    const growthOf = c => pctChange(metricValue(c.total, '25', metric), metricValue(c.total, '26', metric));
    const topGrowth = [...topN].sort((a, b) => gapOf(b) - gapOf(a)).slice(0, 5)
      .map(c => ({ country: c.country, gap: Number(gapOf(c).toFixed(2)), growthPct: Number(growthOf(c).toFixed(1)) }));
    const topDecline = [...topN].sort((a, b) => gapOf(a) - gapOf(b)).slice(0, 5)
      .map(c => ({ country: c.country, gap: Number(gapOf(c).toFixed(2)), growthPct: Number(growthOf(c).toFixed(1)) }));

    // 국가/항목(컬러)/표 데이터(둘 다) 클릭 시 그 범위에 대한 수치만 별도로 얹는다 —
    // 인사이트 프롬프트가 "stats에 있는 값만 사용" 규칙을 지키면서 그 범위 얘기만
    // 하도록. 국가·항목 각각 복수 선택 가능 — 선택 조합에 따라 세 가지 모양 중
    // 하나가 만들어진다.
    const round2 = v => Number(v.toFixed(2));
    const round1 = v => Number(v.toFixed(1));
    const itemGapOf = (c, k) => metricValue(c[k], '26', metric) - metricValue(c[k], '25', metric);
    const itemGrowthOf = (c, k) => pctChange(metricValue(c[k], '25', metric), metricValue(c[k], '26', metric));
    const focusEntries = focusCountries.map(name => topN.find(c => c.country === name)).filter(Boolean);

    let focusStats = null;
    if (focusEntries.length && focusItems.length) {
      const cells = [];
      focusEntries.forEach(entry => focusItems.forEach(it => {
        cells.push({
          국가: entry.country, 항목: shortMinorLabel(it, major),
          전년값: round2(metricValue(entry[it], '25', metric)),
          금년값: round2(metricValue(entry[it], '26', metric)),
          YoY_Gap: round2(itemGapOf(entry, it)),
          GRW: round1(itemGrowthOf(entry, it)),
        });
      }));
      focusStats = { 범위: '국가×항목 조합 (표에서 고른 셀들)', 선택: cells };
    } else if (focusEntries.length) {
      const rows = focusEntries.map(entry => ({
        국가: entry.country,
        전년값: round2(metricValue(entry.total, '25', metric)),
        금년값: round2(metricValue(entry.total, '26', metric)),
        YoY_Gap: round2(gapOf(entry)),
        GRW: round1(growthOf(entry)),
        ...(focusEntries.length === 1 ? {
          세부구성: subItems.map(k => ({
            항목: shortMinorLabel(k, major),
            금년값: round2(metricValue(entry[k], '26', metric)),
            GRW: round1(itemGrowthOf(entry, k)),
          })),
        } : {}),
      }));
      focusStats = { 범위: focusEntries.length > 1 ? '국가 비교' : '국가', 국가별: rows };
    } else if (focusItems.length) {
      const rows = focusItems.map(it => {
        const agg25 = topN.reduce((s, c) => s + metricValue(c[it], '25', metric), 0);
        const agg26 = topN.reduce((s, c) => s + metricValue(c[it], '26', metric), 0);
        const row = { 항목: shortMinorLabel(it, major), 전년값: round2(agg25), 금년값: round2(agg26), YoY_Gap: round2(agg26 - agg25) };
        if (focusItems.length === 1) {
          const movers = [...topN]
            .map(c => ({ 국가: c.country, gap: round2(itemGapOf(c, it)), growthPct: round1(itemGrowthOf(c, it)) }))
            .sort((a, b) => b.gap - a.gap);
          row.국가별_변화_상위 = movers.slice(0, 5);
          row.국가별_변화_하위 = movers.slice(-5).reverse();
        }
        return row;
      });
      focusStats = { 범위: focusItems.length > 1 ? '항목 비교' : '항목', 항목별: rows };
    }

    const stats = {
      지표: METRIC_OPTS.find(o => o.id === metric).label,
      단위: unitLabel(metric),
      비교대상: periodSuffix + ', ' + prevYear + '년 vs ' + topYear + '년',
      전체_YoY_Gap: Number(gapOf(allTotal).toFixed(2)),
      전체_GRW: Number(growthOf(allTotal).toFixed(1)),
      성장상위국: topGrowth,
      감소상위국: topDecline,
      ...(focusStats ? { 포커스: focusStats } : {}),
    };

    return { tableRows, stats };
  }, [curRows, prevRows, metric, subItems, groupField, periodSuffix, topYear, prevYear, major, focusCountries, focusItems]);

  const statsKey = JSON.stringify(report.stats);

  // 클릭으로 국가/항목을 좁혔으면 그 범위만 다루라는 지시를 자동으로 붙인다 —
  // 관점 입력창에 따로 타이핑한 지시가 있으면 그 뒤에 이어붙인다.
  const focusInstruction = (() => {
    const cs = focusCountries.length ? focusCountries.join(', ') : null;
    const its = focusItems.length ? focusItems.map(k => shortMinorLabel(k, major)).join(', ') + ' 항목' : null;
    if (!cs && !its) return null;
    const scope = [cs, its].filter(Boolean).join(' / ');
    const multi = focusCountries.length + focusItems.length > 1;
    return scope + '만 다루고' + (multi ? ', 서로 비교해서 시사점을 뽑아줘' : '');
  })();

  const fetchBullets = (force, instruction) => {
    const combined = [focusInstruction, instruction].filter(Boolean).join(' / ') || undefined;
    setLoading(true);
    fetch('/api/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stats: report.stats, instruction: combined, force: force || undefined }),
    })
      .then(r => r.json())
      .then(data => {
        setLoading(false);
        if (data.error) { setBulletsError(data.error); return; }
        setBullets(data);
        setBulletsError(null);
      })
      .catch(e => { setLoading(false); setBulletsError(e.message); });
  };

  // 지표(금액/중량/평균단가) 토글마다 statsKey가 바뀌므로 자동 재요청 — 단 캐시가 있으면
  // (동일 지표로 이미 한 번 생성한 적 있으면) 서버가 캐시를 돌려줘서 API를 다시 안 쓴다.
  useEffect(() => {
    setBullets(null);
    setBulletsError(null);
    fetchBullets(false, null);
  }, [statsKey]);

  const bulletText = (key) => {
    if (bullets) return bullets[key];
    if (bulletsError) return '(Gemini 인사이트 생성 실패: ' + bulletsError + ')';
    return '인사이트 생성 중…';
  };

  return (
    <div className="card elev-sm" style={{ padding: 24, marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 19 }}>{major === 'all' ? '전체 주류' : major}_국가별 수입금액</h2>
        <div className="seg">
          {METRIC_OPTS.map(opt => (
            <button key={opt.id} type="button" className="seg-opt" style={{ border: 'none', ...segStyle(metric === opt.id) }} onClick={() => setMetric(opt.id)}>{opt.label}</button>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 13, lineHeight: 2, marginTop: 10, marginBottom: 10 }}>
        <div>➢ {bulletText('bullet1')}</div>
        <div>➢ {bulletText('bullet2')}</div>
      </div>

      {(focusCountries.length > 0 || focusItems.length > 0) && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="text-muted" style={{ fontSize: 11 }}>인사이트 범위:</span>
          {focusCountries.map(name => (
            <span key={name} className="tag tag-accent" style={{ cursor: 'pointer' }} onClick={() => toggleFocusCountry(name)}>{name} ✕</span>
          ))}
          {focusItems.map(key => (
            <span key={key} className="tag tag-accent" style={{ cursor: 'pointer' }} onClick={() => toggleFocusItem(key)}>{shortMinorLabel(key, major)} ✕</span>
          ))}
          <span className="text-muted" style={{ fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }} onClick={() => { setFocusCountries([]); setFocusItems([]); }}>전체 지우기</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          className="input"
          style={{ flex: 1, minWidth: 220, minHeight: 32, padding: '4px 8px', fontSize: 13 }}
          placeholder="입력"
          value={comment}
          onChange={e => setComment(e.target.value)}
        />
        <Button variant="secondary" size="sm" onClick={() => fetchBullets(true, comment)} disabled={loading}>{loading ? '생성 중…' : '새로고침'}</Button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>국가별 수입 {METRIC_OPTS.find(o => o.id === metric).label} 추이</div>
        <div className="text-muted" style={{ fontSize: 11, marginBottom: 8 }}>[단위: {unitLabel(metric)}]</div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="rpt-table">
          <thead>
            <tr>
              <th rowSpan={2} style={{ textAlign: 'left' }}>구분</th>
              <th colSpan={cols.length}>{periodLabelWide(prevYear)}</th>
              <th colSpan={cols.length}>{periodLabelWide(topYear)}</th>
              <th colSpan={cols.length}>YoY Gap</th>
              <th colSpan={cols.length}>GRW%</th>
            </tr>
            <tr>
              {Array.from({ length: 4 }).flatMap((_, g) => cols.map((k, i) => {
                const isItem = k !== 'total';
                const active = isItem && focusItems.includes(k);
                return (
                  <th
                    key={g + '-' + i}
                    onClick={isItem ? () => toggleFocusItem(k) : undefined}
                    style={{
                      ...(k === 'total' ? { background: 'var(--color-neutral-200)' } : {}),
                      ...(isItem ? { cursor: 'pointer' } : {}),
                      ...(active ? { background: 'var(--color-accent-soft)', color: 'var(--color-accent-hover)' } : {}),
                    }}
                  >
                    {k === 'total' ? '합계' : shortMinorLabel(k, major)}
                  </th>
                );
              }))}
            </tr>
          </thead>
          <tbody>
            {report.tableRows.map((row, i) => (
              <tr key={i} style={row.bold ? { background: 'var(--color-neutral-100)' } : (row.clickable && focusCountries.includes(row.label) ? { background: 'var(--color-accent-soft)' } : {})}>
                <td
                  onClick={row.clickable ? () => toggleFocusCountry(row.label) : undefined}
                  style={{ padding: '4px 6px', fontWeight: row.bold ? 700 : 400, ...(row.clickable ? { cursor: 'pointer' } : {}) }}
                >
                  {row.label}
                </td>
                {row.cells.map((c, j) => {
                  const cellClickable = row.clickable && c.itemKey !== 'total';
                  const active = row.clickable && focusCountries.includes(row.label) && focusItems.includes(c.itemKey);
                  return (
                    <td
                      key={j}
                      onClick={cellClickable ? () => { toggleFocusCountry(row.label); toggleFocusItem(c.itemKey); } : undefined}
                      style={{ ...c.style, ...(cellClickable ? { cursor: 'pointer' } : {}), ...(active ? { boxShadow: 'inset 0 0 0 1.5px var(--color-accent)' } : {}) }}
                    >
                      {c.text}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ textAlign: 'right', fontSize: 10.5, fontStyle: 'italic', color: 'var(--color-neutral-600)', marginTop: 8 }}>※ 출처: 관세청 수출입무역통계</div>
    </div>
  );
}
