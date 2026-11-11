import type { CSSProperties } from "react";

export const NAVY = "#101B32";
export const TERRACOTTA = "#A64B35";
export const TURQUOISE = "#20D5DF";

export const DARK = {
  page: `radial-gradient(ellipse at 20% 10%, ${NAVY} 0%, #0A1222 70%)`,
  ring: "rgba(255,255,255,0.07)",
  frame: "rgba(255,255,255,0.16)",
  frameShadow: "rgba(0,0,0,0.45)",
  leftBg: `linear-gradient(155deg, #1B2C52 0%, ${NAVY} 50%, #0B1426 100%)`,
  leftText: "#FFFFFF",
  leftText2: "rgba(255,255,255,0.85)",
  grid: "rgba(255,255,255,0.05)",
  glow1: "rgba(199,91,65,0.6)",
  glow2: "rgba(166,75,53,0.22)",
  orbit: "#FFFFFF",
  logoBg: "#FFFFFF",
  logoIcon: NAVY,
  pillBorder: "#D9694C",
  pillBg: "rgba(166,75,53,0.28)",
  live: TURQUOISE,
  eyebrow: "#E58A70",
  highlight: `linear-gradient(100deg,${TURQUOISE} 0%,#A6F2F6 30%,${TURQUOISE} 50%,#A6F2F6 70%,${TURQUOISE} 100%)`,
  cardBg: "rgba(6,12,26,0.5)",
  cardBorder: "rgba(255,255,255,0.28)",
  flow: "rgba(255,255,255,0.7)",
  chartIcon: "#FFFFFF",
  rightBg: "#0B1426",
  text: "#FFFFFF",
  muted: "#AAB6CE",
  field: "#16223F",
  border: "#2E3E63",
  placeholder: "#7F8CA8",
  link: "#EE9A80",
  btnBg: "#BC553B",
  btnBorder: "#E58A70",
  btnShadow: "rgba(188,85,59,0.45)",
  error: "#FF8A7A",
};

export const LIGHT = {
  page: "radial-gradient(ellipse at 20% 10%, #A9B5CD 0%, #6F7E9F 75%)",
  ring: "rgba(16,27,50,0.08)",
  frame: "rgba(16,27,50,0.18)",
  frameShadow: "rgba(16,27,50,0.25)",
  leftBg: "linear-gradient(155deg, #A3AFC9 0%, #8E9CBB 55%, #7D8CAD 100%)",
  leftText: NAVY,
  leftText2: "rgba(16,27,50,0.92)",
  grid: "rgba(16,27,50,0.09)",
  glow1: "rgba(199,91,65,0.38)",
  glow2: "rgba(199,91,65,0.14)",
  orbit: NAVY,
  logoBg: NAVY,
  logoIcon: "#FFFFFF",
  pillBorder: "#6E2A19",
  pillBg: "rgba(166,75,53,0.16)",
  live: "#C75B41",
  eyebrow: "#6E2A19",
  highlight:
    "linear-gradient(100deg,#7A2F1D 0%,#B84A2E 30%,#7A2F1D 50%,#B84A2E 70%,#7A2F1D 100%)",
  cardBg: "rgba(255,255,255,0.22)",
  cardBorder: "rgba(16,27,50,0.35)",
  flow: "rgba(16,27,50,0.5)",
  chartIcon: NAVY,
  rightBg: "#9CA9C4",
  text: NAVY,
  muted: "#25344F",
  field: "#B4BED3",
  border: "#6F7E9F",
  placeholder: "#566587",
  link: "#6E2A19",
  btnBg: TERRACOTTA,
  btnBorder: "#D9694C",
  btnShadow: "rgba(166,75,53,0.4)",
  error: "#8A1F10",
};

export const authCss = `
@keyframes am-rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
@keyframes am-fade{from{opacity:0}to{opacity:1}}
@keyframes am-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
@keyframes am-spin{to{transform:rotate(360deg)}}
@keyframes am-spinr{to{transform:rotate(-360deg)}}
@keyframes am-breathe{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(199,91,65,.45)}50%{transform:scale(1.05);box-shadow:0 0 0 14px rgba(199,91,65,0)}}
@keyframes am-sheen{0%{transform:translateX(-140%) skewX(-20deg)}55%,100%{transform:translateX(420%) skewX(-20deg)}}
@keyframes am-ping{0%,100%{box-shadow:0 0 0 0 rgba(32,213,223,.55)}70%{box-shadow:0 0 0 9px rgba(32,213,223,0)}}
@keyframes am-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes am-flow{to{background-position:-24px 0}}
@keyframes am-grid{from{background-position:0 0}to{background-position:56px 56px}}
.am-rise{animation:am-rise .9s cubic-bezier(.2,.7,.2,1) backwards}
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
.am-input:focus{border-color:#20D5DF !important;box-shadow:0 0 0 3px rgba(32,213,223,.25)}
@media (prefers-reduced-motion: reduce){.am-rise,.am-fade,.am-hl,.am-spin,.am-spin2,.am-spin3,.am-core,.am-fl,.am-fl2,.am-fl3,.am-fl4,.am-live,.am-flow,.am-grid,.am-btn::after{animation:none !important}}
`;

export const delay = (s: number): CSSProperties => ({ animationDelay: `${s}s` });