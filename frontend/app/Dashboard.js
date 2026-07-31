'use client';

import { useMemo, useState } from 'react';
import { sumField, pctDiff, deltaMeta, trendDelta, fmtMoney, fmtVolumeML, fmtUnitPrice, segStyle } from './lib/format';
import { Button } from './components/Button';
import { PieChart } from './components/PieChart';
import CountryReportCard from './CountryReportCard';

const YEARS_ALL = [2026, 2025, 2024, 2023, 2022];

export default function Dashboard({ rows, monthsList, COUNTRIES, MAJORS, apiBase }) {
  const [major, setMajor] = useState('와인');
  const [minor, setMinor] = useState(null);
  const [selectedYears, setSelectedYears] = useState(['2022', '2023', '2024', '2025', '2026']);
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [metric, setMetric] = useState('value');
  const [country, setCountry] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState(null);

  const toggleYear = (id) => setSelectedYears(cur => cur.includes(id) ? cur.filter(y => y !== id) : [...cur, id].sort());
  const toggleMonth = (id) => {
    if (id === 'all') { setSelectedMonths([]); return; }
    setSelectedMonths(cur => cur.includes(id) ? cur.filter(m => m !== id) : [...cur, id].sort((a, b) => Number(a) - Number(b)));
  };
  const toggleCountry = (id) => setCountry(cur => (cur === id ? null : id));

  const triggerForceUpdate = () => {
    if (isUpdating) return;
    setIsUpdating(true);
    setUpdateMessage(null);
    fetch(apiBase + '/api/reload-recent-month', { method: 'POST', cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        setIsUpdating(false);
        setUpdateMessage('갱신 완료 (' + data.rows + '행) · 새로고침 중…');
        setTimeout(() => location.reload(), 1000);
      })
      .catch(err => {
        setIsUpdating(false);
        setUpdateMessage('갱신 실패: ' + err.message);
      });
  };

  const v = useMemo(() => {
    const s = { major, minor, selectedYears, selectedMonths, metric, country, showAll };
    const pad2 = n => String(n).padStart(2, '0');
    const latestPeriod = monthsList[monthsList.length - 1];
    const dataSourceLabel = '관세청 수출입무역통계(nitemtrade) · ' + latestPeriod.year + '.' + pad2(latestPeriod.month) + ' 기준';

    const keysOf = list => new Set(list.map(m => m.key));
    const selYearsNum = (s.selectedYears || []).map(Number).sort((a, b) => a - b);
    const selMonthsNum = (s.selectedMonths || []).map(Number);
    const monthSuffix = selMonthsNum.length ? (' · ' + selMonthsNum.map(m => m + '월').join(',')) : '';

    const topYear = selYearsNum.length ? Math.max(...selYearsNum) : monthsList[monthsList.length - 1].year;
    const windowLabel = topYear + '년' + monthSuffix;
    const kpiCurMonthsBase = monthsList.filter(m => m.year === topYear);
    const kpiMaxM = kpiCurMonthsBase.length ? kpiCurMonthsBase[kpiCurMonthsBase.length - 1].month : 12;
    const kpiPrevMonthsBase = monthsList.filter(m => m.year === topYear - 1 && m.month <= kpiMaxM);
    const kpiCurMonths = selMonthsNum.length ? kpiCurMonthsBase.filter(m => selMonthsNum.includes(m.month)) : kpiCurMonthsBase;
    const kpiPrevMonths = selMonthsNum.length ? kpiPrevMonthsBase.filter(m => selMonthsNum.includes(m.month)) : kpiPrevMonthsBase;
    const kpiCurKeys = keysOf(kpiCurMonths), kpiPrevKeys = keysOf(kpiPrevMonths);
    const kpiCurRowsAll = rows.filter(r => kpiCurKeys.has(r.key));
    const kpiPrevRowsAll = rows.filter(r => kpiPrevKeys.has(r.key));

    const curValueAll = sumField(kpiCurRowsAll, 'value'), prevValueAll = sumField(kpiPrevRowsAll, 'value');
    const curWineAll = sumField(kpiCurRowsAll.filter(r => r.major === '와인'), 'value');
    const prevWineAll = sumField(kpiPrevRowsAll.filter(r => r.major === '와인'), 'value');
    const curShare = curValueAll ? curWineAll / curValueAll * 100 : 0;
    const prevShare = prevValueAll ? prevWineAll / prevValueAll * 100 : 0;
    const shareDiff = curShare - prevShare;
    const shareDelta = { text: (shareDiff >= 0 ? '▲ +' : '▼ ') + Math.abs(shareDiff).toFixed(1) + 'pp YoY', color: shareDiff >= 0 ? 'var(--color-accent-700)' : 'var(--color-neutral-700)' };

    const matchesFilter = r => (s.major === 'all' || r.major === s.major) && (!s.minor || r.minor === s.minor);
    const kpiCurRows = kpiCurRowsAll.filter(matchesFilter);
    const kpiPrevRows = kpiPrevRowsAll.filter(matchesFilter);

    const latestMonth = monthsList[monthsList.length - 1].month;
    const ytdCurMonthsRaw = kpiCurMonths.filter(m => m.month <= latestMonth);
    const ytdPrevMonthsRaw = kpiPrevMonths.filter(m => m.month <= latestMonth);
    const ytdCurMonths = ytdCurMonthsRaw.length ? ytdCurMonthsRaw : kpiCurMonths;
    const ytdPrevMonths = ytdPrevMonthsRaw.length ? ytdPrevMonthsRaw : kpiPrevMonths;
    const ytdKeys = keysOf(ytdCurMonths), ytdPrevKeys = keysOf(ytdPrevMonths);
    const ytdCurRows = rows.filter(r => ytdKeys.has(r.key) && matchesFilter(r));
    const ytdPrevRows = rows.filter(r => ytdPrevKeys.has(r.key) && matchesFilter(r));

    const basisCurRows = kpiCurRows, basisPrevRows = kpiPrevRows;
    const periodTag = topYear + '년' + monthSuffix;
    const curValue = sumField(basisCurRows, 'value'), prevValue = sumField(basisPrevRows, 'value');
    const curVolume = sumField(basisCurRows, 'volume'), prevVolume = sumField(basisPrevRows, 'volume');
    const curPrice = curVolume ? curValue / curVolume : 0, prevPrice = prevVolume ? prevValue / prevVolume : 0;
    const dV = deltaMeta(pctDiff(curValue, prevValue));
    const dVol = deltaMeta(pctDiff(curVolume, prevVolume));
    const dP = deltaMeta(pctDiff(curPrice, prevPrice));

    const ytdCurValue = sumField(ytdCurRows, 'value'), ytdPrevValue = sumField(ytdPrevRows, 'value');
    const ytdCurVolume = sumField(ytdCurRows, 'volume'), ytdPrevVolume = sumField(ytdPrevRows, 'volume');
    const dYtdV = deltaMeta(pctDiff(ytdCurValue, ytdPrevValue));
    const dYtdVol = deltaMeta(pctDiff(ytdCurVolume, ytdPrevVolume));

    const priceBreakdown = (s.major === '와인' && !s.minor) ? (() => {
      const majorDef = MAJORS.find(m => m.major === '와인');
      if (!majorDef) return null;
      return majorDef.minors.map(mn => {
        const curM = basisCurRows.filter(r => r.minor === mn.minor);
        const prevM = basisPrevRows.filter(r => r.minor === mn.minor);
        const curMV = sumField(curM, 'value'), curMQ = sumField(curM, 'volume');
        const prevMV = sumField(prevM, 'value'), prevMQ = sumField(prevM, 'volume');
        const curMPrice = curMQ ? curMV / curMQ : 0, prevMPrice = prevMQ ? prevMV / prevMQ : 0;
        const d = deltaMeta(pctDiff(curMPrice, prevMPrice));
        const priceDisplay = '$' + curMPrice.toFixed(1) + '/L';
        return { name: mn.minor.replace(' 와인', ''), priceDisplay, yoyText: d.text, yoyColor: d.color };
      });
    })() : null;

    const kpis = [
      { label: '수입액 · ' + periodTag, value: fmtMoney(curValue), deltaText: dV.text + ' YoY', deltaColor: dV.color, sub: 'YTD 성장률 ' + dYtdV.text + ' · ' + (s.major === 'all' ? '전체 주류' : s.major) + ' 기준' },
      { label: '수입중량 · ' + periodTag, value: fmtVolumeML(curVolume), deltaText: dVol.text + ' YoY', deltaColor: dVol.color, sub: 'YTD 성장률 ' + dYtdVol.text + ' · ' + (s.major === 'all' ? '전체 주류' : s.major) + ' 기준' },
      { label: '평균 수입단가', value: priceBreakdown ? fmtUnitPrice(curPrice).replace('/kg', '/L') : fmtUnitPrice(curPrice), deltaText: dP.text + ' YoY', deltaColor: dP.color, sub: priceBreakdown ? 'L당 단가' : 'kg당 단가', priceBreakdown },
      { label: '전체 주류 대비 포도주 비중', value: curShare.toFixed(1) + '%', deltaText: shareDelta.text, deltaColor: shareDelta.color, sub: '수입액 기준' },
    ];

    const yearsToShow = selYearsNum.length ? selYearsNum : [topYear - 1, topYear];
    const filtered = rows.filter(matchesFilter);
    const monthsInScope = monthsList.filter(m => yearsToShow.includes(m.year));
    const n = monthsInScope.length;
    const marginLeft = 64, marginRight = 16, plotTop = 40, plotH = 175;
    const plotW = 860 - marginLeft - marginRight;
    const axisY = plotTop + plotH;
    const slotW = plotW / n;
    const valuePerMonth = monthsInScope.map(m => sumField(filtered.filter(r => r.year === m.year && r.month === m.month), 'value'));
    const volumePerMonth = monthsInScope.map(m => sumField(filtered.filter(r => r.year === m.year && r.month === m.month), 'volume'));
    const minValue = Math.min(...valuePerMonth) * 0.9;
    const maxValue = Math.max(...valuePerMonth) * 1.08;
    const minVolume = Math.min(...volumePerMonth) * 0.9;
    const maxVolume = Math.max(...volumePerMonth) * 1.08;
    const valueSpan = Math.max(1, maxValue - minValue);
    const volumeSpan = Math.max(1, maxVolume - minVolume);
    const xAt = i => marginLeft + (i + 0.5) * slotW;
    const bandGap = 16;
    const bandH = (plotH - bandGap) / 2;
    const valueBandBottom = plotTop + bandH;
    const volumeBandBottom = plotTop + plotH;
    const yValueAt = i => valueBandBottom - ((valuePerMonth[i] - minValue) / valueSpan) * bandH;
    const yVolumeAt = i => volumeBandBottom - ((volumePerMonth[i] - minVolume) / volumeSpan) * bandH;
    const shortMoney = (usd) => Math.round(usd / 1e6).toString();
    const shortVolume = (kg) => (kg / 1e6).toFixed(1);

    const trendValueLine = monthsInScope.map((m, i) => xAt(i).toFixed(1) + ',' + yValueAt(i).toFixed(1)).join(' ');
    const trendVolumeLine = monthsInScope.map((m, i) => xAt(i).toFixed(1) + ',' + yVolumeAt(i).toFixed(1)).join(' ');
    const dirLabel = (arr, i) => (i === 0 ? arr[i] >= arr[1] : arr[i] >= arr[i - 1]);
    const pctX = x => (x / 860 * 100).toFixed(2) + '%';
    const pctY = y => (y / 280 * 100).toFixed(2) + '%';
    const labelMonths = [3, 6, 9, 12];
    const trendValueLabels = monthsInScope
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => m.month <= latestMonth)
      .map(({ m, i }) => ({ left: pctX(xAt(i)), top: pctY(yValueAt(i) + (dirLabel(valuePerMonth, i) ? -8 : 14)), text: shortMoney(valuePerMonth[i]) }));
    const trendVolumeLabels = monthsInScope
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => m.month <= latestMonth)
      .map(({ m, i }) => ({ left: pctX(xAt(i)), top: pctY(yVolumeAt(i) + (dirLabel(volumePerMonth, i) ? -8 : 14)), text: shortVolume(volumePerMonth[i]) }));
    const trendXLabels = monthsInScope.map((m, i) => ({ left: pctX(xAt(i)), month: labelMonths.includes(m.month) ? 'M' + pad2(m.month) : false, year: m.month === 1 || i === 0 ? 'Y' + String(m.year).slice(-2) : false }));

    const trendYearSummary = yearsToShow.map(y => {
      const isCurrent = y === topYear;
      const monthCap = isCurrent ? latestMonth : 12;
      const curYearRows = filtered.filter(r => r.year === y && r.month <= monthCap);
      const prevYearRows = filtered.filter(r => r.year === y - 1 && r.month <= monthCap);
      const curV = sumField(curYearRows, 'value'), prevV = sumField(prevYearRows, 'value');
      const curQ = sumField(curYearRows, 'volume'), prevQ = sumField(prevYearRows, 'volume');
      const vDelta = trendDelta(prevV ? pctDiff(curV, prevV) : null);
      const qDelta = trendDelta(prevQ ? pctDiff(curQ, prevQ) : null);
      return {
        year: y,
        yearLabel: y + '년' + (isCurrent ? ' · ' + monthCap + '월 YTD' : ''),
        valueDisplay: fmtMoney(curV), valueYoyText: vDelta.text, valueYoyColor: vDelta.color,
        volumeDisplay: fmtVolumeML(curQ), volumeYoyText: qDelta.text, volumeYoyColor: qDelta.color,
      };
    });

    const curRowsByMajor = kpiCurRowsAll.filter(matchesFilter);
    const prevRowsByMajor = kpiPrevRowsAll.filter(matchesFilter);
    const rankListFull = COUNTRIES.map(c => {
      const cRows = curRowsByMajor.filter(r => r.countryId === c.id), pRows = prevRowsByMajor.filter(r => r.countryId === c.id);
      return { id: c.id, name: c.name, value: sumField(cRows, 'value'), volume: sumField(cRows, 'volume'), prevValue: sumField(pRows, 'value'), prevVolume: sumField(pRows, 'volume') };
    }).sort((a, b) => b[metric] - a[metric]);
    const rankList = s.showAll ? rankListFull : rankListFull.slice(0, 10);
    const maxBar = rankListFull.length ? rankListFull[0][metric] : 1;
    const rankingBars = rankList.map(c => {
      const yoy = deltaMeta(pctDiff(c[metric], metric === 'value' ? c.prevValue : c.prevVolume));
      return {
        id: c.id, name: c.name, valueDisplay: metric === 'value' ? fmtMoney(c.value) : fmtVolumeML(c.volume),
        widthPct: maxBar ? (c[metric] / maxBar * 100) : 0,
        barColor: s.country === c.id ? 'var(--color-accent-600)' : 'var(--color-accent-300)',
        fontWeight: s.country === c.id ? 600 : 400,
        yoyText: yoy.text,
      };
    });

    const curRowsForDonut = kpiCurRowsAll.filter(r => !s.country || r.countryId === s.country);
    let donutTitle, pieData;
    if (s.major === 'all') {
      pieData = MAJORS.map(m => ({ label: m.major, value: sumField(curRowsForDonut.filter(r => r.major === m.major), 'value') }));
      donutTitle = '주종별(대구분) 비중';
    } else {
      const majorDef = MAJORS.find(m => m.major === s.major);
      const scoped = curRowsForDonut.filter(r => r.major === s.major);
      pieData = majorDef.minors.map(mn => ({ label: mn.minor, value: sumField(scoped.filter(r => r.minor === mn.minor), 'value') }));
      donutTitle = s.major + ' · 중구분 비중';
    }
    pieData = pieData.filter(d => d.value > 0).sort((a, b) => b.value - a.value);

    const majorOptsBase = [{ id: 'all', label: '전체' }, ...MAJORS.map(m => ({ id: m.major, label: m.major }))];
    const activeMajorDef = s.major !== 'all' ? MAJORS.find(m => m.major === s.major) : null;
    const minorOptsBase = activeMajorDef ? [{ id: 'all', label: '전체' }, ...activeMajorDef.minors.map(mn => ({ id: mn.minor, label: mn.minor }))] : null;

    return {
      dataSourceLabel, windowLabel, kpis, trendValueLine, trendVolumeLine, trendValueLabels, trendVolumeLabels, trendXLabels, trendYearSummary, trendAxisY: axisY,
      rankingBars, pieData, donutTitle,
      majorOptsBase, minorOptsBase,
      topYear, kpiMaxM, latestYear: latestPeriod.year, selMonthsNum,
      reportCurRows: kpiCurRowsAll.filter(r => s.major === 'all' || r.major === s.major),
      reportPrevRows: kpiPrevRowsAll.filter(r => s.major === 'all' || r.major === s.major),
    };
  }, [rows, monthsList, COUNTRIES, MAJORS, major, minor, selectedYears, selectedMonths, metric, country, showAll]);

  const monthOptsBase = [{ id: 'all', label: '전체' }, ...Array.from({ length: 12 }, (_, i) => i + 1).map(m => ({ id: String(m), label: m + '월' }))];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)', paddingBottom: 64 }}>
      <div className="nav" style={{ padding: '14px 32px' }}>
        <div className="nav-brand">국내 수입 주류 대시보드 · 전체</div>
        <span className="tag tag-outline" style={{ marginLeft: 14 }}>{v.dataSourceLabel}</span>
        <Button variant="ghost" size="sm" style={{ marginRight: 'auto' }} onClick={triggerForceUpdate} disabled={isUpdating}>
          {isUpdating ? '갱신 중…' : '강제 업데이트'}
        </Button>
        {updateMessage && <span className="text-muted" style={{ fontSize: 11 }}>{updateMessage}</span>}
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px' }}>

        <FilterRow label="연도">
          {YEARS_ALL.map(y => (
            <button key={y} type="button" className="seg-opt" style={{ border: 'none', ...segStyle(selectedYears.includes(String(y))) }} onClick={() => toggleYear(String(y))}>{y}년</button>
          ))}
        </FilterRow>

        <FilterRow label="월">
          {monthOptsBase.map(opt => (
            <button key={opt.id} type="button" className="seg-opt" style={{ border: 'none', ...segStyle(opt.id === 'all' ? !selectedMonths.length : selectedMonths.includes(opt.id)) }} onClick={() => toggleMonth(opt.id)}>{opt.label}</button>
          ))}
        </FilterRow>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
          <span className="text-muted" style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', width: 82, flexShrink: 0 }}>주종(대구분)</span>
          <div className="seg" style={{ flexWrap: 'wrap' }}>
            {v.majorOptsBase.map(opt => (
              <button key={opt.id} type="button" className="seg-opt" style={{ border: 'none', ...segStyle(major === opt.id) }} onClick={() => { setMajor(opt.id); setMinor(null); }}>{opt.label}</button>
            ))}
          </div>
          {country && (
            <span className="tag tag-accent" style={{ cursor: 'pointer' }} onClick={() => setCountry(null)}>{COUNTRIES.find(c => c.id === country)?.name} ✕</span>
          )}
        </div>

        {v.minorOptsBase && (
          <FilterRow label="중구분">
            {v.minorOptsBase.map(opt => (
              <button key={opt.id} type="button" className="seg-opt" style={{ border: 'none', ...segStyle((minor || 'all') === opt.id) }} onClick={() => setMinor(opt.id === 'all' ? null : opt.id)}>{opt.label}</button>
            ))}
          </FilterRow>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginTop: 24 }}>
          {v.kpis.map((kpi, i) => (
            <div key={i} className="card elev-sm" style={{ padding: 20 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <div>
                  <div className="card-kicker">{kpi.label}</div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 27, marginTop: 6 }}>{kpi.value}</div>
                  <div style={{ fontSize: 12, marginTop: 6, color: kpi.deltaColor }}>{kpi.deltaText}</div>
                </div>
                {kpi.priceBreakdown && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 10, marginLeft: 2, borderLeft: '1px solid var(--color-divider)', justifyContent: 'center' }}>
                    {kpi.priceBreakdown.map((pb, j) => (
                      <div key={j} style={{ fontSize: 10.5, whiteSpace: 'nowrap' }}>
                        <span className="text-muted">{pb.name}</span>
                        <span style={{ fontWeight: 600, marginLeft: 3 }}>{pb.priceDisplay}</span>
                        <span style={{ fontWeight: 600, marginLeft: 3, color: pb.yoyColor }}>{pb.yoyText}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="hr" style={{ margin: '10px 0' }} />
              <div className="text-muted" style={{ fontSize: 11, lineHeight: 1.5 }}>{kpi.sub}</div>
            </div>
          ))}
        </div>

        <TrendCard v={v} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
          <div className="card elev-sm" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <h3 style={{ margin: '0 0 4px' }}>국가별 순위</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="seg">
                  {[{ id: 'value', label: '금액' }, { id: 'volume', label: '중량' }].map(opt => (
                    <button key={opt.id} type="button" className="seg-opt" style={{ border: 'none', ...segStyle(metric === opt.id) }} onClick={() => setMetric(opt.id)}>{opt.label}</button>
                  ))}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowAll(x => !x)}>{showAll ? '상위 10개국만' : '전체 국가 보기'}</Button>
              </div>
            </div>
            <div className="text-muted" style={{ fontSize: 11, marginBottom: 14 }}>{v.windowLabel} · 클릭하여 필터링</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {v.rankingBars.map(rb => (
                <div key={rb.id} style={{ cursor: 'pointer', borderRadius: 6, padding: '4px 6px', margin: '-4px -6px' }} onClick={() => toggleCountry(rb.id)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                    <span style={{ fontWeight: rb.fontWeight }}>{rb.name}</span>
                    <span style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                      <span className="text-muted" style={{ fontSize: 11 }}>{rb.yoyText}</span>
                      <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>{rb.valueDisplay}</span>
                    </span>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: 'var(--color-surface)', overflow: 'hidden' }} title={rb.name + ': ' + rb.valueDisplay + ' (' + rb.yoyText + ')'}>
                    <div style={{ height: '100%', width: rb.widthPct + '%', background: rb.barColor, borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card elev-sm" style={{ padding: 24 }}>
            <h3 style={{ margin: '0 0 4px' }}>{v.donutTitle}</h3>
            <div className="text-muted" style={{ fontSize: 11, marginBottom: 14 }}>{v.windowLabel} · 금액 기준</div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <PieChart data={v.pieData} size={220} />
            </div>
          </div>
        </div>

        <CountryReportCard
          curRows={v.reportCurRows}
          prevRows={v.reportPrevRows}
          major={major}
          MAJORS={MAJORS}
          selMonths={v.selMonthsNum}
          topYear={v.topYear}
          kpiMaxM={v.kpiMaxM}
          latestYear={v.latestYear}
        />

        <p className="text-muted" style={{ fontSize: 11, marginTop: 20, lineHeight: 1.6 }}>
          * 데이터 출처: 관세청 품목별 수출입실적 Open API(nitemtrade, apis.data.go.kr). 금액은 USD, 중량은 kg 기준이며 관세청 발표 주기(월 1회)에 맞춰 갱신됩니다.
        </p>
      </div>
    </div>
  );
}

function FilterRow({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
      <span className="text-muted" style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', width: 82, flexShrink: 0 }}>{label}</span>
      <div className="seg" style={{ flexWrap: 'wrap' }}>{children}</div>
    </div>
  );
}

function TrendCard({ v }) {
  return (
    <div className="card elev-sm" style={{ padding: 24, marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ margin: 0 }}>월별 수입 추이</h3>
      </div>
      <div style={{ marginTop: 12, marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 8, paddingBottom: 8, borderBottom: '1px solid var(--color-divider)' }}>
          <div style={{ width: 88, flexShrink: 0 }} />
          {v.trendYearSummary.map(ys => (
            <div key={ys.year} style={{ flex: 1, minWidth: 96, fontSize: 12, fontWeight: 600 }}>{ys.yearLabel}</div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', paddingTop: 8 }}>
          <div style={{ width: 88, flexShrink: 0, fontSize: 11, color: 'var(--color-text)', opacity: 0.6 }}>수입중량</div>
          {v.trendYearSummary.map(ys => (
            <div key={ys.year} style={{ flex: 1, minWidth: 96, display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14 }}>{ys.volumeDisplay}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: ys.volumeYoyColor }}>{ys.volumeYoyText}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', paddingTop: 6 }}>
          <div style={{ width: 88, flexShrink: 0, fontSize: 11, color: 'var(--color-text)', opacity: 0.6 }}>수입액</div>
          {v.trendYearSummary.map(ys => (
            <div key={ys.year} style={{ flex: 1, minWidth: 96, display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14 }}>{ys.valueDisplay}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: ys.valueYoyColor }}>{ys.valueYoyText}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="hr" style={{ margin: '4px 0 12px' }} />
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 20, height: 3, background: 'var(--color-accent-600)', display: 'inline-block', borderRadius: 2 }} />
          <span style={{ fontSize: 12 }}>금액</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 20, height: 3, background: 'var(--color-neutral-400)', display: 'inline-block', borderRadius: 2 }} />
          <span style={{ fontSize: 12 }}>중량</span>
        </div>
      </div>
      <div style={{ position: 'relative' }}>
        <svg viewBox="0 0 860 280" style={{ width: '100%', height: 'auto', display: 'block' }} xmlns="http://www.w3.org/2000/svg">
          <line x1="64" x2="844" y1={v.trendAxisY} y2={v.trendAxisY} stroke="var(--color-divider)" strokeWidth="1" />
          <polyline points={v.trendValueLine} fill="none" stroke="var(--color-accent-600)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          <polyline points={v.trendVolumeLine} fill="none" stroke="var(--color-neutral-400)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {v.trendValueLabels.map((lb, i) => (
            <div key={'v' + i} style={{ position: 'absolute', left: lb.left, top: lb.top, transform: 'translate(-50%,-50%)', fontSize: 11, fontWeight: 600, color: 'var(--color-accent-700)', whiteSpace: 'nowrap' }}>{lb.text}</div>
          ))}
          {v.trendVolumeLabels.map((lb, i) => (
            <div key={'q' + i} style={{ position: 'absolute', left: lb.left, top: lb.top, transform: 'translate(-50%,-50%)', fontSize: 11, fontWeight: 600, color: 'var(--color-neutral-600)', whiteSpace: 'nowrap' }}>{lb.text}</div>
          ))}
          {v.trendXLabels.map((xl, i) => (
            <div key={'x' + i}>
              {xl.month && <div style={{ position: 'absolute', left: xl.left, top: '90%', transform: 'translate(-50%,-50%)', fontSize: 10, color: 'var(--color-text)', opacity: 0.7, whiteSpace: 'nowrap' }}>{xl.month}</div>}
              {xl.year && <div style={{ position: 'absolute', left: xl.left, top: '94.3%', transform: 'translate(-50%,-50%)', fontSize: 10, fontWeight: 600, color: 'var(--color-text)', opacity: 0.85, whiteSpace: 'nowrap' }}>{xl.year}</div>}
            </div>
          ))}
        </div>
      </div>
      <div className="text-muted" style={{ fontSize: 11, marginTop: 6 }}>단위 · 금액: 백만달러 / 중량: milL</div>
    </div>
  );
}
