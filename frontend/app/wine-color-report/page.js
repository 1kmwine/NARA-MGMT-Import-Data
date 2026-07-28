'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchSnapshot } from '../lib/liquorData';
import { segStyle } from '../lib/format';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8010';

const sumWine = (rows, field, pred) => rows.filter(pred).reduce((a, r) => a + r[field], 0);
const fmtM1 = (v) => (v || 0).toLocaleString('ko-KR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const fmtSigned1 = (v) => { v = v || 0; return (v >= 0 ? '+' : '') + v.toLocaleString('ko-KR', { maximumFractionDigits: 1, minimumFractionDigits: 1 }); };
const fmtSignedPct1 = (v) => { if (!isFinite(v)) v = 0; return (v >= 0 ? '+' : '') + v.toFixed(1) + '%'; };
const fmtSignedPP1 = (v) => { if (!isFinite(v)) v = 0; return (v >= 0 ? '+' : '') + v.toFixed(1) + '%p'; };
const fmtPct0 = (v) => Math.round(v || 0) + '%';
const deltaColor = (v) => (v >= 0 ? '#2563eb' : '#dc2626');
const pctChange = (a, b) => (a !== 0 ? (b - a) / Math.abs(a) * 100 : 0);
const yy = (year) => String(year).slice(-2);

const COLORS = ['레드 와인', '화이트 와인', '스파클링 와인', '기타 와인'];
const colorName = (m) => m.replace(' 와인', '');
const TABLE2_SUBHEADERS = Array.from({ length: 4 }).flatMap(() => [
  { label: '레드' }, { label: '화이트' }, { label: '스파클링' }, { label: '합계', total: true },
]);

function buildRow(label, vals, valFmt, vsYoyFmt, growthBlank, bold) {
  const h25 = vals[6], h26 = vals[7];
  const vsYoy = h26 - h25;
  const growth = pctChange(h25, h26);
  const cells = vals.map((v, i) => ({
    text: valFmt(v),
    style: { textAlign: 'right', padding: '6px 10px', ...(i >= 6 ? { background: 'var(--color-accent-100)' } : {}), ...(i === 7 ? { boxShadow: 'inset 0 0 0 1.5px #dc2626' } : {}) },
  }));
  cells.push({ text: vsYoyFmt(vsYoy), style: { textAlign: 'right', padding: '6px 10px', fontWeight: 600, background: 'var(--color-accent-100)', color: deltaColor(vsYoy) } });
  cells.push({
    text: growthBlank ? '—' : fmtSignedPct1(growth),
    style: { textAlign: 'right', padding: '6px 10px', fontWeight: 600, background: 'var(--color-accent-100)', color: growthBlank ? 'var(--color-text)' : deltaColor(growth) },
  });
  return { label, bold, cells };
}

function buildRow2(c, bold) {
  const vals25 = [c.red25, c.white25, c.spark25, c.total25];
  const vals26 = [c.red26, c.white26, c.spark26, c.total26];
  const gaps = vals26.map((v, i) => v - vals25[i]);
  const grw = vals26.map((v, i) => pctChange(vals25[i], v));
  const cellsFor = (arr, fmtFn, colorFn) => arr.map((v, i) => ({
    text: fmtFn(v),
    style: { textAlign: 'right', padding: '6px 10px', ...(i === 3 ? { fontWeight: 700, background: 'var(--color-neutral-100)' } : {}), ...(colorFn ? { color: colorFn(v) } : {}) },
  }));
  const cells = [
    ...cellsFor(vals25, fmtM1),
    ...cellsFor(vals26, fmtM1),
    ...cellsFor(gaps, fmtSigned1, deltaColor),
    ...cellsFor(grw, fmtSignedPct1, deltaColor),
  ];
  return { label: c.country, bold, cells };
}

export default function WineColorReportPage() {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState(null);
  const [baseYear, setBaseYear] = useState(null);
  const [bullets, setBullets] = useState(null);
  const [bulletsError, setBulletsError] = useState(null);

  useEffect(() => {
    fetchSnapshot(API_BASE).then(snap => {
      setSnapshot(snap);
      setBaseYear(snap.monthsList[snap.monthsList.length - 1].year);
    }).catch(e => setError(e.message));
  }, []);

  const availableYears = useMemo(() => {
    if (!snapshot) return [];
    return [...new Set(snapshot.monthsList.map(m => m.year))].sort((a, b) => a - b);
  }, [snapshot]);

  const computed = useMemo(() => {
    if (!snapshot || !baseYear) return null;
    const { rows, monthsList } = snapshot;
    const wine = rows.filter(r => r.major === '와인');
    const pad2 = n => String(n).padStart(2, '0');
    const latestPeriod = monthsList[monthsList.length - 1];
    const dataSourceLabel = '관세청 수출입무역통계(nitemtrade) · ' + latestPeriod.year + '.' + pad2(latestPeriod.month) + ' 기준';
    const YEARS1 = Array.from({ length: 6 }, (_, i) => baseYear - 6 + i);
    const prevBaseYear = baseYear - 1;
    // 기준연도가 데이터상 최신연도(진행 중인 해)일 때만 latestMonth까지의 YTD로 비교하고,
    // 이미 끝난 과거 연도는 12월까지 연간으로 비교한다 — 데이터가 늘어나면(예: 7월 갱신)
    // isLatestYear 케이스의 monthCap도 같이 늘어나 헤더/집계가 자동으로 따라간다.
    const isLatestYear = baseYear === latestPeriod.year;
    const monthCap = isLatestYear ? latestPeriod.month : 12;
    const periodLabel = (y) => (isLatestYear ? 'Y' + yy(y) + 'M' + pad2(monthCap) : 'Y' + yy(y));
    const periodLabelWide = (y) => (isLatestYear ? 'Y' + yy(y) + 'M' + pad2(monthCap) + ' YTD' : 'Y' + yy(y) + ' 연간');

    const yearVol = (y, minor) => sumWine(wine, 'volume', r => r.year === y && (!minor || r.minor === minor)) / 1e6;
    const yearAmt = (y, minor) => sumWine(wine, 'value', r => r.year === y && (!minor || r.minor === minor)) / 1e6;
    const periodVol = (y, minor) => sumWine(wine, 'volume', r => r.year === y && r.month <= monthCap && (!minor || r.minor === minor)) / 1e6;
    const periodAmt = (y, minor) => sumWine(wine, 'value', r => r.year === y && r.month <= monthCap && (!minor || r.minor === minor)) / 1e6;

    const metricsByColor = [null, ...COLORS].map(minor => ({
      minor,
      vol: YEARS1.map(y => yearVol(y, minor)).concat([periodVol(prevBaseYear, minor), periodVol(baseYear, minor)]),
      amt: YEARS1.map(y => yearAmt(y, minor)).concat([periodAmt(prevBaseYear, minor), periodAmt(baseYear, minor)]),
    }));
    const totalAmtArr = metricsByColor[0].amt;
    metricsByColor.forEach(m => {
      m.price = m.vol.map((v, i) => (v ? m.amt[i] / v : 0));
      m.ms = m.amt.map((v, i) => (totalAmtArr[i] ? v / totalAmtArr[i] * 100 : 0));
    });

    const volRows = metricsByColor.map((m, i) => buildRow(i === 0 ? 'Volume' : colorName(m.minor), m.vol, fmtM1, fmtSigned1, false, i === 0));
    const amtRows = metricsByColor.map((m, i) => buildRow(i === 0 ? 'Amount' : colorName(m.minor), m.amt, fmtM1, fmtSigned1, false, i === 0));
    const priceRows = metricsByColor.map((m, i) => buildRow(i === 0 ? 'Price(ℓ)' : colorName(m.minor), m.price, fmtM1, fmtSigned1, false, i === 0));
    const msRows = metricsByColor.map((m, i) => buildRow(i === 0 ? 'MS' : colorName(m.minor), m.ms, fmtPct0, fmtSignedPP1, true, i === 0));
    const table1Rows = [...volRows, ...amtRows, ...priceRows, ...msRows];

    const totalVolG = pctChange(metricsByColor[0].vol[6], metricsByColor[0].vol[7]);
    const totalAmtG = pctChange(metricsByColor[0].amt[6], metricsByColor[0].amt[7]);
    const priceByColor = metricsByColor.slice(1).map(m => ({
      name: colorName(m.minor),
      h25: m.price[6], h26: m.price[7], growthPct: pctChange(m.price[6], m.price[7]),
    }));
    const msByColor = metricsByColor.slice(1).map(m => ({ name: colorName(m.minor), h25Pct: m.ms[6], h26Pct: m.ms[7] }));

    // ---- Table 2: 국가별 수입금액 (컬러별, {prevBaseYear} vs {baseYear}, monthCap까지) ----
    const wineScoped = wine.filter(r => r.month <= monthCap && (r.year === prevBaseYear || r.year === baseYear));
    const byCountry = new Map();
    wineScoped.forEach(r => {
      if (!byCountry.has(r.country)) byCountry.set(r.country, { country: r.country, red25: 0, red26: 0, white25: 0, white26: 0, spark25: 0, spark26: 0, total25: 0, total26: 0 });
      const c = byCountry.get(r.country);
      const period = r.year === prevBaseYear ? '25' : '26';
      c['total' + period] += r.value / 1e6;
      if (r.minor === '레드 와인') c['red' + period] += r.value / 1e6;
      else if (r.minor === '화이트 와인') c['white' + period] += r.value / 1e6;
      else if (r.minor === '스파클링 와인') c['spark' + period] += r.value / 1e6;
    });
    const countryAgg = [...byCountry.values()];
    const KEYS2 = ['red25', 'red26', 'white25', 'white26', 'spark25', 'spark26', 'total25', 'total26'];
    const sumAgg = (label, list) => list.reduce((acc, c) => { KEYS2.forEach(k => { acc[k] += c[k]; }); return acc; }, { country: label, red25: 0, red26: 0, white25: 0, white26: 0, spark25: 0, spark26: 0, total25: 0, total26: 0 });

    const sorted = [...countryAgg].sort((a, b) => b.total26 - a.total26);
    const topN = sorted.slice(0, 10);
    const restAgg = sumAgg('기타', sorted.slice(10));
    const allTotal = sumAgg('합계', countryAgg);
    const table2Rows = [buildRow2(allTotal, true), ...topN.map(c => buildRow2(c, false)), buildRow2(restAgg, false)];

    const gapOf = c => c.total26 - c.total25;
    const topGapCountries = [...countryAgg].sort((a, b) => gapOf(b) - gapOf(a)).slice(0, 5)
      .map(c => ({ country: c.country, gap: gapOf(c), growthPct: pctChange(c.total25, c.total26) }));
    const bottomGapCountries = [...countryAgg].sort((a, b) => gapOf(a) - gapOf(b)).slice(0, 5)
      .map(c => ({ country: c.country, gap: gapOf(c), growthPct: pctChange(c.total25, c.total26) }));
    const totalGap = gapOf(allTotal);

    const colorKeys = [['red', '레드'], ['white', '화이트'], ['spark', '스파클링']];
    const countryColorGaps = [];
    countryAgg.forEach(c => {
      colorKeys.forEach(([k, label]) => {
        countryColorGaps.push({ country: c.country, color: label, gap: c[k + '26'] - c[k + '25'] });
      });
    });
    countryColorGaps.sort((a, b) => a.gap - b.gap);
    const worstCountryColor = countryColorGaps[0];
    const bestCountryColorSameColor = countryColorGaps
      .filter(x => x.color === worstCountryColor.color && x.country !== worstCountryColor.country)
      .sort((a, b) => b.gap - a.gap)[0];

    // Compact stats payload for the Gemini insights route (kept small so the prompt stays cheap).
    const stats = {
      period: latestPeriod.year + '.' + pad2(latestPeriod.month),
      기준연도: baseYear,
      비교대상: (isLatestYear ? ('1~' + monthCap + '월 YTD') : '연간(1~12월)') + ', ' + prevBaseYear + '년 vs ' + baseYear + '년',
      table1_컬러별_연간상반기: {
        totalVolumeGrowthPct: Number(totalVolG.toFixed(1)),
        totalAmountGrowthPct: Number(totalAmtG.toFixed(1)),
        totalVolumeH25: Number(metricsByColor[0].vol[6].toFixed(1)),
        totalVolumeH26: Number(metricsByColor[0].vol[7].toFixed(1)),
        totalAmountH25: Number(metricsByColor[0].amt[6].toFixed(1)),
        totalAmountH26: Number(metricsByColor[0].amt[7].toFixed(1)),
        priceByColor: priceByColor.map(p => ({ color: p.name, priceH25: Number(p.h25.toFixed(1)), priceH26: Number(p.h26.toFixed(1)), growthPct: Number(p.growthPct.toFixed(1)) })),
        marketShareByColor: msByColor.map(m => ({ color: m.name, shareH25Pct: Number(m.h25Pct.toFixed(1)), shareH26Pct: Number(m.h26Pct.toFixed(1)) })),
      },
      table2_국가별_수입금액: {
        totalGapM: Number(totalGap.toFixed(1)),
        topGrowthCountries: topGapCountries.map(c => ({ country: c.country, gapM: Number(c.gap.toFixed(1)), growthPct: Number(c.growthPct.toFixed(1)) })),
        topDeclineCountries: bottomGapCountries.map(c => ({ country: c.country, gapM: Number(c.gap.toFixed(1)), growthPct: Number(c.growthPct.toFixed(1)) })),
        worstCountryColor: worstCountryColor ? { country: worstCountryColor.country, color: worstCountryColor.color, gapM: Number(worstCountryColor.gap.toFixed(1)) } : null,
        absorbingCountrySameColor: bestCountryColorSameColor ? { country: bestCountryColorSameColor.country, color: bestCountryColorSameColor.color, gapM: Number(bestCountryColorSameColor.gap.toFixed(1)) } : null,
      },
    };

    return { dataSourceLabel, table1Rows, table2Rows, stats, YEARS1, prevBaseYear, baseYear, isLatestYear, monthCap, periodLabel, periodLabelWide };
  }, [snapshot, baseYear]);

  useEffect(() => {
    if (!computed) return;
    setBullets(null);
    setBulletsError(null);
    fetch('/api/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(computed.stats),
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) { setBulletsError(data.error); return; }
        setBullets(data);
      })
      .catch(e => setBulletsError(e.message));
  }, [computed]);

  if (error) return <div style={{ padding: 32 }}>데이터를 불러오지 못했습니다: {error}</div>;
  if (!computed) return <div style={{ padding: 32 }}>불러오는 중…</div>;

  const bulletText = (key) => {
    if (bullets) return bullets[key];
    if (bulletsError) return '(Gemini 인사이트 생성 실패: ' + bulletsError + ')';
    return '인사이트 생성 중…';
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)', paddingBottom: 64 }}>
      <div className="nav" style={{ padding: '14px 32px' }}>
        <div className="nav-brand">국내 수입 주류 대시보드 · 와인 컬러 리포트</div>
        <span className="tag tag-outline" style={{ marginLeft: 14, marginRight: 'auto' }}>{computed.dataSourceLabel}</span>
        <a href="/" className="btn btn-secondary" style={{ textDecoration: 'none', fontSize: 13 }}>← 전체 주류 보기</a>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 24 }}>
          <span className="text-muted" style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>기준연도</span>
          <div className="seg" style={{ flexWrap: 'wrap' }}>
            {availableYears.map(y => (
              <button key={y} type="button" className="seg-opt" style={{ border: 'none', ...segStyle(baseYear === y) }} onClick={() => setBaseYear(y)}>{y}년</button>
            ))}
          </div>
          <span className="text-muted" style={{ fontSize: 11 }}>
            · {computed.isLatestYear ? ('1~' + computed.monthCap + '월 YTD') : '연간(1~12월)'} 기준 {computed.prevBaseYear}년 vs {computed.baseYear}년 비교
          </span>
        </div>

        <div className="card elev-sm" style={{ padding: 24, marginTop: 16 }}>
          <h2 style={{ margin: '0 0 14px', paddingBottom: 10, borderBottom: '4px solid #111', fontSize: 19 }}>국내 와인 수입_컬러_연간 및 상반기 비교</h2>
          <div style={{ fontSize: 13, lineHeight: 2, marginBottom: 10 }}>
            <div>➢ {bulletText('t1Bullet1')}</div>
            <div>➢ {bulletText('t1Bullet2')}</div>
          </div>
          <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>와인 수입 추이</div>
          <div className="text-muted" style={{ fontSize: 11, marginBottom: 8 }}>[단위: 백만 리터, 백만 달러]</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="rpt-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>구분</th>
                  {computed.YEARS1.map(y => <th key={y}>Y{yy(y)}</th>)}
                  <th style={{ background: 'var(--color-accent-100)' }}>{computed.periodLabel(computed.prevBaseYear)}</th>
                  <th style={{ background: 'var(--color-accent-100)', boxShadow: 'inset 0 0 0 1.5px #dc2626' }}>{computed.periodLabel(computed.baseYear)}</th>
                  <th style={{ background: 'var(--color-accent-100)' }}>vs YoY</th>
                  <th style={{ background: 'var(--color-accent-100)' }}>Growth</th>
                </tr>
              </thead>
              <tbody>
                {computed.table1Rows.map((row, i) => (
                  <tr key={i} style={row.bold ? { background: 'var(--color-neutral-100)' } : {}}>
                    <td style={{ padding: '6px 10px', fontWeight: row.bold ? 700 : 400, fontStyle: row.bold ? 'normal' : 'italic' }}>{row.label}</td>
                    {row.cells.map((c, j) => <td key={j} style={c.style}>{c.text}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ textAlign: 'right', fontSize: 10.5, fontStyle: 'italic', color: 'var(--color-neutral-600)', marginTop: 8 }}>※ 출처: 관세청 수출입무역통계</div>
        </div>

        <div className="card elev-sm" style={{ padding: 24, marginTop: 16 }}>
          <h2 style={{ margin: '0 0 14px', paddingBottom: 10, borderBottom: '4px solid #111', fontSize: 19 }}>국내 와인 수입_국가별 수입금액</h2>
          <div style={{ fontSize: 13, lineHeight: 2, marginBottom: 10 }}>
            <div>➢ {bulletText('t2Bullet1')}</div>
            <div>➢ {bulletText('t2Bullet2')}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>국가별 수입 금액 추이</div>
            <div className="text-muted" style={{ fontSize: 11, marginBottom: 8 }}>[단위: 백만 달러]</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="rpt-table">
              <thead>
                <tr>
                  <th rowSpan={2} style={{ textAlign: 'left' }}>구분</th>
                  <th colSpan={4}>{computed.periodLabelWide(computed.prevBaseYear)}</th>
                  <th colSpan={4}>{computed.periodLabelWide(computed.baseYear)}</th>
                  <th colSpan={4}>YoY Gap</th>
                  <th colSpan={4}>GRW%</th>
                </tr>
                <tr>
                  {TABLE2_SUBHEADERS.map((h, i) => (
                    <th key={i} style={h.total ? { background: 'var(--color-neutral-200)' } : undefined}>{h.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {computed.table2Rows.map((row, i) => (
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
      </div>
    </div>
  );
}
