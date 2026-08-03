import React from "react";

export const CHART_PALETTE = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)", "var(--chart-7)", "var(--chart-8)"];
const palette = CHART_PALETTE;

export function PieChart({ data = [], size = 220, donut = true }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = size / 2 - 8, cx = size / 2, cy = size / 2;
  const innerR = donut ? r * 0.42 : 0;
  let angle = -90;
  const slices = data.map((d, i) => {
    const a0 = angle;
    const a1 = angle + (d.value / total) * 360;
    angle = a1;
    const large = a1 - a0 > 180 ? 1 : 0;
    const toXY = (a, rad) => [cx + rad * Math.cos((a * Math.PI) / 180), cy + rad * Math.sin((a * Math.PI) / 180)];
    const [x0, y0] = toXY(a0, r), [x1, y1] = toXY(a1, r);
    const mid = (a0 + a1) / 2;
    const [lx, ly] = toXY(mid, (r + innerR) / 2);
    return {
      path: `M${cx},${cy} L${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} Z`,
      color: palette[i % palette.length], label: d.label,
      pct: Math.round((d.value / total) * 100), lx, ly,
    };
  });
  return (
    <svg width={size} height={size} style={{ fontFamily: "var(--font-sans-ui)" }}>
      {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} />)}
      {donut && <circle cx={cx} cy={cy} r={innerR} fill="var(--color-bg-canvas)" />}
      {slices.map((s, i) => (
        <text key={i} x={s.lx} y={s.ly} textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight="600" fill="var(--color-text-primary)">{s.label} · {s.pct}%</text>
      ))}
    </svg>
  );
}
