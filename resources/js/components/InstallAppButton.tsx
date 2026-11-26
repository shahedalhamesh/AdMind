import { useEffect, useState } from "react";
import { usePortalTheme } from "../services/portalTheme";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// The browser fires this once, early. Catch it at module load so we never miss it.
let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export default function InstallAppButton() {
  const { p } = usePortalTheme();
  const [, force] = useState(0);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const f = () => force((n) => n + 1);
    listeners.add(f);
    return () => { listeners.delete(f); };
  }, []);

  if (isStandalone()) return null;
  const canPrompt = !!deferred;
  const ios = isIos();
  if (!canPrompt && !ios) return null;

  const click = async () => {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      deferred = null;
      notify();
    } else {
      setHelp(true);
    }
  };

  return (
    <>
      <button type="button" onClick={click}
        style={{ flexShrink: 0, width: "100%", height: 38, marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 10, border: `1px solid ${p.border}`, background: p.card, color: p.text, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="m7 11 5 5 5-5" /><path d="M5 21h14" /></svg>
        Install app
      </button>

      {help && (
        <div onClick={() => setHelp(false)}
          style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 340, width: "100%", background: p.card, color: p.text, border: `1px solid ${p.border}`, borderRadius: 16, padding: 22 }}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Install AdMind</div>
            <ol style={{ margin: 0, paddingInlineStart: 20, lineHeight: 1.9, fontSize: 14, color: p.muted }}>
              <li>Tap the <b style={{ color: p.text }}>Share</b> button in Safari.</li>
              <li>Choose <b style={{ color: p.text }}>Add to Home Screen</b>.</li>
              <li>Tap <b style={{ color: p.text }}>Add</b>.</li>
            </ol>
            <button type="button" onClick={() => setHelp(false)}
              style={{ marginTop: 16, width: "100%", height: 38, borderRadius: 10, border: `1px solid ${p.border}`, background: "transparent", color: p.text, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}