import { useState } from "react";
import type { FormEvent, ChangeEvent, CSSProperties } from "react";
import { Icon } from "@iconify/react";
import { useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { useTheme } from "../components/ThemeContext";
import { useAuth } from "../components/AuthContext";
import { api, ApiError } from "../services/api";
import { homeFor, type LoginResponse } from "../services/auth";
import {
  DARK,
  LIGHT,
  NAVY,
  TERRACOTTA,
  TURQUOISE,
  authCss,
  delay,
} from "../services/authTheme";

// The Google button only works when the Client ID is set in .env (VITE_GOOGLE_CLIENT_ID).
const GOOGLE_ENABLED = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

const CORAL = "#FF7A59";

export default function AdmindWorkspace() {
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [rememberMe, setRememberMe] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const navigate = useNavigate();
  const { signIn } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const c = theme === "dark" ? DARK : LIGHT;

  const finish = (res: LoginResponse): void => {
    signIn(res, rememberMe);
    navigate(homeFor(res.user), { replace: true });
  };

  // Google gives an ID token (credential). The backend checks it and only signs in existing accounts.
  const handleGoogleSuccess = async (credential?: string): Promise<void> => {
    if (!credential) {
      setError("Google sign-in failed. Please try again.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await api<LoginResponse>("/login/google", {
        method: "POST",
        body: { credential, device_name: "web" },
      });
      finish(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Google sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSoon = (): void => {
    setError("Google sign-in will be available soon.");
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const res = await api<LoginResponse>("/login", {
        method: "POST",
        body: { email: email.trim(), password, device_name: "web" },
      });
      finish(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
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

            {/* coral glow (bottom-right corner) */}
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
              <circle cx="180" cy="180" r="70" fill="none" stroke={CORAL} strokeOpacity="0.6" />
              <circle cx="180" cy="180" r="112" fill="none" stroke={c.orbit} strokeOpacity="0.28" strokeDasharray="2 7" />
              <circle cx="180" cy="180" r="154" fill="none" stroke={c.orbit} strokeOpacity="0.18" />
              <g className="am-spin3"><circle cx="250" cy="180" r="4.5" fill={TURQUOISE} /></g>
              <g className="am-spin2">
                <circle cx="180" cy="68" r="4" fill={c.orbit} />
                <circle cx="180" cy="292" r="3" fill={c.orbit} fillOpacity="0.7" />
              </g>
              <g className="am-spin">
                <circle cx="334" cy="180" r="5" fill={CORAL} />
                <circle cx="26" cy="180" r="3" fill={c.orbit} fillOpacity="0.7" />
              </g>
            </svg>

            {/* Header */}
            <div className="am-rise relative flex items-center justify-between" style={delay(0.1)}>
              <div className="flex items-center gap-3">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{ background: c.logoBg, boxShadow: `0 0 0 1.5px ${CORAL}, 0 0 18px -4px rgba(255,122,89,0.55)` }}
                >
                  <Icon icon="lucide:brain-circuit" className="text-2xl" style={{ color: c.logoIcon }} />
                </div>
                <span className="font-heading text-xl font-bold tracking-[0.18em]">ADMIND</span>
              </div>

              <span
                className="inline-flex items-center gap-2.5 rounded-lg border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em]"
                style={{ borderColor: c.pillBorder, background: c.pillBg, boxShadow: "0 0 22px -6px rgba(77,216,255,0.5)" }}
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
              style={{ ...delay(0.8), background: c.cardBg, borderColor: c.cardBorder, boxShadow: "0 0 30px -10px rgba(77,216,255,0.4)" }}
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
                  style={{ borderColor: TURQUOISE }}
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
                  style={{ background: CORAL }}
                >
                  <Icon icon="lucide:pen-tool" className="text-xl text-white" />
                </div>

                <div
                  className="am-fl3 absolute bottom-2 left-28 flex h-10 w-10 items-center justify-center rounded-xl border"
                  style={{ background: "rgba(255,122,89,0.2)", borderColor: CORAL }}
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
                  className="flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{ background: c.logoBg, boxShadow: `0 0 0 1.5px ${CORAL}, 0 0 18px -4px rgba(255,122,89,0.55)` }}
                >
                  <Icon icon="lucide:brain-circuit" className="text-2xl" style={{ color: c.logoIcon }} />
                </div>
                <p className="mt-4 font-heading text-lg font-bold tracking-[0.18em]">ADMIND</p>
              </div>

              <p
                className="am-rise flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em]"
                style={delay(0.15)}
              >
                <span className="h-[3px] w-9 rounded" style={{ background: CORAL }}></span>
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
              {GOOGLE_ENABLED ? (
                <div
                  className="am-rise mt-8 flex min-h-12 w-full justify-center"
                  style={delay(0.45)}
                >
                  <GoogleLogin
                    onSuccess={(r) => handleGoogleSuccess(r.credential)}
                    onError={() => setError("Google sign-in failed. Please try again.")}
                    theme={theme === "dark" ? "filled_black" : "outline"}
                    size="large"
                    text="continue_with"
                    shape="rectangular"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleGoogleSoon}
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
              )}

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
                  disabled={loading}
                  className="am-btn am-rise flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-70"
                  style={{
                    ...delay(0.95),
                    background: c.btnBg,
                    borderColor: c.btnBorder,
                    boxShadow: `0 12px 28px ${c.btnShadow}`,
                  }}
                >
                  {loading ? "Signing in…" : "Enter workspace"}
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