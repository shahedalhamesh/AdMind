import { useState } from "react";
import type { FormEvent, ChangeEvent, CSSProperties } from "react";
import { Icon } from "@iconify/react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../components/ThemeContext";
import {
  DARK,
  LIGHT,
  NAVY,
  TERRACOTTA,
  TURQUOISE,
  authCss,
  delay,
} from "../services/authTheme";

export default function SignUp() {
  const [fullName, setFullName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");

  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const c = theme === "dark" ? DARK : LIGHT;

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();

    console.log("Workspace creation submitted:", {
      fullName,
      email,
      password,
    });
  };

  const handleNameChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setFullName(e.target.value);
  };

  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setEmail(e.target.value);
  };

  const handlePasswordChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setPassword(e.target.value);
  };

  const inputStyle: CSSProperties = {
    background: c.field,
    borderColor: c.border,
    color: c.text,
  };

  const inputClass =
    "am-input mt-2 min-h-12 w-full rounded-xl border px-4 text-sm outline-none transition";

  const features = [
    { icon: "lucide:search", label: "Research", bg: TURQUOISE, fg: NAVY, anim: "am-fl", d: 0.8 },
    { icon: "lucide:layers", label: "Coordinate", bg: "#C75B41", fg: "#FFFFFF", anim: "am-fl2", d: 0.95 },
    { icon: "lucide:chart-bar", label: "Decide", bg: TERRACOTTA, fg: "#FFFFFF", anim: "am-fl3", d: 1.1 },
  ];

  return (
    <div
      className="relative flex min-h-screen w-full flex-col overflow-hidden"
      style={{ background: c.page, ["--am-ph" as string]: c.placeholder } as CSSProperties}
    >
      <style>{authCss}</style>

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
          className="w-full max-w-7xl overflow-hidden rounded-2xl border lg:grid lg:grid-cols-[1.1fr_0.9fr]"
          style={{
            borderColor: c.frame,
            boxShadow: `0 30px 80px ${c.frameShadow}`,
            background: c.rightBg,
          }}
        >
          {/* Left Section (Desktop Only) */}
          <section
            className="relative hidden min-h-[680px] overflow-hidden p-12 lg:flex lg:flex-col"
            style={{ background: c.leftBg, color: c.leftText }}
          >
            <div
              aria-hidden="true"
              className="am-grid absolute inset-0"
              style={{
                backgroundImage: `linear-gradient(${c.grid} 1px,transparent 1px),linear-gradient(90deg,${c.grid} 1px,transparent 1px)`,
              }}
            ></div>

            <div
              aria-hidden="true"
              className="absolute inset-0"
              style={{
                background: `radial-gradient(circle at 100% 100%, ${c.glow1} 0%, ${c.glow2} 38%, transparent 70%)`,
              }}
            ></div>

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

            {/* Logo */}
            <div className="am-rise relative flex items-center gap-3" style={delay(0.1)}>
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ background: c.logoBg, boxShadow: `0 10px 24px rgba(0,0,0,0.3), 0 0 0 3px ${TERRACOTTA}` }}
              >
                <Icon icon="lucide:brain-circuit" className="text-2xl" style={{ color: c.logoIcon }} />
              </div>
              <span className="font-heading text-xl font-bold tracking-[0.18em]">ADMIND</span>
            </div>

            {/* Headline */}
            <div className="relative my-auto max-w-xl">
              <p
                className="am-rise mb-5 font-mono text-xs uppercase tracking-[0.24em]"
                style={{ ...delay(0.25), color: c.eyebrow }}
              >
                Build your agent constellation
              </p>

              <h1
                className="am-rise text-balance font-heading text-5xl font-semibold leading-[1.1] tracking-tight"
                style={delay(0.4)}
              >
                Your next great team is{" "}
                <span className="am-hl" style={{ backgroundImage: c.highlight }}>
                  already thinking.
                </span>
              </h1>

              <p
                className="am-rise mt-6 max-w-md text-pretty text-base leading-7"
                style={{ ...delay(0.6), color: c.leftText2 }}
              >
                Create an intelligent workspace where research, strategy, copy, and analytics agents move as one.
              </p>
            </div>

            {/* Feature cards */}
            <div className="relative grid grid-cols-3 gap-4">
              {features.map((f, i) => (
                <div
                  key={f.label}
                  className={`am-rise ${i === 1 ? "mt-9" : ""}`}
                  style={delay(f.d)}
                >
                  <div
                    className="rounded-xl border p-5 transition duration-300 hover:-translate-y-2"
                    style={{ background: c.cardBg, borderColor: c.cardBorder }}
                  >
                    <div
                      className={`${f.anim} flex h-11 w-11 items-center justify-center rounded-xl shadow-lg`}
                      style={{ background: f.bg }}
                    >
                      <Icon icon={f.icon} className="text-2xl" style={{ color: f.fg }} />
                    </div>
                    <p
                      className="mt-8 font-mono text-[10px] uppercase tracking-[0.18em]"
                      style={{ color: c.leftText2 }}
                    >
                      {f.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Right Section (Form) */}
          <section
            className="flex items-center justify-center p-7 sm:p-12"
            style={{ background: c.rightBg, color: c.text }}
          >
            <div className="w-full max-w-sm">
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="am-rise mb-9 flex cursor-pointer items-center gap-2 text-sm font-bold transition hover:-translate-x-1 hover:opacity-80"
                style={{ ...delay(0.1), color: c.muted }}
              >
                <Icon icon="lucide:arrow-left" className="text-lg" />
                Back to sign in
              </button>

              <p
                className="am-rise flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em]"
                style={delay(0.15)}
              >
                <span className="h-[3px] w-9 rounded" style={{ background: "#C75B41" }}></span>
                Join AdMind
              </p>

              <h1
                className="am-rise mt-3 text-balance font-heading text-4xl font-semibold tracking-tight"
                style={delay(0.25)}
              >
                Create your workspace.
              </h1>

              <p
                className="am-rise mt-3 text-sm leading-6"
                style={{ ...delay(0.35), color: c.muted }}
              >
                Bring your multi-agent team online in under a minute.
              </p>

              <button
                type="button"
                className="am-rise mt-7 flex min-h-12 w-full cursor-pointer items-center justify-center gap-3 rounded-xl border px-4 py-3 text-sm font-bold transition duration-300 hover:-translate-y-0.5"
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

              <div className="am-rise my-6 flex items-center gap-3" style={delay(0.55)}>
                <div className="h-px flex-1" style={{ background: c.border }}></div>
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.18em]"
                  style={{ color: c.muted }}
                >
                  or use email
                </span>
                <div className="h-px flex-1" style={{ background: c.border }}></div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <label className="am-rise block text-sm font-semibold" style={delay(0.65)}>
                  Full name
                  <input
                    type="text"
                    value={fullName}
                    onChange={handleNameChange}
                    placeholder="How should we address you?"
                    className={inputClass}
                    style={inputStyle}
                    required
                  />
                </label>

                <label className="am-rise block text-sm font-semibold" style={delay(0.75)}>
                  Work email
                  <input
                    type="email"
                    value={email}
                    onChange={handleEmailChange}
                    placeholder="you@company.com"
                    className={inputClass}
                    style={inputStyle}
                    required
                  />
                </label>

                <label className="am-rise block text-sm font-semibold" style={delay(0.85)}>
                  Create password
                  <input
                    type="password"
                    value={password}
                    onChange={handlePasswordChange}
                    placeholder="At least 8 characters"
                    className={inputClass}
                    style={inputStyle}
                    required
                    minLength={8}
                  />
                </label>

                <button
                  type="submit"
                  className="am-btn am-rise mt-3 flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-3 font-bold text-white"
                  style={{
                    ...delay(0.95),
                    background: c.btnBg,
                    borderColor: c.btnBorder,
                    boxShadow: `0 12px 28px ${c.btnShadow}`,
                  }}
                >
                  Create workspace
                  <Icon icon="lucide:arrow-right" className="text-lg" />
                </button>
              </form>

              <p
                className="am-rise mt-5 text-center text-xs leading-5"
                style={{ ...delay(1.05), color: c.muted }}
              >
                By continuing, you agree to the AdMind Terms of Use and Privacy Policy.
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}