import { useState } from "react";
import type { ButtonHTMLAttributes, CSSProperties, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { usePortalTheme } from "../services/portalTheme";
import { ApiError } from "../services/api";

/* Small shared building blocks for the agency screens. They only use the colors of the current theme. */

export const RED = "#E5484D";
export const AMBER = "#D98E04";
export const GREEN = "#2F9E6B";

// First error message for a field from a 422 answer.
export function fieldError(err: unknown, field: string): string | undefined {
  if (err instanceof ApiError) return err.errors?.[field]?.[0];
  return undefined;
}

export function errorText(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return "Something went wrong. Please try again.";
}

function useControlStyle(): CSSProperties {
  const { p, dark } = usePortalTheme();
  return {
    // makes the native dropdown list (select options) dark in the dark theme, so its text is readable
    colorScheme: dark ? "dark" : "light",
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    borderRadius: 10,
    border: `1px solid ${p.border}`,
    background: "transparent",
    color: p.text,
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
  };
}

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  const { p } = usePortalTheme();
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600, color: p.muted, letterSpacing: ".02em" }}>{label}</span>
      {children}
      {hint && !error && <span style={{ display: "block", marginTop: 5, fontSize: 12, color: p.muted }}>{hint}</span>}
      {error && <span role="alert" style={{ display: "block", marginTop: 5, fontSize: 12, color: RED }}>{error}</span>}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const style = useControlStyle();
  return <input {...props} style={{ ...style, ...props.style }} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const style = useControlStyle();
  return <textarea {...props} style={{ ...style, minHeight: 90, resize: "vertical", lineHeight: 1.5, ...props.style }} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const style = useControlStyle();
  const { dark } = usePortalTheme();
  // The browser draws the open list itself: give its options a solid background and readable text.
  const listBg = dark ? "#101B32" : "#FFFFFF";
  const listText = dark ? "#FFFFFF" : "#111111";
  return (
    <>
      <style>{`.ui-select option{background:${listBg};color:${listText}}`}</style>
      <select {...props} className="ui-select" style={{ ...style, ...props.style }} />
    </>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger"; small?: boolean };

export function Btn({ variant = "ghost", small, style, disabled, ...rest }: BtnProps) {
  const { p } = usePortalTheme();
  const base: CSSProperties = {
    height: small ? 34 : 42,
    padding: small ? "0 14px" : "0 20px",
    borderRadius: 10,
    fontSize: small ? 13 : 14,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    whiteSpace: "nowrap",
  };
  const looks: Record<string, CSSProperties> = {
    primary: { border: "1px solid transparent", background: p.pri, color: "#fff" },
    ghost: { border: `1px solid ${p.border}`, background: "transparent", color: p.text },
    danger: { border: `1px solid ${RED}`, background: "transparent", color: RED },
  };
  return <button type="button" disabled={disabled} {...rest} style={{ ...base, ...looks[variant], ...style }} />;
}

export function Notice({ kind = "info", children }: { kind?: "info" | "success" | "warning" | "error"; children: ReactNode }) {
  const { p } = usePortalTheme();
  const color = kind === "error" ? RED : kind === "warning" ? AMBER : kind === "success" ? GREEN : p.link;
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      style={{ padding: "11px 14px", borderRadius: 10, border: `1px solid ${color}`, color: p.text, fontSize: 13, lineHeight: 1.5, background: "transparent", borderLeftWidth: 4 }}
    >
      {children}
    </div>
  );
}

export function Badge({ children, tone }: { children: ReactNode; tone?: "good" | "warn" | "bad" | "plain" }) {
  const { p } = usePortalTheme();
  const color = tone === "good" ? GREEN : tone === "warn" ? AMBER : tone === "bad" ? RED : p.muted;
  return (
    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, border: `1px solid ${color}`, color, fontSize: 11, fontWeight: 600, letterSpacing: ".04em", textTransform: "capitalize" }}>
      {children}
    </span>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  const { p } = usePortalTheme();
  return <div style={{ padding: 20, borderRadius: 16, border: `1px solid ${p.border}`, background: p.card, ...style }}>{children}</div>;
}

export function Modal({ title, onClose, children, width = 640 }: { title: string; onClose: () => void; children: ReactNode; width?: number }) {
  const { p } = usePortalTheme();
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "6vh 16px", overflowY: "auto" }}
    >
      <div style={{ width: "100%", maxWidth: width, borderRadius: 18, border: `1px solid ${p.border}`, background: p.bg, color: p.text, padding: 24, boxShadow: "0 24px 60px rgba(0,0,0,.4)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 500 }}>{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} style={{ border: 0, background: "transparent", color: p.muted, fontSize: 24, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// A list of short texts: type, press Enter (or comma) to add, click × to remove.
export function TagInput({ value, onChange, placeholder, disabled }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; disabled?: boolean }) {
  const { p } = usePortalTheme();
  const [draft, setDraft] = useState("");

  const add = () => {
    const parts = draft.split(/[,،]+/).map((s) => s.trim()).filter(Boolean);
    if (parts.length) onChange([...value, ...parts.filter((x) => !value.includes(x))]);
    setDraft("");
  };

  return (
    <div>
      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {value.map((t) => (
            <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, border: `1px solid ${p.border}`, background: p.card, fontSize: 13 }}>
              {t}
              {!disabled && (
                <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((x) => x !== t))} style={{ border: 0, background: "transparent", color: p.muted, cursor: "pointer", fontSize: 15, lineHeight: 1, padding: 0 }}>×</button>
              )}
            </span>
          ))}
        </div>
      )}
      {!disabled && (
        <TextInput
          value={draft}
          placeholder={placeholder ?? "Type and press Enter"}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          onBlur={add}
        />
      )}
    </div>
  );
}

export function Loading({ text = "Loading…" }: { text?: string }) {
  const { p } = usePortalTheme();
  return <div role="status" style={{ padding: "28px 0", color: p.muted, fontSize: 14 }}>{text}</div>;
}