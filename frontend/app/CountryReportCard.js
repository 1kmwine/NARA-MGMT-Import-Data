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

    const buildRow = (c, bold) => {
      const vals25 = cols.map(k => metricValue(c[k], '25', metric));
      const vals26 = cols.map(k => metricValue(c[k], '26', metric));
      const gaps = vals26.map((v, i) => v - vals25[i]);
      const grw = vals26.map((v, i) => pctChange(vals25[i], v));
      const lastIdx = cols.length - 1;
      const cellsFor = (arr, fmtFn, colorFn) => arr.map((v, i) => ({
        text: fmtFn(v),
        style: { textAlign: 'right', padding: '6px 10px', ...(i === lastIdx ? { fontWeight: 700, background: 'var(--color-neutral-100)' } : {}), ...(colorFn ? { color: colorFn(v) } : {}) },
      }));
      return {
        label: c.country, bold,
        cells: [...cellsFor(vals25, fmtM1), ...cellsFor(vals26, fmtM1), ...cellsFor(gaps, fmtSigned1, deltaColorSimple), ...cellsFor(grw, fmtSignedPct1, deltaColorSimple)],
      };
    };
    const tableRows = [buildRow(allTotal, true), ...topN.map(c => buildRow(c, false)), buildRow(restAgg, false)];

    const gapOf = c => metricValue(c.total, '26', metric) - metricValue(c.total, '25', metric);
    const growthOf = c => pctChange(metricValue(c.total, '25', metric), metricValue(c.total, '26', metric));
    const topGrowth = [...countryAgg].sort((a, b) => gapOf(b) - gapOf(a)).slice(0, 5)
      .map(c => ({ country: c.country, gap: Number(gapOf(c).toFixed(2)), growthPct: Number(growthOf(c).toFixed(1)) }));
    const topDecline = [...countryAgg].sort((a, b) => gapOf(a) - gapOf(b)).slice(0, 5)
      .map(c => ({ country: c.country, gap: Number(gapOf(c).toFixed(2)), growthPct: Number(growthOf(c).toFixed(1)) }));

    const stats = {
      지표: METRIC_OPTS.find(o => o.id === metric).label,
      단위: unitLabel(metric),
      비교대상: periodSuffix + ', ' + prevYear + '년 vs ' + topYear + '년',
      전체_YoY_Gap: Number(gapOf(allTotal).toFixed(2)),
      전체_GRW: Number(growthOf(allTotal).toFixed(1)),
      성장상위국: topGrowth,
      감소상위국: topDecline,
    };

    return { tableRows, stats };
  }, [curRows, prevRows, metric, subItems, groupField, periodSuffix, topYear, prevYear]);

  const statsKey = JSON.stringify(report.stats);

  const fetchBullets = (force, instruction) => {
    setLoading(true);
    fetch('/api/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stats: report.stats, instruction: instruction || undefined, force: force || undefined }),
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

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          className="input"
          style={{ flex: 1, minWidth: 220, minHeight: 32, padding: '4px 8px', fontSize: 13 }}
          placeholder="관점 입력"
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
              {Array.from({ length: 4 }).flatMap((_, g) => cols.map((k, i) => (
                <th key={g + '-' + i} style={k === 'total' ? { background: 'var(--color-neutral-200)' } : undefined}>{k === 'total' ? '합계' : shortMinorLabel(k, major)}</th>
              )))}
            </tr>
          </thead>
          <tbody>
            {report.tableRows.map((row, i) => (
              <tr key={i} style={row.bold ? { background: 'var(--color-neutral-100)' } : {}}>
                <td style={{ padding: '6px 10px', fontWeight: row.bold ? 700 : 400 }}>{row.label}</td>
                {row.cells.map((c, j) => <td key={j} style={c.style}>{c.text}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ textAlign: 'right', fontSize: 10.5, fontStyle: 'italic', color: 'var(--color-neutral-600)', marginTop: 8 }}>※ 출처: 관세청 수출입무역통계</div>
    </div>
  );
}
