import pptxgen from 'pptxgenjs';

// 대시보드 톤 그대로: 흰 배경 · 검정 텍스트 · 양수만 accent 파랑 · 음수만 빨강.
// (frontend/app/tokens/colors.css의 accent와 동일 계열)
const COLOR = {
  text: '1A1A1A', textSecondary: '666666', textTertiary: '999999',
  accent: '2383E2', negative: 'C0392B',
  headerBg: 'E8E8E8', totalBg: 'F0F0F0', zebra: 'F5F5F5', white: 'FFFFFF',
  border: 'DDDDDD', borderStrong: '888888', ruleBlack: '1A1A1A',
};
const CHART_BLUE_GRADIENT = ['2383E2', '5B9BE0', 'A8C8ED', 'D6E6F7'];
// 맑은 고딕: PPT 뷰어 어디서나 확실히 렌더되는 깔끔한 산세리프(Pretendard는 없을 수 있음).
const FONT = '맑은 고딕';

const pad2 = n => String(n).padStart(2, '0');
const fmtDate = d => d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate());

// 양수(+/▲)는 accent 파랑, 음수(-/▼/괄호)는 빨강, 나머지는 기본 검정.
function deltaColor(text) {
  const t = String(text ?? '').trim();
  if (t.includes('▼') || /^-/.test(t) || /^\(.*\)$/.test(t)) return COLOR.negative;
  if (t.includes('▲') || /^\+/.test(t)) return COLOR.accent;
  return COLOR.text;
}

const bold = text => ({ text, options: { bold: true, fontFace: FONT, color: COLOR.text, fontSize: 11, align: 'center' } });
const cell = (text, opts) => ({ text: String(text ?? ''), options: { fontFace: FONT, fontSize: 11, color: deltaColor(text), ...opts } });

// 제목(좌측 정렬, 굵게) + 굵은 검정 룰선 + 슬라이드 번호까지 매 슬라이드 공통.
function baseSlide(pptx, title) {
  const slide = pptx.addSlide();
  slide.background = { color: COLOR.white };
  slide.addText(title, { x: 0.4, y: 0.28, w: 9.2, h: 0.5, fontSize: 20, bold: true, color: COLOR.text, fontFace: FONT });
  slide.addShape(pptx.ShapeType.rect, { x: 0.4, y: 0.8, w: 9.2, h: 0.045, fill: { color: COLOR.ruleBlack }, line: { type: 'none' } });
  slide.slideNumber = { x: 9.55, y: 5.4, fontSize: 8, color: COLOR.textTertiary, fontFace: FONT };
  return slide;
}

// 룰선 아래 ➢ 인사이트 1~2줄(Gemini 생성) — 있으면 그린 뒤 본문 시작 y를 내려서 돌려준다.
function addInsight(slide, insight, y) {
  const lines = insight ? [insight.bullet1, insight.bullet2].filter(Boolean) : [];
  if (!lines.length) return y;
  slide.addText(
    lines.map((t, i) => ({ text: '➢ ' + t, options: { breakLine: i < lines.length - 1 } })),
    { x: 0.4, y, w: 9.2, h: 0.28 * lines.length + 0.06, fontSize: 12, color: COLOR.text, fontFace: FONT, lineSpacingMultiple: 1.25 }
  );
  return y + 0.28 * lines.length + 0.18;
}

function sectionLabel(slide, text, y, rightTag) {
  slide.addText(text, { x: 0.4, y, w: 6, h: 0.3, fontSize: 13, bold: true, color: COLOR.text, fontFace: FONT });
  if (rightTag) slide.addText(rightTag, { x: 6.4, y, w: 3.2, h: 0.3, fontSize: 10, color: COLOR.textSecondary, fontFace: FONT, align: 'right' });
  return y + 0.36;
}

function footnote(slide, unitText) {
  if (unitText) slide.addText(unitText, { x: 0.4, y: 5.3, w: 5, h: 0.25, fontSize: 9, color: COLOR.textSecondary, fontFace: FONT });
  slide.addText('※ 출처: 관세청 수출입무역통계', { x: 5.4, y: 5.3, w: 4.2, h: 0.25, fontSize: 9, color: COLOR.textSecondary, fontFace: FONT, align: 'right' });
}

// 헤더 행(들): 연회색 배경 + 검정 굵게 가운데 정렬. 데이터 행: 흰색/연회색 지브라 +
// 가로 구분선만(풀그리드 없음). 굵게 표시된 행(합계 등)은 살짝 더 진한 회색 배경.
// headerRows는 배열의 배열 — 국가별 표처럼 2단 헤더(그룹+서브)가 있을 수 있어서다.
function styledTable(pptx, title, headerRows, bodyRows, insight, unitTag, opts = {}) {
  const noBorder = { type: 'none' };
  const rule = (color, pt) => ({ type: 'solid', color, pt });
  const lastHeaderIdx = headerRows.length - 1;
  const header = headerRows.map((row, ri) => row.map(h => ({
    text: h.text,
    options: {
      ...h.options,
      fill: { color: COLOR.headerBg },
      border: [noBorder, noBorder, ri === lastHeaderIdx ? rule(COLOR.ruleBlack, 1) : noBorder, noBorder],
      valign: 'middle',
    },
  })));
  const rows = bodyRows.map((row, i) => row.map(c => ({
    text: c.text,
    options: {
      fill: { color: i % 2 ? COLOR.zebra : COLOR.white },
      border: [noBorder, noBorder, rule(COLOR.border, 0.75), noBorder],
      valign: 'middle',
      ...c.options, // 호출부가 명시적으로 준 fill(예: 합계 행 강조)이 지브라 기본값을 이긴다.
    },
  })));
  const slide = baseSlide(pptx, title);
  let y = addInsight(slide, insight, 0.95);
  y = sectionLabel(slide, opts.label || title, y, unitTag);
  slide.addTable([...header, ...rows], { x: 0.4, y, w: 9.2, fontSize: 11, margin: [3, 6, 3, 6], colW: opts.colW });
  footnote(slide, opts.unitFooter);
  return slide;
}

function chartSlide(pptx, title, type, chartData, insight, unitTag, opts = {}) {
  const slide = baseSlide(pptx, title);
  let y = addInsight(slide, insight, 0.95);
  y = sectionLabel(slide, opts.label || title, y, unitTag);
  slide.addChart(type, chartData, {
    x: 0.4, y, w: 9.2, h: 5.15 - y,
    chartColors: CHART_BLUE_GRADIENT,
    showLegend: true, legendPos: 'b', legendFontFace: FONT, legendFontSize: 10, legendColor: COLOR.textSecondary,
    catAxisLabelFontFace: FONT, catAxisLabelFontSize: 8, catAxisLabelColor: COLOR.textSecondary, catAxisLineColor: COLOR.border,
    valAxisLabelFontFace: FONT, valAxisLabelFontSize: 9, valAxisLabelColor: COLOR.textSecondary, valAxisLineColor: COLOR.border,
    valGridLine: { color: COLOR.border, size: 0.75 }, catGridLine: { style: 'none' },
    dataLabelFontFace: FONT, dataLabelColor: COLOR.textSecondary,
    ...opts.chart,
  });
  footnote(slide, opts.unitFooter);
  return slide;
}

export function exportPptx({ meta, sections }, selected) {
  const pptx = new pptxgen();
  pptx.defineLayout({ name: 'WIDE', width: 10, height: 5.63 });
  pptx.layout = 'WIDE';
  pptx.theme = { headFontFace: FONT, bodyFontFace: FONT };

  const title = pptx.addSlide();
  title.background = { color: COLOR.white };
  title.addShape(pptx.ShapeType.rect, { x: 0, y: 2.35, w: 10, h: 0.06, fill: { color: COLOR.ruleBlack }, line: { type: 'none' } });
  title.addText('국내 수입 주류 대시보드', { x: 0.5, y: 1.7, w: 9, h: 0.6, fontSize: 28, bold: true, color: COLOR.text, fontFace: FONT, align: 'center' });
  title.addText(meta.period || '', { x: 0.5, y: 2.55, w: 9, h: 0.4, fontSize: 13, color: COLOR.textSecondary, fontFace: FONT, align: 'center' });
  title.addText('관세청 수출입무역통계(nitemtrade)', { x: 0.5, y: 5.05, w: 9, h: 0.3, fontSize: 9, color: COLOR.textTertiary, fontFace: FONT, align: 'center' });

  if (selected.kpi && sections.kpi) {
    const header = [bold('지표'), bold('값'), bold('증감(YoY)')];
    const rows = sections.kpi.map(k => [cell(k.label, { color: COLOR.text }), cell(k.value, { bold: true, color: COLOR.text }), cell(k.deltaText, { align: 'right' })]);
    styledTable(pptx, 'KPI 요약', [header], rows, null, null, { colW: [3.5, 2.5, 3.2] });
  }

  if (selected.trend && sections.trend) {
    const ml = sections.trend.monthly.labels, mv = sections.trend.monthly.volumeLabels;
    if (ml.length) {
      const categories = ml.map(m => m.monthLabel);
      const chartData = [
        { name: '수입액(백만$)', labels: categories, values: ml.map(m => Number(m.text)) },
        { name: '수입중량(milL)', labels: categories, values: mv.map(m => Number(m.text)) },
      ];
      chartSlide(pptx, '월별 수입 추이', pptx.ChartType.line, chartData, sections.trend.insight, null, {
        label: '월별 수입 추이',
        chart: { chartColors: [COLOR.accent, COLOR.textTertiary], catAxisLabelFontSize: 6, lineSize: 2, lineDataSymbol: 'none' },
        unitFooter: '단위 · 금액: 백만달러 / 중량: milL',
      });
    }
    const header = [bold('연도'), bold('수입액'), bold('YoY'), bold('수입중량'), bold('YoY')];
    const rows = sections.trend.yearSummary.map(y => [
      cell(y.yearLabel, { color: COLOR.text, align: 'left' }), cell(y.valueDisplay, { color: COLOR.text, align: 'right' }), cell(y.valueYoyText, { align: 'right' }),
      cell(y.volumeDisplay, { color: COLOR.text, align: 'right' }), cell(y.volumeYoyText, { align: 'right' }),
    ]);
    styledTable(pptx, '월별 수입 추이 (연도 요약)', [header], rows, null, null, { label: '연도 요약' });
  }

  if (selected.ranking && sections.ranking) {
    const header = [bold('국가'), bold('값'), bold('YoY')];
    const rows = sections.ranking.map(r => [cell(r.name, { color: COLOR.text, align: 'left' }), cell(r.valueDisplay, { color: COLOR.text, align: 'right' }), cell(r.yoyText, { align: 'right' })]);
    styledTable(pptx, '국가별 순위', [header], rows, null, null, { colW: [3.5, 2.5, 3.2] });
  }

  if (selected.composition && sections.composition) {
    const years = sections.composition.years;
    const labels = years[0] ? years[0].segments.map(s => s.label) : [];
    if (years.length) {
      const categories = years.map(y => String(y.year));
      const chartData = labels.map((label, i) => ({ name: label, labels: categories, values: years.map(y => (y.segments[i] ? y.segments[i].value : 0)) }));
      chartSlide(pptx, sections.composition.title || '비중', pptx.ChartType.bar, chartData, null, '[단위: %]', {
        label: sections.composition.title || '비중',
        chart: { barDir: 'col', barGrouping: 'percentStacked' },
      });
    }
    const header = [bold('항목'), ...years.map(y => bold(y.year + '년'))];
    const rows = labels.map((label, i) => [cell(label, { color: COLOR.text, align: 'left' }), ...years.map(y => cell(y.segments[i] ? y.segments[i].valueDisplay : '', { color: COLOR.text, align: 'right' }))]);
    styledTable(pptx, (sections.composition.title || '비중') + ' (수치)', [header], rows, null, '[단위: %]', { label: '항목별 비중' });
  }

  if (selected.countryTable && sections.countryTable) {
    const ct = sections.countryTable;
    const header1 = [{ text: '구분', options: { bold: true, rowspan: 2, align: 'center', valign: 'middle', fontFace: FONT, color: COLOR.text, fontSize: 9 } }];
    ct.groups.forEach(g => header1.push({ text: g.label, options: { bold: true, colspan: g.span, align: 'center', fontFace: FONT, color: COLOR.text, fontSize: 9 } }));
    const header2 = ct.subHeader.map(h => ({ text: h, options: { bold: true, align: 'center', fontFace: FONT, color: COLOR.text, fontSize: 9 } }));
    // 합계 행(r.bold)은 살짝 진한 회색 배경 + 굵게 — 나머지는 지브라(styledTable 기본값).
    const bodyRows = ct.rows.map(r => {
      // 합계 행은 굵게+회색배경만으로 강조 — 델타 색상까지 겹치면 신호가 두 개가 된다.
      const rowOpts = r.bold ? { fill: { color: COLOR.totalBg }, color: COLOR.text } : {};
      const labelCell = cell(r.label, { fontSize: 9, align: 'left', bold: r.bold, color: COLOR.text, ...rowOpts });
      const dataCells = r.cells.map(v => cell(v, { fontSize: 9, align: 'right', bold: r.bold, ...rowOpts }));
      return [labelCell, ...dataCells];
    });
    styledTable(pptx, ct.title, [header1, header2], bodyRows, ct.insight, ct.unit ? `[단위: ${ct.unit}]` : null, { label: '국가별 수입 금액 추이' });
  }

  pptx.writeFile({ fileName: (meta.fileBase || '수입데이터') + '_' + fmtDate(meta.generatedAt) + '.pptx' });
}
