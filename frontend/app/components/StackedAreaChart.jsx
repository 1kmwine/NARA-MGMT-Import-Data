// 100% 스택 영역 차트 — 연도별 항목 구성비. 값 라벨은 각 밴드 중앙에, 첫/마지막
// 연도는 플롯 바깥쪽(좌/우)으로 살짝 빼서 인접 밴드 라벨과 안 겹치게 한다.
const AREA_PALETTE = ['#F4B183', '#A9D18E', '#8FAADC', '#D9B3D9', '#F2C879', '#B0B0B0'];

export function StackedAreaChart({ data = [] }) {
  if (!data.length) return null;
  const segLabels = data[0].segments.map(s => s.label);
  const bandCount = segLabels.length;
  const W = 860, H = 520, padL = 50, padR = 50, padT = 24, padB = 34;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const n = data.length;
  const xAt = i => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = pct => padT + plotH - (pct / 100) * plotH;
  const xs = data.map((_, i) => xAt(i));

  // 연도별 누적 경계(0~100) — segments[0](가장 큰 항목)가 맨 아래 밴드가 된다.
  const bounds = data.map(d => {
    const total = d.segments.reduce((s, x) => s + x.value, 0) || 1;
    let acc = 0;
    return d.segments.map(seg => {
      const pct = (seg.value / total) * 100;
      const b0 = acc; acc += pct;
      return { b0, b1: acc, valueDisplay: seg.valueDisplay };
    });
  });

  const bandPath = idx => {
    const bottoms = bounds.map(row => yAt(row[idx].b0));
    const tops = bounds.map(row => yAt(row[idx].b1));
    const down = xs.map((x, i) => `${x.toFixed(1)},${bottoms[i].toFixed(1)}`).join(' L ');
    const up = xs.map((x, i) => `${x.toFixed(1)},${tops[i].toFixed(1)}`).reverse().join(' L ');
    return `M ${down} L ${up} Z`;
  };

  return (
    <div style={{ width: '100%' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} xmlns="http://www.w3.org/2000/svg">
        <defs>
          {Array.from({ length: bandCount }).map((_, idx) => (
            <linearGradient key={idx} id={`area-grad-${idx}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={AREA_PALETTE[idx % AREA_PALETTE.length]} stopOpacity="0.5" />
              <stop offset="100%" stopColor={AREA_PALETTE[idx % AREA_PALETTE.length]} stopOpacity="0.95" />
            </linearGradient>
          ))}
        </defs>
        <rect x={padL} y={padT} width={plotW} height={plotH} fill="none" stroke="var(--color-border)" strokeWidth="1" />
        {Array.from({ length: bandCount }).map((_, idx) => (
          <path key={idx} d={bandPath(idx)} fill={`url(#area-grad-${idx})`} stroke="var(--color-bg-canvas)" strokeWidth="1" />
        ))}
        {bounds.map((row, i) => row.map((seg, idx) => {
          const isFirst = i === 0, isLast = i === n - 1;
          const x = xs[i] + (isFirst ? -10 : isLast ? 10 : 0);
          const anchor = isFirst ? 'end' : isLast ? 'start' : 'middle';
          return (
            <text key={idx} x={x} y={yAt((seg.b0 + seg.b1) / 2)} textAnchor={anchor} dominantBaseline="middle" fontSize="16" fontWeight="600" fill="var(--color-text-primary)">
              {seg.valueDisplay}
            </text>
          );
        }))}
        {data.map((d, i) => (
          <text key={'x' + i} x={xs[i]} y={H - 6} textAnchor="middle" fontSize="14" fill="var(--color-text-secondary)">{'Y' + String(d.year).slice(-2)}</text>
        ))}
      </svg>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', marginTop: 12 }}>
        {segLabels.map((label, idx) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 11, height: 11, borderRadius: 2, background: AREA_PALETTE[idx % AREA_PALETTE.length], display: 'inline-block' }} />
            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
