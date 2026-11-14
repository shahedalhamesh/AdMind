import { useEffect, useState } from "react";

export const LIGHT = {
  bg: "#A9B5CD", side: "rgba(201,209,224,0.45)", hdr: "rgba(201,209,224,0.55)",
  card: "#C9D1E0", field: "#B4BED3", border: "#8E9AB4", text: "#101B32", muted: "#25344F",
  pri: "#A64B35", priB: "#D9694C", priSh: "rgba(166,75,53,0.35)", eyeb: "#6E2A19", link: "#6E2A19",
  track: "#9CA9C4", iconBg: "#B4BED3", iconFg: "#0E5F68", accf: "#20D5DF", good: "#0B5F3A",
  chipBg: "rgba(166,75,53,0.16)", chipFg: "#6E2A19", glow: "rgba(199,91,65,0.28)",
  logoBg: "#101B32", logoIc: "#FFFFFF",
};
export const DARK = {
  bg: "#0B1426", side: "#0D182E", hdr: "rgba(16,27,50,0.6)",
  card: "#101B32", field: "#16223F", border: "#25365A", text: "#FFFFFF", muted: "#AAB6CE",
  pri: "#BC553B", priB: "#E58A70", priSh: "rgba(188,85,59,0.4)", eyeb: "#E58A70", link: "#EE9A80",
  track: "#16223F", iconBg: "#16223F", iconFg: "#20D5DF", accf: "#20D5DF", good: "#4FE3A1",
  chipBg: "rgba(188,85,59,0.25)", chipFg: "#F0A18A", glow: "rgba(199,91,65,0.22)",
  logoBg: "#FFFFFF", logoIc: "#101B32",
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