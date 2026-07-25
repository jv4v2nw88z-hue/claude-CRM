import { useEffect, useState } from "react";

/**
 * Chart colours, read from the appearance tokens.
 *
 * recharts takes concrete colour strings for axes, grids and tooltips — it can't
 * be handed a CSS variable and left to resolve it, because the values end up in
 * SVG attributes and inline styles rather than in a stylesheet. So the grid and
 * axis colours were hardcoded light-mode hex, which meant a #64748B axis label
 * on a near-black surface: technically present, practically invisible.
 *
 * This reads the same custom properties the rest of the UI uses, and re-reads
 * them when the system appearance changes so an open dashboard re-themes without
 * a reload.
 */
export interface ChartTheme {
  grid: string;
  axis: string;
  cursor: string;
  line: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipInk: string;
}

function read(): ChartTheme {
  // Guard for the module being evaluated before paint in any non-DOM context.
  if (typeof document === "undefined") {
    return {
      grid: "#E2E8F0",
      axis: "#64748B",
      cursor: "rgb(120 120 128 / 0.15)",
      line: "#059669",
      tooltipBg: "#FFFFFF",
      tooltipBorder: "#E2E8F0",
      tooltipInk: "#1D1D1F",
    };
  }

  const style = getComputedStyle(document.documentElement);
  const ch = (name: string) => style.getPropertyValue(name).trim();
  const rgb = (name: string, alpha?: number) =>
    alpha === undefined ? `rgb(${ch(name)})` : `rgb(${ch(name)} / ${alpha})`;

  return {
    grid: rgb("--c-separator", 0.55),
    axis: rgb("--c-ink", 0.55),
    cursor: rgb("--c-fill", 0.15),
    line: rgb("--c-success"),
    tooltipBg: rgb("--c-elevated"),
    tooltipBorder: rgb("--c-separator"),
    tooltipInk: rgb("--c-ink"),
  };
}

export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>(read);

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setTheme(read());
    query.addEventListener("change", onChange);
    // The first read can happen before the stylesheet has applied.
    onChange();
    return () => query.removeEventListener("change", onChange);
  }, []);

  return theme;
}
