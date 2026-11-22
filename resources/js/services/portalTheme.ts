import { useEffect, useState } from "react";

export const LIGHT = {
  bg: "#B4BCC7", side: "rgba(166,175,186,0.85)", hdr: "rgba(198,205,214,0.8)",
  card: "#C6CDD6", field: "#D3D9E0", border: "#98A2AF", text: "#0F1824", muted: "#3F4A58",
  pri: "#D9563A", priB: "#E8694B", priSh: "rgba(217,86,58,0.3)", eyeb: "#8F2F1B", link: "#8F2F1B",
  track: "#AEB7C2", iconBg: "#BBC3CD", iconFg: "#0B5F80", accf: "#1F7FA8", good: "#0F6B49",
  chipBg: "rgba(217,86,58,0.16)", chipFg: "#8F2F1B", glow: "rgba(217,86,58,0.15)",
  logoBg: "#0F1824", logoIc: "#FFFFFF",
  // AI = electric blue
  ai: "#0A8FD6", ai2: "#0A6FB5", aiBg: "rgba(10,143,214,0.10)", aiBorder: "rgba(10,143,214,0.55)",
  aiGlow: "rgba(10,143,214,0.28)", aiText: "#0A5F8F", aiOn: "#FFFFFF",
};
export const DARK = {
  bg: "#0A121C", side: "#08101A", hdr: "rgba(10,18,28,0.7)",
  card: "#0F1A27", field: "#132133", border: "#1B2A3B", text: "#E8EEF6", muted: "#8FA2B6",
  pri: "#D9563A", priB: "#FF7A59", priSh: "rgba(255,122,89,0.35)", eyeb: "#FF8F72", link: "#FF8F72",
  track: "#132133", iconBg: "#132133", iconFg: "#4FB3D9", accf: "#2B93BC", good: "#3FCB8E",
  chipBg: "rgba(255,122,89,0.14)", chipFg: "#FF9A80", glow: "rgba(255,122,89,0.18)",
  logoBg: "#E8EEF6", logoIc: "#0A121C",
  // AI = light neon blue
  ai: "#4DD8FF", ai2: "#7AE6FF", aiBg: "rgba(77,216,255,0.08)", aiBorder: "rgba(77,216,255,0.55)",
  aiGlow: "rgba(77,216,255,0.35)", aiText: "#7AE6FF", aiOn: "#031722",
};
export type Pal = typeof LIGHT;

const readDark = () =>
  document.documentElement.classList.contains("dark") ||
  document.documentElement.getAttribute("data-theme") === "dark" ||
  localStorage.getItem("theme") === "dark";

export function usePortalTheme() {
  const [dark, setDark] = useState(readDark);
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(readDark()));
    obs.observe(document.documentElement, { attributes: true });
    return () => obs.disconnect();
  }, []);
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch { /* ignore */ }
    setDark(next);
  };
  return { dark, toggle, p: dark ? DARK : LIGHT };
}