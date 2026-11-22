import type { CSSProperties } from "react";

/* ------------------------------------------------------------------ */
/*  Palette: ink petrol + coral (kohl) + neon blue for the AI parts     */
/* ------------------------------------------------------------------ */
export const NAVY = "#0A121C"; // ink (used for icons on bright tiles)
export const TERRACOTTA = "#D9563A"; // coral
export const TURQUOISE = "#4DD8FF"; // AI neon blue

export const DARK = {
  page: "radial-gradient(ellipse at 20% 10%, #0E4C6C 0%, #0A121C 70%)",
  ring: "rgba(255,255,255,0.06)",
  frame: "rgba(255,255,255,0.14)",
  frameShadow: "rgba(0,0,0,0.5)",
  leftBg: "linear-gradient(155deg, #0E4C6C 0%, #0C2F45 50%, #08141F 100%)",
  leftText: "#FFFFFF",
  leftText2: "rgba(255,255,255,0.82)",
  grid: "rgba(140,210,255,0.06)",
  glow1: "rgba(255,122,89,0.45)",
  glow2: "rgba(255,122,89,0.15)",
  orbit: "#FFFFFF",
  logoBg: "#E8EEF6",
  logoIcon: "#0A121C",
  pillBorder: "rgba(77,216,255,0.55)",
  pillBg: "rgba(77,216,255,0.08)",
  live: "#4DD8FF",
  eyebrow: "#FF8F72",
  highlight:
    "linear-gradient(100deg,#4DD8FF 0%,#B5F1FF 30%,#4DD8FF 50%,#B5F1FF 70%,#4DD8FF 100%)",
  cardBg: "rgba(8,20,31,0.55)",
  cardBorder: "rgba(77,216,255,0.35)",
  flow: "rgba(77,216,255,0.7)",
  chartIcon: "#FFFFFF",
  rightBg: "#0A121C",
  text: "#E8EEF6",
  muted: "#8FA2B6",
  field: "#132133",
  border: "#26384D",
  placeholder: "#6B7F94",
  link: "#FF8F72",
    btnBg: "linear-gradient(100deg, #1F7FA8 0%, #D9563A 100%)",
  btnBorder: "#FF7A59",
  btnShadow: "rgba(122,106,138,0.4)",
  error: "#FF8A7A",
};

export const LIGHT = {
  page: "radial-gradient(ellipse at 20% 10%, #C3CAD3 0%, #98A2AF 75%)",
  ring: "rgba(15,24,36,0.08)",
  frame: "rgba(15,24,36,0.2)",
  frameShadow: "rgba(15,24,36,0.3)",
  leftBg: "linear-gradient(155deg, #0E4C6C 0%, #16607F 55%, #0C2F45 100%)",
  leftText: "#FFFFFF",
  leftText2: "rgba(255,255,255,0.85)",
  grid: "rgba(140,210,255,0.07)",
  glow1: "rgba(255,122,89,0.4)",
  glow2: "rgba(255,122,89,0.14)",
  orbit: "#FFFFFF",
  logoBg: "#E8EEF6",
  logoIcon: "#0A121C",
  pillBorder: "rgba(77,216,255,0.55)",
  pillBg: "rgba(77,216,255,0.08)",
  live: "#4DD8FF",
  eyebrow: "#FF8F72",
  highlight:
    "linear-gradient(100deg,#4DD8FF 0%,#B5F1FF 30%,#4DD8FF 50%,#B5F1FF 70%,#4DD8FF 100%)",
  cardBg: "rgba(8,20,31,0.45)",
  cardBorder: "rgba(77,216,255,0.35)",
  flow: "rgba(77,216,255,0.7)",
  chartIcon: "#FFFFFF",
  rightBg: "#B4BCC7",
  text: "#0F1824",
  muted: "#3F4A58",
  field: "#D3D9E0",
  border: "#98A2AF",
  placeholder: "#5B6674",
  link: "#8F2F1B",
  btnBg: "linear-gradient(100deg, #1F7FA8 0%, #D9563A 100%)",
  btnBorder: "#E8694B",
  btnShadow: "rgba(122,106,138,0.4)",
  error: "#8A1F10",
};

/* Keyframes + helpers shared by Login, Sign up and Forgot password */
export const authCss = `
@keyframes am-rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
@keyframes am-fade{from{opacity:0}to{opacity:1}}
@keyframes am-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
@keyframes am-spin{to{transform:rotate(360deg)}}
@keyframes am-spinr{to{transform:rotate(-360deg)}}
@keyframes am-breathe{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(77,216,255,.45)}50%{transform:scale(1.05);box-shadow:0 0 0 14px rgba(77,216,255,0)}}
@keyframes am-sheen{0%{transform:translateX(-140%) skewX(-20deg)}55%,100%{transform:translateX(420%) skewX(-20deg)}}
@keyframes am-ping{0%,100%{box-shadow:0 0 0 0 rgba(77,216,255,.55)}70%{box-shadow:0 0 0 9px rgba(77,216,255,0)}}
@keyframes am-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes am-flow{to{background-position:-24px 0}}
@keyframes am-grid{from{background-position:0 0}to{background-position:56px 56px}}
.am-rise{animation:am-rise .9s cubic-bezier(.2,.7,.2,1) both}
.am-fade{animation:am-fade 1.6s ease both}
.am-hl{-webkit-background-clip:text;background-clip:text;color:transparent;background-size:200% 100%;animation:am-shimmer 7s linear infinite}
.am-spin{transform-box:view-box;transform-origin:180px 180px;animation:am-spin 70s linear infinite}
.am-spin2{transform-box:view-box;transform-origin:180px 180px;animation:am-spinr 48s linear infinite}
.am-spin3{transform-box:view-box;transform-origin:180px 180px;animation:am-spin 32s linear infinite}
.am-core{animation:am-breathe 3.6s ease-in-out infinite}
.am-fl{animation:am-float 5s ease-in-out infinite}
.am-fl2{animation:am-float 6.5s ease-in-out infinite;animation-delay:-2s}
.am-fl3{animation:am-float 5.8s ease-in-out infinite;animation-delay:-3.4s}
.am-fl4{animation:am-float 5s ease-in-out infinite;animation-delay:-1.5s}
.am-live{animation:am-ping 2.4s ease-out infinite}
.am-flow{background-size:24px 1px;animation:am-flow 1.6s linear infinite}
.am-grid{background-size:56px 56px;animation:am-grid 8s linear infinite;-webkit-mask-image:radial-gradient(ellipse at 60% 70%,#000 0%,transparent 72%);mask-image:radial-gradient(ellipse at 60% 70%,#000 0%,transparent 72%)}
.am-btn{position:relative;overflow:hidden;transition:filter .3s,transform .3s}
.am-btn::after{content:"";position:absolute;top:0;left:0;width:30%;height:100%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.4),transparent);animation:am-sheen 5.5s ease-in-out infinite}
.am-btn:hover{filter:brightness(1.08);transform:translateY(-2px)}
.am-input::placeholder{color:var(--am-ph)}
.am-input:focus{border-color:#FF7A59 !important;box-shadow:0 0 0 3px rgba(255,122,89,.25)}
@media (prefers-reduced-motion: reduce){.am-rise,.am-fade,.am-hl,.am-spin,.am-spin2,.am-spin3,.am-core,.am-fl,.am-fl2,.am-fl3,.am-fl4,.am-live,.am-flow,.am-grid,.am-btn::after{animation:none !important}}
`;

export const delay = (s: number): CSSProperties => ({ animationDelay: `${s}s` });