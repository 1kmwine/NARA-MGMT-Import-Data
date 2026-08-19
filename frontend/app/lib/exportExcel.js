import * as XLSX from 'xlsx';

const pad2 = n => String(n).padStart(2, '0');
const fmtDate = d => d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate());

function sheet(aoa, merges) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  if (merges && merges.length) ws['!merges'] = merges;
  return ws;
}

// 국가별 수입 표는 CountryReportCard에서 그대로 넘어온 헤더 그룹(구분 없이 4구간 ×
// cols) + 행 데이터를 병합 셀로 재구성한다 — 화면에 보이는 표와 동일하게.
function countryTableSheet(ct) {
  const header1 = ['구분'];
  const merges = [{ s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }];
  let col = 1;
  ct.groups.forEach(g => {
    header1.push(g.label, ...Array(g.span - 1).fill(''));
    merges.push({ s: { r: 0, c: col }, e: { r: 0, c: col + g.span - 1 } });
    col += g.span;
  });
  const header2 = ['', ...ct.subHeader];
  const aoa = [header1, header2, ...ct.rows.map(r => [r.label, ...r.cells])];
  return sheet(aoa, merges);
}

export function exportExcel({ meta, sections }, selected) {
  const wb = XLSX.utils.book_new();

  if (selected.kpi && sections.kpi) {
    const aoa = [['지표', '값', '증감(YoY)', '비고']];
    sections.kpi.forEach(k => aoa.push([k.label, k.value, k.deltaText, k.sub]));
    XLSX.utils.book_append_sheet(wb, sheet(aoa), 'KPI 요약');
  }

  if (selected.trend && sections.trend) {
    const aoa = [['연도', '수입액', '수입액 YoY', '수입중량', '수입중량 YoY']];
    sections.trend.yearSummary.forEach(y => aoa.push([y.yearLabel, y.valueDisplay, y.valueYoyText, y.volumeDisplay, y.volumeYoyText]));
    aoa.push([]);
    const ml = sections.trend.monthly.labels, mv = sections.trend.monthly.volumeLabels;
    if (ml.length) {
      aoa.push(['월별 (금액: 백만달러 / 중량: milL)']);
      aoa.push(['월', ...ml.map(m => m.monthLabel)]);
      aoa.push(['금액', ...ml.map(m => m.text)]);
      aoa.push(['중량', ...mv.map(m => m.text)]);
    }
    XLSX.utils.book_append_sheet(wb, sheet(aoa), '월별 수입 추이');
  }

  if (selected.ranking && sections.ranking) {
    const aoa = [['국가', '값', 'YoY']];
    sections.ranking.forEach(r => aoa.push([r.name, r.valueDisplay, r.yoyText]));
    XLSX.utils.book_append_sheet(wb, sheet(aoa), '국가별 순위');
  }

  if (selected.composition && sections.composition) {
    const years = sections.composition.years;
    const labels = years[0] ? years[0].segments.map(s => s.label) : [];
    const aoa = [['항목', ...years.map(y => y.year + '년')]];
    labels.forEach((label, i) => aoa.push([label, ...years.map(y => (y.segments[i] ? y.segments[i].valueDisplay : ''))]));
    XLSX.utils.book_append_sheet(wb, sheet(aoa), (sections.composition.title || '비중').slice(0, 28));
  }

  if (selected.countryTable && sections.countryTable) {
    XLSX.utils.book_append_sheet(wb, countryTableSheet(sections.countryTable), '국가별 수입표');
  }

  if (!wb.SheetNames.length) return;
  XLSX.writeFile(wb, (meta.fileBase || '수입데이터') + '_' + fmtDate(meta.generatedAt) + '.xlsx');
}
