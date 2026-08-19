'use client';

import { useMemo, useRef, useState } from 'react';
import { sumField, pctDiff, deltaMeta, trendDelta, fmtMoney, fmtVolumeML, fmtUnitPrice, segStyle, shortMinorLabel, formatMonthRange } from './lib/format';
import { Button } from './components/Button';
import { StackedBarChart } from './components/StackedBarChart';
import { CHART_PALETTE } from './components/PieChart';
import { ExportModal } from './components/ExportModal';
import { BASE_PATH } from './lib/config';
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
    const monthSuffix = selMonthsNum.length ? (' · ' + formatMonthRange(selMonthsNum)) : '';

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
    // YTD only means "year to date" for the current (incomplete) data year.
    // A completed past year selected as the top year should compare the full
    // year, not be cut at the current year's latest month.
    const isCurrentTopYear = topYear === latestPeriod.year;
    const ytdCap = isCurrentTopYear ? latestMonth : 12;
    const ytdCurMonthsRaw = kpiCurMonths.filter(m => m.month <= ytdCap);
    const ytdPrevMonthsRaw = kpiPrevMonths.filter(m => m.month <= ytdCap);
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
        return { name: shortMinorLabel(mn.minor, '와인'), priceDisplay, yoyText: d.text, yoyColor: d.color };
      });
    })() : null;

    // "YTD" only for the current year; a past full year says 연간, a month
    // selection names the picked range.
    const growthSubLabel = selMonthsNum.length
      ? formatMonthRange(selMonthsNum) + ' 성장률'
      : (isCurrentTopYear ? 'YTD 성장률' : '연간 성장률');
    const kpis = [
      { label: '수입액 · ' + periodTag, value: fmtMoney(curValue), deltaText: dV.text + ' YoY', deltaColor: dV.color, sub: growthSubLabel + ' ' + dYtdV.text + ' · ' + (s.major === 'all' ? '전체 주류' : s.major) + ' 기준' },
      { label: '수입중량 · ' + periodTag, value: fmtVolumeML(curVolume), deltaText: dVol.text + ' YoY', deltaColor: dVol.color, sub: growthSubLabel + ' ' + dYtdVol.text + ' · ' + (s.major === 'all' ? '전체 주류' : s.major) + ' 기준' },
      { label: '평균 수입단가', value: priceBreakdown ? fmtUnitPrice(curPrice).replace('/kg', '/L') : fmtUnitPrice(curPrice), deltaText: dP.text + ' YoY', deltaColor: dP.color, sub: priceBreakdown ? 'L당 단가' : 'kg당 단가', priceBreakdown },
      { label: '전체 주류 대비 포도주 비중', value: curShare.toFixed(1) + '%', deltaText: shareDelta.text, deltaColor: shareDelta.color, sub: '수입액 기준' },
    ];

    const yearsToShow = selYearsNum.length ? selYearsNum : [topYear - 1, topYear];
    const filtered = rows.filter(r => matchesFilter(r) && (!s.country || r.countryId === s.country));
    const inSelMonths = m => !selMonthsNum.length || selMonthsNum.includes(m);
    const monthsInScope = monthsList.filter(m => yearsToShow.includes(m.year) && inSelMonths(m.month));
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
    // On-chart per-month value labels. Shown for every point in monthsInScope
    // (which already excludes months without data — so this is "값이 있을 경우").
    // i/xFrac let the chart hover bold the matching month.
    const monthLabelOf = m => 'Y' + String(m.year).slice(-2) + ' M' + pad2(m.month);
    const trendValueLabels = monthsInScope.map((m, i) => ({ i, monthLabel: monthLabelOf(m), xFrac: xAt(i) / 860, left: pctX(xAt(i)), top: pctY(yValueAt(i) + (dirLabel(valuePerMonth, i) ? -8 : 14)), text: shortMoney(valuePerMonth[i]) }));
    const trendVolumeLabels = monthsInScope.map((m, i) => ({ i, left: pctX(xAt(i)), top: pctY(yVolumeAt(i) + (dirLabel(volumePerMonth, i) ? -8 : 14)), text: shortVolume(volumePerMonth[i]) }));
    const trendXLabels = monthsInScope.map((m, i) => ({ left: pctX(xAt(i)), month: labelMonths.includes(m.month) ? 'M' + pad2(m.month) : false, year: m.month === 1 || i === 0 ? 'Y' + String(m.year).slice(-2) : false }));

    const trendYearSummary = yearsToShow.map(y => {
      const isCurrent = y === topYear;
      const monthCap = isCurrent ? latestMonth : 12;
      // 월을 고르면 그 달들만 합산(연/월 연동), 아니면 기존 YTD(현재연도) / 연간(과거연도).
      const inScope = m => selMonthsNum.length ? selMonthsNum.includes(m) : m <= monthCap;
      const curYearRows = filtered.filter(r => r.year === y && inScope(r.month));
      const prevYearRows = filtered.filter(r => r.year === y - 1 && inScope(r.month));
      const curV = sumField(curYearRows, 'value'), prevV = sumField(prevYearRows, 'value');
      const curQ = sumField(curYearRows, 'volume'), prevQ = sumField(prevYearRows, 'volume');
      const vDelta = trendDelta(prevV ? pctDiff(curV, prevV) : null);
      const qDelta = trendDelta(prevQ ? pctDiff(curQ, prevQ) : null);
      const periodTag = selMonthsNum.length ? ' · ' + formatMonthRange(selMonthsNum) : (isCurrent ? ' · ' + monthCap + '월 YTD' : '');
      return {
        year: y,
        yearLabel: y + '년' + periodTag,
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

    // 중구분(또는 대구분) 구성을 연도별로 비교하는 스택드바 데이터.
    // 국가/월 필터는 반영하되, 중구분 선택은 반영하지 않는다 — 이 차트 자체가
    // 중구분 구성을 보여주는 게 목적이라 특정 중구분으로 좁히면 무의미해진다.
    const compGroupField = s.major === 'all' ? 'major' : 'minor';
    const compItemsRaw = s.major === 'all' ? MAJORS.map(m => m.major) : (MAJORS.find(m => m.major === s.major)?.minors.map(mn => mn.minor) || []);
    const compBaseRows = rows.filter(r =>
      (s.major === 'all' || r.major === s.major) &&
      (!s.country || r.countryId === s.country) &&
      (!selMonthsNum.length || selMonthsNum.includes(r.month))
    );
    const compTotals = new Map(compItemsRaw.map(item => [item, sumField(compBaseRows.filter(r => r[compGroupField] === item), 'value')]));
    const compItemsOrdered = [...compItemsRaw].sort((a, b) => compTotals.get(b) - compTotals.get(a));
    const compData = yearsToShow.map(y => {
      const yearRows = compBaseRows.filter(r => r.year === y);
      const yearTotal = sumField(yearRows, 'value');
      const segments = compItemsOrdered.map((item, i) => {
        const val = sumField(yearRows.filter(r => r[compGroupField] === item), 'value');
        const pct = yearTotal ? Math.round(val / yearTotal * 100) : 0;
        return { label: s.major === 'all' ? item : shortMinorLabel(item, s.major), value: val, color: CHART_PALETTE[i % CHART_PALETTE.length], valueDisplay: pct + '%' };
      });
      return { year: y, segments };
    });
    const compTitle = (s.major === 'all' ? '주종별' : s.major + ' · 세부 주종') + ' 비중';

    // 와인을 맨 앞에 고정하고 나머지는 원래 순서(수입액 내림차순) 유지 — 드롭다운이라
    // 전부 목록에 담으면 되므로 예전 8개+'···' 오버플로우 분리는 필요 없다.
    const majorsWineFirst = [...MAJORS].sort((a, b) => (a.major === '와인' ? -1 : b.major === '와인' ? 1 : 0));
    const majorOpts = [{ id: 'all', label: '전체' }, ...majorsWineFirst.map(m => ({ id: m.major, label: m.major }))];
    const activeMajorDef = s.major !== 'all' ? MAJORS.find(m => m.major === s.major) : null;
    const minorOptsBase = activeMajorDef ? [{ id: 'all', label: '전체' }, ...activeMajorDef.minors.map(mn => ({ id: mn.minor, label: mn.minor }))] : null;

    return {
      dataSourceLabel, windowLabel, kpis, trendValueLine, trendVolumeLine, trendValueLabels, trendVolumeLabels, trendXLabels, trendYearSummary, trendAxisY: axisY,
      rankingBars, compData, compTitle,
      majorOpts, minorOptsBase,
      topYear, kpiMaxM, latestYear: latestPeriod.year, selMonthsNum,
      reportCurRows: kpiCurRowsAll.filter(r => s.major === 'all' || r.major === s.major),
      reportPrevRows: kpiPrevRowsAll.filter(r => s.major === 'all' || r.major === s.major),
    };
  }, [rows, monthsList, COUNTRIES, MAJORS, major, minor, selectedYears, selectedMonths, metric, country, showAll]);

  const monthOptsBase = [{ id: 'all', label: '전체' }, ...Array.from({ length: 12 }, (_, i) => i + 1).map(m => ({ id: String(m), label: m + '월' }))];

  const [exportOpen, setExportOpen] = useState(false);
  const countryCardRef = useRef(null);

  // 내보내기 라이브러리(xlsx/pptxgenjs)는 크기가 있어 실제로 내보내기 누를 때만
  // 로드한다. PPT의 차트는 이미지가 아니라 파워포인트 네이티브 차트로 만들기
  // 때문에(exportPptx.js) 여기서는 화면 렌더값 그대로 숫자 데이터만 넘기면 된다.
  const fetchInsight = async (stats) => {
    try {
      const res = await fetch(BASE_PATH + '/api/insights', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stats }),
      });
      const data = await res.json();
      return data.error ? null : data;
    } catch {
      return null;
    }
  };

  const handleExport = async (format, selected) => {
    // 상단 ➢ 2줄 인사이트는 PPT 헤드라인용 — 엑셀엔 안 붙인다(Gemini 안 부름).
    // 국가별 표는 화면에 이미 생성돼 있는 걸 그대로 씀(ref), 추이는 export 시점에
    // 새로 생성(같은 /api/insights, 서버 24h 캐시라 같은 통계면 재호출 안 됨).
    let trendInsight = null;
    if (format === 'pptx' && selected.trend) {
      trendInsight = await fetchInsight({
        지표: '수입액·수입중량',
        비교대상: v.windowLabel,
        연도별: v.trendYearSummary.map(y => ({
          연도: y.yearLabel, 수입액: y.valueDisplay, 수입액_YoY: y.valueYoyText,
          수입중량: y.volumeDisplay, 수입중량_YoY: y.volumeYoyText,
        })),
      });
    }
    const bundle = {
      meta: { fileBase: '수입데이터', period: v.windowLabel, generatedAt: new Date() },
      sections: {
        kpi: v.kpis,
        trend: { yearSummary: v.trendYearSummary, monthly: { labels: v.trendValueLabels, volumeLabels: v.trendVolumeLabels }, insight: trendInsight },
        ranking: v.rankingBars,
        composition: { title: v.compTitle, years: v.compData },
        countryTable: selected.countryTable ? countryCardRef.current?.getExportData() : null,
      },
    };
    if (format === 'excel') {
      const { exportExcel } = await import('./lib/exportExcel');
      exportExcel(bundle, selected);
    } else {
      const { exportPptx } = await import('./lib/exportPptx');
      exportPptx(bundle, selected);
    }
    setExportOpen(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)', paddingBottom: 64 }}>
      <div className="nav" style={{ padding: '14px 32px' }}>
        <div className="nav-brand">국내 수입 주류 대시보드 · 전체</div>
        <span className="tag tag-outline" style={{ marginLeft: 14 }}>{v.dataSourceLabel}</span>
        <div style={{ flex: 1 }} />
        {updateMessage && <span className="text-muted" style={{ fontSize: 11 }}>{updateMessage}</span>}
        <Button variant="secondary" size="sm" style={{ fontSize: 12, lineHeight: 1.4, fontWeight: 500 }} onClick={() => setExportOpen(true)}>내보내기</Button>
        <div className="seg">
          <button type="button" className="seg-opt" style={{ border: 'none', ...segStyle(false) }} onClick={triggerForceUpdate} disabled={isUpdating}>
            {isUpdating ? '갱신 중…' : '강제 업데이트'}
          </button>
        </div>
      </div>

      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} onExport={handleExport} />

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px' }}>

        <div style={{ display: 'flex', gap: 20, rowGap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
          <FilterDropdown
            label="연도" multi
            options={YEARS_ALL.map(y => ({ id: String(y), label: y + '년' }))}
            isSelected={id => selectedYears.includes(id)}
            onPick={toggleYear}
            summary={!selectedYears.length ? '없음' : selectedYears.length === YEARS_ALL.length ? '전체' : selectedYears.join(', ')}
          />
          <FilterDropdown
            label="월" multi
            options={monthOptsBase}
            isSelected={id => (id === 'all' ? !selectedMonths.length : selectedMonths.includes(id))}
            onPick={toggleMonth}
            summary={!selectedMonths.length ? '전체' : formatMonthRange(selectedMonths.map(Number))}
          />
          <FilterDropdown
            label="주종"
            options={v.majorOpts}
            isSelected={id => major === id}
            onPick={id => { setMajor(id); setMinor(null); }}
            summary={major === 'all' ? '전체' : major}
          />
          {v.minorOptsBase && (
            <FilterDropdown
              label="세부 주종"
              options={v.minorOptsBase}
              isSelected={id => (minor || 'all') === id}
              onPick={id => setMinor(id === 'all' ? null : id)}
              summary={minor ? shortMinorLabel(minor, major) : '전체'}
            />
          )}
          {country && (
            <span className="tag tag-accent" style={{ cursor: 'pointer' }} onClick={() => setCountry(null)}>{COUNTRIES.find(c => c.id === country)?.name} ✕</span>
          )}
        </div>

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
            <h3 style={{ margin: '0 0 4px' }}>{v.compTitle}</h3>
            <div className="text-muted" style={{ fontSize: 11, marginBottom: 14 }}>금액 기준</div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <StackedBarChart data={v.compData} normalize />
            </div>
          </div>
        </div>

        <CountryReportCard
          ref={countryCardRef}
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

function FilterDropdown({ label, options, isSelected, onPick, summary, multi }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span className="text-muted" style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0 }}>{label}</span>
      <div style={{ position: 'relative' }}>
        <button
          type="button" className="btn btn-secondary"
          style={{ minWidth: 150, justifyContent: 'space-between', gap: 8, fontWeight: 500 }}
          onClick={() => setOpen(o => !o)}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary}</span>
          <span aria-hidden style={{ fontSize: 10, opacity: 0.55 }}>▾</span>
        </button>
        {open && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 19 }} onClick={() => setOpen(false)} />
            <div className="card elev-sm" style={{ position: 'absolute', top: '110%', left: 0, zIndex: 20, padding: 6, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 170, maxHeight: 300, overflowY: 'auto' }}>
              {options.map(opt => {
                const on = isSelected(opt.id);
                return (
                  <button
                    key={opt.id} type="button" className="seg-opt"
                    style={{ border: 'none', justifyContent: 'flex-start', gap: 8, whiteSpace: 'nowrap', ...segStyle(on) }}
                    onClick={() => { onPick(opt.id); if (!multi) setOpen(false); }}
                  >
                    <span style={{ width: 14, flexShrink: 0, opacity: on ? 1 : 0 }}>✓</span>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TrendCard({ v }) {
  const labels = v.trendValueLabels;
  const [hovered, setHovered] = useState(null);

  const onChartMove = (e) => {
    if (!labels.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    let best = 0, bestD = Infinity;
    labels.forEach((p) => { const d = Math.abs(p.xFrac - frac); if (d < bestD) { bestD = d; best = p.i; } });
    setHovered(best);
  };

  const hoveredX = hovered != null && labels[hovered] ? labels[hovered].xFrac * 860 : null;

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
      <div style={{ position: 'relative' }} onMouseMove={onChartMove} onMouseLeave={() => setHovered(null)}>
        <svg viewBox="0 0 860 280" style={{ width: '100%', height: 'auto', display: 'block' }} xmlns="http://www.w3.org/2000/svg">
          <line x1="64" x2="844" y1={v.trendAxisY} y2={v.trendAxisY} stroke="var(--color-divider)" strokeWidth="1" />
          {hoveredX != null && (
            <line x1={hoveredX} x2={hoveredX} y1="40" y2={v.trendAxisY} stroke="var(--color-neutral-400)" strokeWidth="1" strokeDasharray="3 3" />
          )}
          <polyline points={v.trendValueLine} fill="none" stroke="var(--color-accent-600)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          <polyline points={v.trendVolumeLine} fill="none" stroke="var(--color-neutral-400)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {v.trendValueLabels.map((lb) => (
            <div key={'v' + lb.i} style={{ position: 'absolute', left: lb.left, top: lb.top, transform: 'translate(-50%,-50%)', fontSize: hovered === lb.i ? 12.5 : 11, fontWeight: hovered === lb.i ? 800 : 500, color: 'var(--color-accent-700)', whiteSpace: 'nowrap' }}>{lb.text}</div>
          ))}
          {v.trendVolumeLabels.map((lb) => (
            <div key={'q' + lb.i} style={{ position: 'absolute', left: lb.left, top: lb.top, transform: 'translate(-50%,-50%)', fontSize: hovered === lb.i ? 12.5 : 11, fontWeight: hovered === lb.i ? 800 : 500, color: 'var(--color-neutral-600)', whiteSpace: 'nowrap' }}>{lb.text}</div>
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
