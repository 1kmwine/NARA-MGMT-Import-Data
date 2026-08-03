import React from "react";

// data: [{ year, segments: [{ label, value, color, valueDisplay }] }]
// Bar height scales to the tallest year's total; segment height scales to its share of that year's total.
export function StackedBarChart({ data = [], height = 220, barWidth = 64 }) {
  const maxTotal = Math.max(1, ...data.map(d => d.segments.reduce((s, x) => s + x.value, 0)));
  const legendMap = new Map();
  data.forEach(d => d.segments.forEach(seg => { if (!legendMap.has(seg.label)) legendMap.set(seg.label, seg.color); }));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 24, height, paddingTop: 24 }}>
        {data.map(d => {
          const total = d.segments.reduce((s, x) => s + x.value, 0);
          const barH = total ? (total / maxTotal) * height : 0;
          return (
            <div key={d.year} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: barWidth }}>
              <div style={{ width: "100%", height: barH, display: "flex", flexDirection: "column-reverse", borderRadius: 4, overflow: "hidden" }}>
                {d.segments.filter(seg => seg.value > 0).map((seg, i) => {
                  const segH = total ? (seg.value / total) * barH : 0;
                  return (
                    <div key={i} title={seg.label + ": " + seg.valueDisplay} style={{ height: Math.max(segH, 1), background: seg.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {segH >= 16 && <span style={{ fontSize: 10, fontWeight: 600, color: "var(--color-text-primary)" }}>{seg.valueDisplay}</span>}
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: 11, marginTop: 8, color: "var(--color-text)" }}>{d.year}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center", marginTop: 12 }}>
        {[...legendMap.entries()].map(([label, color]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: "inline-block" }} />
            <span style={{ fontSize: 11 }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
