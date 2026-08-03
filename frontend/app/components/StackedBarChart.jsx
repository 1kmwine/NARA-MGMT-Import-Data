import React from "react";

// data: [{ year, segments: [{ label, value, color, valueDisplay }] }]
// Fills the height of its flex parent (pass this inside a `flex:1` wrapper);
// bar width stays fixed so the chart doesn't stretch sideways with the card.
export function StackedBarChart({ data = [], barWidth = 72, normalize = false }) {
  const maxTotal = Math.max(1, ...data.map(d => d.segments.reduce((s, x) => s + x.value, 0)));
  const legendMap = new Map();
  data.forEach(d => d.segments.forEach(seg => { if (!legendMap.has(seg.label)) legendMap.set(seg.label, seg.color); }));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 24, paddingTop: 24 }}>
        {data.map(d => {
          const total = d.segments.reduce((s, x) => s + x.value, 0);
          const barHPct = normalize ? 100 : (total ? (total / maxTotal) * 100 : 0);
          return (
            <div key={d.year} style={{ display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end", width: barWidth, flexShrink: 0 }}>
              <div style={{ width: "100%", height: barHPct + "%", display: "flex", flexDirection: "column-reverse", borderRadius: 4, overflow: "hidden" }}>
                {d.segments.filter(seg => seg.value > 0).map((seg, i) => (
                  <div key={i} title={seg.label + ": " + seg.valueDisplay} style={{ flex: seg.value, minHeight: 1, background: seg.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {total > 0 && seg.value / total >= 0.06 && <span style={{ fontSize: 10, fontWeight: 600, color: "var(--color-text-primary)" }}>{seg.valueDisplay}</span>}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, marginTop: 8, color: "var(--color-text)" }}>{d.year}</div>
            </div>
          );
        })}
      </div>
      <div style={{ flexShrink: 0, display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center", marginTop: 12 }}>
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
