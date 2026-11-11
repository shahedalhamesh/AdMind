import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, ClipboardEvent, CSSProperties, FormEvent, KeyboardEvent } from "react";
import { Icon } from "@iconify/react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../components/ThemeContext";
import {
  clearPendingUser,
  getPendingUser,
  markEmailVerified,
  saveUser,
} from "../services/auth";
import {
  DARK,
  LIGHT,
  TERRACOTTA,
  TURQUOISE,
  authCss,
  delay,
} from "../services/authTheme";

// DEV ONLY: replace with the Laravel API later (POST /auth/verify-code).
const DEV_CODE = "123456";
const RESEND_SECONDS = 60;
const LENGTH = 6;

function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  return `${name.slice(0, 2)}${"*".repeat(Math.max(name.length - 2, 2))}@${domain}`;
}

export default function Verify() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const c = theme === "dark" ? DARK : LIGHT;

  const [pending] = useState(() => getPendingUser());
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(""));
  const [error, setError] = useState<string>("");
  const [seconds, setSeconds] = useState<number>(RESEND_SECONDS);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!pending) navigate("/login", { replace: true });
  }, [pending, navigate]);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = window.setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [seconds]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  if (!pending) return null;

  const code = digits.join("");

  const handleChange = (i: number, e: ChangeEvent<HTMLInputElement>): void => {
    const d = e.target.value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = d;
    setDigits(next);
    setError("");
    if (d && i < LENGTH - 1) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>): void => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, LENGTH);
    if (!text) return;
    e.preventDefault();
    setDigits(Array.from({ length: LENGTH }, (_, k) => text[k] ?? ""));
    setError("");
    refs.current[Math.min(text.length, LENGTH - 1)]?.focus();
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (code.length < LENGTH) {
      setError("Please enter the 6-digit code.");
      return;
    }

    // TODO (backend): verify the code with Laravel, then continue.
    if (code === DEV_CODE) {
      markEmailVerified(pending.email);
      saveUser(pending);
      clearPendingUser();
      navigate("/dashboard", { replace: true });
    } else {
      setError("That code is not correct. Please try again.");
      setDigits(Array(LENGTH).fill(""));
      refs.current[0]?.focus();
    }
  };

  const handleResend = (): void => {
    if (seconds > 0) return;
    // TODO (backend): ask Laravel to send a new code.
    console.log("Resend code to:", pending.email);
    setSeconds(RESEND_SECONDS);
    setError("");
  };

  const handleChangeAccount = (): void => {
    clearPendingUser();
    navigate("/login", { replace: true });
  };

  return (
    <div
      className="relative flex min-h-screen w-full flex-col overflow-hidden"
      style={{ background: c.page, ["--am-ph" as string]: c.placeholder } as CSSProperties}
    >
      <style>{authCss}</style>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[46rem] w-[46rem] -translate-x-1/2 -translate-y-1/2 rounded-full border"
        style={{ borderColor: c.ring }}
      ></div>

      <button
        type="button"
        onClick={toggleTheme}
        aria-label="Toggle color theme"
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
            <div className="relative overflow-hidden p-8" style={{ background: c.leftBg, color: c.leftText }}>
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
                  style={{ background: c.logoBg, boxShadow: `0 10px 24px rgba(0,0,0,0.3), 0 0 0 3px ${TERRACOTTA}` }}
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
                    One-time verification
                  </p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-7 sm:p-10">
              <button
                type="button"
                onClick={handleChangeAccount}
                className="am-rise mb-9 flex cursor-pointer items-center gap-2 text-sm font-bold transition hover:-translate-x-1 hover:opacity-80"
                style={{ ...delay(0.1), color: c.muted }}
              >
                <Icon icon="lucide:arrow-left" className="text-lg" />
                Use a different account
              </button>

              <div className="am-rise mb-7" style={delay(0.2)}>
                <div
                  className="am-fl flex h-14 w-14 items-center justify-center rounded-xl text-white"
                  style={{ background: c.btnBg, boxShadow: `0 12px 28px ${c.btnShadow}` }}
                >
                  <Icon icon="lucide:mail-check" className="text-2xl" />
                </div>
              </div>

              <h1
                className="am-rise text-balance font-heading text-4xl font-semibold tracking-tight"
                style={delay(0.3)}
              >
                Check your{" "}
                <span className="am-hl" style={{ backgroundImage: c.highlight }}>
                  inbox.
                </span>
              </h1>

              <p
                className="am-rise mt-3 text-pretty text-sm leading-6"
                style={{ ...delay(0.4), color: c.muted }}
              >
                We sent a 6-digit code to{" "}
                <strong style={{ color: c.text }}>{maskEmail(pending.email)}</strong>. Enter it below to
                activate your account. You only need to do this once.
              </p>

              <form onSubmit={handleSubmit} className="mt-8">
                <div className="am-rise flex justify-between gap-2" style={delay(0.5)}>
                  {digits.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        refs.current[i] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      autoComplete={i === 0 ? "one-time-code" : "off"}
                      maxLength={1}
                      value={d}
                      onChange={(e) => handleChange(i, e)}
                      onKeyDown={(e) => handleKeyDown(i, e)}
                      onPaste={handlePaste}
                      aria-label={`Digit ${i + 1}`}
                      className="am-input h-14 w-full min-w-0 rounded-xl border text-center font-heading text-2xl font-semibold outline-none transition"
                      style={{ background: c.field, borderColor: c.border, color: c.text }}
                    />
                  ))}
                </div>

                {error && (
                  <p role="alert" className="mt-3 text-sm" style={{ color: c.error }}>
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  className="am-btn am-rise mt-6 flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-3 font-bold text-white"
                  style={{
                    ...delay(0.6),
                    background: c.btnBg,
                    borderColor: c.btnBorder,
                    boxShadow: `0 12px 28px ${c.btnShadow}`,
                  }}
                >
                  Verify and continue
                  <Icon icon="lucide:arrow-right" className="text-lg" />
                </button>
              </form>

              <p
                className="am-rise mt-6 text-center text-sm"
                style={{ ...delay(0.7), color: c.muted }}
              >
                Didn’t get it?{" "}
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={seconds > 0}
                  className="font-bold underline underline-offset-4 transition enabled:cursor-pointer enabled:hover:opacity-70 disabled:no-underline disabled:opacity-60"
                  style={{ color: c.link }}
                >
                  {seconds > 0 ? `Resend in ${seconds}s` : "Resend code"}
                </button>
              </p>

              {import.meta.env.DEV && (
                <p
                  className="mt-5 rounded-lg border px-3 py-2 text-center font-mono text-[10px] uppercase tracking-[0.14em]"
                  style={{ borderColor: c.border, color: c.muted }}
                >
                  Dev mode: use code {DEV_CODE}
                </p>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}