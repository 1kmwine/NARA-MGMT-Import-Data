'use client';
import React from "react";

const sizes = {
  sm: { padding: "6px 12px", font: "var(--text-body-sm)" },
  md: { padding: "8px 14px", font: "var(--text-body)" },
  lg: { padding: "11px 18px", font: "var(--text-subheading)" },
};

const variants = {
  primary: { background: "var(--color-accent)", color: "var(--color-text-inverse)", border: "1px solid var(--color-accent)" },
  secondary: { background: "var(--color-bg-canvas)", color: "var(--color-text-primary)", border: "1px solid var(--color-border-strong)" },
  ghost: { background: "transparent", color: "var(--color-text-primary)", border: "1px solid transparent" },
  danger: { background: "var(--color-text-primary)", color: "var(--color-text-inverse)", border: "1px solid var(--color-text-primary)" },
};

const hoverBg = {
  primary: "var(--color-accent-hover)",
  secondary: "var(--color-bg-hover)",
  ghost: "var(--color-bg-hover)",
  danger: "#333333",
};

export function Button({ children, variant = "primary", size = "md", disabled = false, onClick, style }) {
  const v = variants[variant] || variants.primary;
  const s = sizes[size] || sizes.md;
  const [hover, setHover] = React.useState(false);
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        borderRadius: "var(--radius-md)",
        fontFamily: "var(--font-sans-ui)",
        font: s.font,
        fontWeight: 500,
        padding: s.padding,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "background var(--duration-fast) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard)",
        ...v,
        background: hover && !disabled ? hoverBg[variant] : v.background,
        ...style,
      }}
    >
      {children}
    </button>
  );
}
