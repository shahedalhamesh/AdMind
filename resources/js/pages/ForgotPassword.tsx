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

function ForgotPassword() {
  const [email, setEmail] = useState<string>("");
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const c = theme === "dark" ? DARK : LIGHT;

  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setEmail(e.target.value);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();

    // Password recovery logic will be connected to the backend later.
    console.log("Password recovery requested for:", email);
  };

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

      <main className="relative z-10 flex flex-1 items-center justify-center p-5">
        <div className="w-full max-w-lg">
          <section
            className="am-rise overflow-hidden rounded-2xl border"
            style={{
              borderColor: c.frame,
              boxShadow: `0 30px 80px ${c.frameShadow}`,
              background: c.rightBg,
              color: c.text,
            }}
          >
            {/* Header */}
            <div
              className="relative overflow-hidden p-8"
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
                className="am-fade pointer-events-none absolute -right-16 -top-20 h-64 w-64 opacity-80"
              >
                <circle cx="180" cy="180" r="70" fill="none" stroke="#C75B41" strokeOpacity="0.6" />
                <circle cx="180" cy="180" r="112" fill="none" stroke={c.orbit} strokeOpacity="0.28" strokeDasharray="2 7" />
                <circle cx="180" cy="180" r="154" fill="none" stroke={c.orbit} strokeOpacity="0.18" />
                <g className="am-spin3"><circle cx="250" cy="180" r="5" fill={TURQUOISE} /></g>
                <g className="am-spin"><circle cx="334" cy="180" r="6" fill={TERRACOTTA} /></g>
              </svg>

              <div className="relative flex items-center gap-4">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-xl"
                  style={{
                    background: c.logoBg,
                    boxShadow: `0 10px 24px rgba(0,0,0,0.3), 0 0 0 3px ${TERRACOTTA}`,
                  }}
                >
                  <Icon icon="lucide:brain-circuit" className="text-3xl" style={{ color: c.logoIcon }} />
                </div>

                <div>
                  <p className="font-heading text-xl font-bold tracking-[0.18em]">ADMIND</p>
                  <p
                    className="mt-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em]"
                    style={{ color: c.eyebrow }}
                  >
                    <span className="am-live h-[7px] w-[7px] rounded-full" style={{ background: c.live }}></span>
                    Identity recovery
                  </p>
                </div>
              </div>
            </div>

            {/* Form Content */}
            <div className="p-7 sm:p-10">
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="am-rise mb-9 flex cursor-pointer items-center gap-2 text-sm font-bold transition hover:-translate-x-1 hover:opacity-80"
                style={{ ...delay(0.1), color: c.muted }}
              >
                <Icon icon="lucide:arrow-left" className="text-lg" />
                Back to sign in
              </button>

              <div
                className="am-rise mb-7"
                style={delay(0.2)}
              >
                <div
                  className="am-fl flex h-14 w-14 items-center justify-center rounded-xl text-white shadow-xl"
                  style={{ background: c.btnBg, boxShadow: `0 12px 28px ${c.btnShadow}` }}
                >
                  <Icon icon="lucide:key-round" className="text-2xl" />
                </div>
              </div>

              <h1
                className="am-rise text-balance font-heading text-4xl font-semibold tracking-tight"
                style={delay(0.3)}
              >
                Reset your{" "}
                <span className="am-hl" style={{ backgroundImage: c.highlight }}>
                  password.
                </span>
              </h1>

              <p
                className="am-rise mt-3 text-pretty text-sm leading-6"
                style={{ ...delay(0.4), color: c.muted }}
              >
                Enter the email connected to your AdMind workspace. We’ll send
                a secure recovery link shortly.
              </p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <label className="am-rise block text-sm font-semibold" style={delay(0.5)}>
                  Work email
                  <input
                    type="email"
                    value={email}
                    onChange={handleEmailChange}
                    placeholder="you@company.com"
                    required
                    className="am-input mt-2 min-h-12 w-full rounded-xl border px-4 text-sm outline-none transition"
                    style={{ background: c.field, borderColor: c.border, color: c.text }}
                  />
                </label>

                <button
                  type="submit"
                  className="am-btn am-rise flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-3 font-bold text-white"
                  style={{
                    ...delay(0.6),
                    background: c.btnBg,
                    borderColor: c.btnBorder,
                    boxShadow: `0 12px 28px ${c.btnShadow}`,
                  }}
                >
                  Send recovery link
                  <Icon icon="lucide:send" className="text-lg" />
                </button>
              </form>

              {/* Security Notice */}
              <div
                className="am-rise mt-8 flex gap-3 rounded-xl border p-4"
                style={{ ...delay(0.75), background: c.field, borderColor: c.border }}
              >
                <Icon
                  icon="lucide:shield-check"
                  className="mt-0.5 text-xl"
                  style={{ color: c.link }}
                />
                <p className="text-xs leading-5" style={{ color: c.muted }}>
                  For your security, recovery links expire after 30 minutes
                  and can only be used once.
                </p>
              </div>
            </div>
          </section>

          <p
            className="am-rise mt-6 text-center font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ ...delay(0.9), color: c.leftText === NAVY ? NAVY : c.muted }}
          >
            AdMind · multi-agent intelligence
          </p>
        </div>
      </main>
    </div>
  );
}

export default ForgotPassword;