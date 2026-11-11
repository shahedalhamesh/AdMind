import { useState } from "react";
import type { FormEvent, ChangeEvent, CSSProperties } from "react";
import { Icon } from "@iconify/react";
import { useNavigate } from "react-router-dom";
import { useGoogleLogin } from "@react-oauth/google";
import { useTheme } from "../components/ThemeContext";
// import { saveUser } from "../services/auth";
import { saveUser, isEmailVerified, savePendingUser } from "../services/auth";


/* ------------------------------------------------------------------ */
/*  Brand palette: Deep Navy + Terracotta + Electric Turquoise + White */
/* ------------------------------------------------------------------ */
const NAVY = "#101B32";
const TERRACOTTA = "#A64B35";
const TURQUOISE = "#20D5DF";

const DARK = {
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

const LIGHT = {
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

/* Keyframes + helpers (kept here so the page is self-contained) */
const css = `
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
.am-input:focus{border-color:#20D5DF !important;box-shadow:0 0 0 3px rgba(32,213,223,.25)}
@media (prefers-reduced-motion: reduce){.am-rise,.am-fade,.am-hl,.am-spin,.am-spin2,.am-spin3,.am-core,.am-fl,.am-fl2,.am-fl3,.am-fl4,.am-live,.am-flow,.am-grid,.am-btn::after{animation:none !important}}
`;

const delay = (s: number): CSSProperties => ({ animationDelay: `${s}s` });

export default function AdmindWorkspace() {
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [rememberMe, setRememberMe] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const c = theme === "dark" ? DARK : LIGHT;

  const loginWithGoogle = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const info = await res.json();
       const user = { name: info.name, email: info.email, picture: info.picture };
if (isEmailVerified(user.email)) {
  saveUser(user);
  navigate("/dashboard");
} else {
  savePendingUser(user);
  navigate("/verify");
}
      } catch (err) {
        console.error("Failed to read Google profile", err);
        setError("Could not read your Google profile. Please try again.");
      }
    },
    onError: (err) => {
      console.error("Google login failed", err);
      setError("Google sign-in failed. Please try again.");
    },
    onNonOAuthError: (err) => {
      console.error("Google popup problem", err);
      setError("The Google window was blocked or closed. Allow pop-ups and try again.");
    },
  });

  const handleGoogleClick = (): void => {
    setError("");
    loginWithGoogle();
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    setError("");

    // Temporary until the Laravel API is ready.
    const user = { name: email.split("@")[0], email };
if (isEmailVerified(user.email)) {
  saveUser(user);
  navigate("/dashboard");
} else {
  savePendingUser(user);
  navigate("/verify");
}
  };

  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setEmail(e.target.value);
  };

  const handlePasswordChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setPassword(e.target.value);
  };

  const handleRememberChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setRememberMe(e.target.checked);
  };

  const inputStyle: CSSProperties = {
    background: c.field,
    borderColor: c.border,
    color: c.text,
  };

  return (
    <div
      className="relative flex min-h-screen w-full flex-col overflow-hidden"
      style={{ background: c.page, ["--am-ph" as string]: c.placeholder } as CSSProperties}
    >
      <style>{css}</style>

      {/* Decorative ring */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[46rem] w-[46rem] -translate-x-1/2 -translate-y-1/2 rounded-full border"
        style={{ borderColor: c.ring }}
      ></div>

      {/* Theme Toggle Button */}
      <button
        type="button"
        onClick={toggleTheme}
        aria-label="Toggle color theme"
        title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
        className="am-fade absolute right-6 top-6 z-30 flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border transition duration-300 hover:scale-110"
        style={{ borderColor: c.border, background: c.rightBg, color: c.text }}
      >
        <Icon icon={theme === "dark" ? "lucide:sun" : "lucide:moon"} className="text-xl" />
      </button>

      <main className="relative z-10 flex flex-1 items-center justify-center p-5 lg:p-10">
        <div
          className="w-full max-w-7xl overflow-hidden rounded-2xl border lg:grid lg:grid-cols-[1.15fr_0.85fr]"
          style={{
            borderColor: c.frame,
            boxShadow: `0 30px 80px ${c.frameShadow}`,
            background: c.rightBg,
          }}
        >
          {/* Left Column - Brand Presentation */}
          <section
            className="relative hidden min-h-[680px] overflow-hidden p-12 lg:flex lg:flex-col"
            style={{ background: c.leftBg, color: c.leftText }}
          >
            {/* animated grid */}
            <div
              aria-hidden="true"
              className="am-grid absolute inset-0"
              style={{
                backgroundImage: `linear-gradient(${c.grid} 1px,transparent 1px),linear-gradient(90deg,${c.grid} 1px,transparent 1px)`,
              }}
            ></div>

            {/* terracotta glow (bottom-right corner) */}
            <div
              aria-hidden="true"
              className="absolute inset-0"
              style={{
                background: `radial-gradient(circle at 100% 100%, ${c.glow1} 0%, ${c.glow2} 38%, transparent 70%)`,
              }}
            ></div>

            {/* orbit */}
            <svg
              aria-hidden="true"
              viewBox="0 0 360 360"
              className="am-fade pointer-events-none absolute -right-28 -top-24 h-[26rem] w-[26rem] opacity-80"
            >
              <circle cx="180" cy="180" r="70" fill="none" stroke="#C75B41" strokeOpacity="0.6" />
              <circle cx="180" cy="180" r="112" fill="none" stroke={c.orbit} strokeOpacity="0.28" strokeDasharray="2 7" />
              <circle cx="180" cy="180" r="154" fill="none" stroke={c.orbit} strokeOpacity="0.18" />
              <g className="am-spin3"><circle cx="250" cy="180" r="4.5" fill={TURQUOISE} /></g>
              <g className="am-spin2">
                <circle cx="180" cy="68" r="4" fill={c.orbit} />
                <circle cx="180" cy="292" r="3" fill={c.orbit} fillOpacity="0.7" />
              </g>
              <g className="am-spin">
                <circle cx="334" cy="180" r="5" fill={TERRACOTTA} />
                <circle cx="26" cy="180" r="3" fill={c.orbit} fillOpacity="0.7" />
              </g>
            </svg>

            {/* Header */}
            <div className="am-rise relative flex items-center justify-between" style={delay(0.1)}>
              <div className="flex items-center gap-3">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl shadow-xl"
                  style={{ background: c.logoBg, boxShadow: `0 10px 24px rgba(0,0,0,0.3), 0 0 0 3px ${TERRACOTTA}` }}
                >
                  <Icon icon="lucide:brain-circuit" className="text-2xl" style={{ color: c.logoIcon }} />
                </div>
                <span className="font-heading text-xl font-bold tracking-[0.18em]">ADMIND</span>
              </div>

              <span
                className="inline-flex items-center gap-2.5 rounded-lg border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em]"
                style={{ borderColor: c.pillBorder, background: c.pillBg }}
              >
                <span className="am-live h-[7px] w-[7px] rounded-full" style={{ background: c.live }}></span>
                Live orchestration
              </span>
            </div>

            {/* Headline */}
            <div className="relative my-auto max-w-xl">
              <p
                className="am-rise mb-5 font-mono text-xs uppercase tracking-[0.24em]"
                style={{ ...delay(0.25), color: c.eyebrow }}
              >
                Multi-agent intelligence system
              </p>

              <h1
                className="am-rise text-balance font-heading text-5xl font-semibold leading-[1.12] tracking-tight"
                style={delay(0.4)}
              >
                The command center for{" "}
                <span className="am-hl" style={{ backgroundImage: c.highlight }}>
                  intelligence in motion.
                </span>
              </h1>

              <p
                className="am-rise mt-6 max-w-md text-pretty text-base leading-7"
                style={{ ...delay(0.6), color: c.leftText2 }}
              >
                Launch a coordinated team of specialized AI agents. Every brief,
                decision, and result moves in one shared orbit.
              </p>
            </div>

            {/* Agent Constellation Visual */}
            <div
              className="am-rise relative rounded-xl border p-6"
              style={{ ...delay(0.8), background: c.cardBg, borderColor: c.cardBorder }}
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p
                    className="font-mono text-[10px] uppercase tracking-[0.18em]"
                    style={{ color: c.leftText2 }}
                  >
                    Agent constellation
                  </p>
                  <p className="mt-1 text-sm">Thinking together, in real time</p>
                </div>

                <span className="flex items-center gap-2 text-xs font-semibold">
                  <span className="am-live h-2.5 w-2.5 rounded-full" style={{ background: c.live }}></span>
                  08 online
                </span>
              </div>

              <div className="relative h-32 overflow-hidden">
                <div
                  aria-hidden="true"
                  className="am-flow absolute left-14 right-14 top-1/2 h-px"
                  style={{
                    backgroundImage: `repeating-linear-gradient(90deg, ${c.flow} 0 6px, transparent 6px 12px)`,
                  }}
                ></div>

                <div
                  className="am-core absolute left-1/2 top-1/2 flex h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-white"
                  style={{ borderColor: "#C75B41" }}
                >
                  <Icon icon="lucide:sparkles" className="text-3xl" style={{ color: NAVY }} />
                </div>

                <div
                  className="am-fl absolute left-6 top-4 flex h-11 w-11 items-center justify-center rounded-xl shadow-lg"
                  style={{ background: TURQUOISE }}
                >
                  <Icon icon="lucide:search" className="text-xl" style={{ color: NAVY }} />
                </div>

                <div
                  className="am-fl2 absolute right-8 top-6 flex h-11 w-11 items-center justify-center rounded-xl shadow-lg"
                  style={{ background: "#C75B41" }}
                >
                  <Icon icon="lucide:pen-tool" className="text-xl text-white" />
                </div>

                <div
                  className="am-fl3 absolute bottom-2 left-28 flex h-10 w-10 items-center justify-center rounded-xl border"
                  style={{ background: "rgba(199,91,65,0.25)", borderColor: "#D9694C" }}
                >
                  <Icon icon="lucide:chart-bar" className="text-lg" style={{ color: c.chartIcon }} />
                </div>

                <div
                  className="am-fl4 absolute bottom-3 right-28 flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background: TERRACOTTA }}
                >
                  <Icon icon="lucide:code-2" className="text-lg text-white" />
                </div>
              </div>
            </div>
          </section>

          {/* Right Column - Login Form */}
          <section
            className="flex items-center justify-center p-7 sm:p-12"
            style={{ background: c.rightBg, color: c.text }}
          >
            <div className="w-full max-w-sm">
              {/* Mobile Logo */}
              <div className="mb-10 lg:hidden">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl shadow-xl"
                  style={{ background: c.logoBg, boxShadow: `0 0 0 3px ${TERRACOTTA}` }}
                >
                  <Icon icon="lucide:brain-circuit" className="text-2xl" style={{ color: c.logoIcon }} />
                </div>
                <p className="mt-4 font-heading text-lg font-bold tracking-[0.18em]">ADMIND</p>
              </div>

              <p
                className="am-rise flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em]"
                style={delay(0.15)}
              >
                <span className="h-[3px] w-9 rounded" style={{ background: "#C75B41" }}></span>
                Secure agent access
              </p>

              <h2
                className="am-rise mt-3 text-balance font-heading text-4xl font-semibold tracking-tight"
                style={delay(0.25)}
              >
                Welcome back.
              </h2>

              <p
                className="am-rise mt-3 text-pretty text-sm leading-6"
                style={{ ...delay(0.35), color: c.muted }}
              >
                Welcome to AdMind Set your Email&Password to Continue.
              </p>

              {/* Google Login */}
              <button
                type="button"
                onClick={handleGoogleClick}
                className="am-rise mt-8 flex min-h-12 w-full cursor-pointer items-center justify-center gap-3 rounded-xl border px-4 py-3 text-sm font-bold transition duration-300 hover:-translate-y-0.5"
                style={{ ...delay(0.45), background: c.field, borderColor: c.border, color: c.text }}
              >
                <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </button>

              {error && (
                <p role="alert" className="mt-3 text-sm" style={{ color: c.error }}>
                  {error}
                </p>
              )}

              <div className="am-rise my-7 flex items-center gap-3" style={delay(0.55)}>
                <div className="h-px flex-1" style={{ background: c.border }}></div>
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.18em]"
                  style={{ color: c.muted }}
                >
                  or use email
                </span>
                <div className="h-px flex-1" style={{ background: c.border }}></div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="am-rise" style={delay(0.65)}>
                  <label className="block text-sm font-semibold">
                    Work email
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={handleEmailChange}
                      placeholder="you@company.com"
                      className="am-input mt-2 min-h-12 w-full rounded-xl border px-4 text-sm outline-none transition"
                      style={inputStyle}
                    />
                  </label>
                </div>

                <div className="am-rise" style={delay(0.75)}>
                  <label className="block text-sm font-semibold">
                    Password
                    <div className="relative mt-2">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={handlePasswordChange}
                        placeholder="Enter your password"
                        className="am-input min-h-12 w-full rounded-xl border px-4 pr-12 text-sm outline-none transition"
                        style={inputStyle}
                      />

                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-3.5 cursor-pointer text-xl transition hover:opacity-70 focus:outline-none"
                        style={{ color: c.muted }}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        <Icon icon={showPassword ? "lucide:eye-off" : "lucide:eye"} />
                      </button>
                    </div>
                  </label>
                </div>

                <div
                  className="am-rise flex items-center justify-between text-sm"
                  style={delay(0.85)}
                >
                  <label
                    className="flex cursor-pointer select-none items-center gap-2"
                    style={{ color: c.muted }}
                  >
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={handleRememberChange}
                      className="h-4 w-4 cursor-pointer rounded"
                      style={{ accentColor: TERRACOTTA }}
                    />
                    Remember me
                  </label>

                  <button
                    type="button"
                    onClick={() => navigate("/forgot-password")}
                    className="cursor-pointer font-bold transition hover:opacity-70"
                    style={{ color: c.link }}
                  >
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit"
                  className="am-btn am-rise flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-3 font-bold text-white"
                  style={{
                    ...delay(0.95),
                    background: c.btnBg,
                    borderColor: c.btnBorder,
                    boxShadow: `0 12px 28px ${c.btnShadow}`,
                  }}
                >
                  Enter workspace
                  <Icon icon="lucide:arrow-right" className="text-lg" />
                </button>
              </form>

              <p
                className="am-rise mt-8 text-center text-sm"
                style={{ ...delay(1.05), color: c.muted }}
              >
                New to AdMind?{" "}
                <button
                  type="button"
                  onClick={() => navigate("/signup")}
                  className="cursor-pointer font-bold underline underline-offset-4 transition hover:opacity-70"
                  style={{ color: c.link }}
                >
                  Create an account
                </button>
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}