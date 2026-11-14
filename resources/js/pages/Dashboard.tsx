import { Fragment, useEffect, useMemo, useState } from "react";
import { getUser } from "../services/auth";
import { usePortalTheme, type Pal } from "../services/portalTheme";
import { useNavigate } from "react-router-dom";

/* ---------- Types ---------- */
type StoredClient = {
  id: string; name: string; industry: string; sells: string; audience: string;
  tones: string[]; dialect: string[]; colors: string[]; avoid: string; notes: string;
};

// The reel journey: AI + employee -> manager -> client -> published
type Stage = "draft" | "employee" | "manager" | "client" | "published";
type Reel = {
  id: string; client: string; title: string; employee: string;
  stage: Stage; sentAgo: string; note?: string;
};

const STAGES: { id: Stage; label: string }[] = [
  { id: "draft", label: "Draft" },
  { id: "employee", label: "Employee review" },
  { id: "manager", label: "Waiting for you" },
  { id: "client", label: "With client" },
  { id: "published", label: "Published" },
];

const COLORS = ["#A64B35", "#0E7C85", "#6E2A19", "#2E4A7A", "#7A5A1E", "#4A2C6B"];

/* ---------- Data ---------- */
function loadClients(): StoredClient[] {
  try {
    const raw = localStorage.getItem("admind_clients");
    const list = raw ? (JSON.parse(raw) as StoredClient[]) : [];
    return list.filter((c) => c.name?.trim());
  } catch { return []; }
}

const completion = (c: StoredClient) => {
  const parts = [!!c.industry, !!c.sells, !!c.audience, c.tones?.length > 0, c.dialect?.length > 0, c.colors?.length > 0, !!c.avoid, !!c.notes];
  return Math.round((parts.filter(Boolean).length / parts.length) * 100);
};
const initials = (n: string) => n.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

// DEMO DATA until the backend is connected (GET /api/content?status=...).
const REEL_TEMPLATES: Omit<Reel, "id" | "client">[] = [
  { title: "Winter collection reel", employee: "Sara", stage: "manager", sentAgo: "20 min ago" },
  { title: "Ramadan offer reel", employee: "Omar", stage: "manager", sentAgo: "2 hours ago" },
  { title: "Product teaser", employee: "Sara", stage: "manager", sentAgo: "Yesterday", note: "Client asked for a shorter intro and different music." },
  { title: "Behind the scenes", employee: "Sara", stage: "client", sentAgo: "Yesterday" },
  { title: "New menu launch", employee: "Lina", stage: "employee", sentAgo: "Today" },
  { title: "Weekend promo", employee: "Lina", stage: "draft", sentAgo: "Today" },
  { title: "Customer story", employee: "Omar", stage: "published", sentAgo: "3 days ago" },
  { title: "Grand opening recap", employee: "Omar", stage: "published", sentAgo: "5 days ago" },
];

function makeDemoReels(clients: StoredClient[]): Reel[] {
  if (clients.length === 0) return [];
  return REEL_TEMPLATES.map((t, i) => ({ ...t, id: `r${i}`, client: clients[i % clients.length].name }));
}

/* ---------- Small UI ---------- */
function Card({ p, children, style }: { p: Pal; children: React.ReactNode; style?: React.CSSProperties }) {
  return <section style={{ borderRadius: 16, border: `1px solid ${p.border}`, background: p.card, ...style }}>{children}</section>;
}
const H2 = ({ p, children }: { p: Pal; children: React.ReactNode }) => (
  <h2 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 21, fontWeight: 500, color: p.text }}>{children}</h2>
);
const IconBox = ({ p, size = 34, children }: { p: Pal; size?: number; children: React.ReactNode }) => (
  <div style={{ width: size, height: size, borderRadius: size > 36 ? 11 : 10, background: p.iconBg, color: p.iconFg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{children}</div>
);
const Svg = ({ size = 17, children }: { size?: number; children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);
const Empty = ({ p, text }: { p: Pal; text: string }) => (
  <div style={{ padding: "22px", fontSize: 13, lineHeight: 1.6, color: p.muted }}>{text}</div>
);

/* ---------- Page (Company Manager home) ---------- */
export default function Dashboard() {
  const { p } = usePortalTheme();
  const user = getUser();
  const navigate = useNavigate();
  const firstName = user?.name?.split(" ")[0] ?? "there";

  const clients = useMemo(loadClients, []);
  const reels = useMemo(() => makeDemoReels(clients), [clients]);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 2200);
    return () => clearTimeout(t);
  }, [notice]);
  const soon = () => setNotice("This part is coming soon.");

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  const count = (s: Stage) => reels.filter((r) => r.stage === s).length;
  const waiting = reels.filter((r) => r.stage === "manager");
  const countFor = (client: string, s: Stage) => reels.filter((r) => r.client === client && r.stage === s).length;

  const team = useMemo(() => {
  try {
    const raw = localStorage.getItem("admind_team");
    const stored = raw ? (JSON.parse(raw) as { name: string; clients: string[] }[]) : [];
    if (stored.length > 0) {
      return stored.map((e) => ({
        name: e.name,
        clients: new Set(e.clients.map((id) => clients.find((c) => c.id === id)?.name).filter((n): n is string => !!n)),
        active: reels.filter((r) => r.employee === e.name && r.stage !== "published").length,
      }));
    }
  } catch { /* ignore */ }
  const m = new Map<string, { name: string; clients: Set<string>; active: number }>();
  reels.forEach((r) => {
    const e = m.get(r.employee) ?? { name: r.employee, clients: new Set<string>(), active: 0 };
    e.clients.add(r.client);
    if (r.stage !== "published") e.active += 1;
    m.set(r.employee, e);
  });
  return Array.from(m.values());
}, [reels, clients]);

  // DEMO alerts: publishing failures, things the AI cannot decide alone.
  const alerts = clients.length === 0 ? [] : [
    { id: "a1", client: clients[0].name, text: "Publishing failed. The Instagram login expired." },
    { id: "a2", client: clients[Math.min(1, clients.length - 1)].name, text: "The AI needs a decision on conflicting instructions." },
  ];

  const subtitle =
    clients.length === 0 ? "Add your first client to get started."
    : waiting.length > 0 ? `You have ${waiting.length} reel${waiting.length === 1 ? "" : "s"} waiting for your approval.`
    : "Nothing is waiting for you right now.";

  const linkBtn: React.CSSProperties = { border: 0, background: "none", color: p.link, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, color: p.text }}>
      <style>{`
        @keyframes pl-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        .pl-rise{animation:pl-rise .7s cubic-bezier(.2,.7,.2,1) backwards}
        .pl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:16px}
        .pl-two{display:grid;grid-template-columns:1fr 1fr;gap:22px}
        .pl-client:hover{transform:translateY(-2px)}
        @media (max-width: 900px){.pl-two{grid-template-columns:1fr}.pl-arrow{display:none!important}}
        @media (prefers-reduced-motion: reduce){*{animation:none!important;transition:none!important}}
      `}</style>

      {/* Greeting */}
      <div className="pl-rise" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
        <div>
          <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 12, fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: p.eyeb }}>
            <span style={{ width: 32, height: 3, borderRadius: 2, background: "#C75B41" }} />{today}
          </p>
          <h1 style={{ margin: "12px 0 0", fontFamily: "Georgia, serif", fontSize: 38, fontWeight: 500, letterSpacing: "-.02em" }}>{greeting}, {firstName}.</h1>
          <p style={{ margin: "8px 0 0", fontSize: 15, color: p.muted }}>{subtitle}</p>
        </div>
        <button type="button" onClick={soon}
          style={{ height: 48, padding: "0 22px", borderRadius: 10, border: `1px solid ${p.priB}`, background: p.pri, color: "#fff", font: "600 14px Inter, system-ui", cursor: "pointer", display: "flex", alignItems: "center", gap: 9, boxShadow: `0 12px 26px ${p.priSh}` }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12h14M12 5v14" /></svg>Add client
        </button>
      </div>

      {/* Journey of a reel */}
      <Card p={p} style={{ padding: "18px 22px" }}>
        <div style={{ marginBottom: 14, fontSize: 13, fontWeight: 600, color: p.muted }}>Where your reels are right now</div>
        <div style={{ display: "flex", alignItems: "stretch", gap: 8, flexWrap: "wrap" }}>
          {STAGES.map((s, i) => {
            const mine = s.id === "manager";
            return (
              <Fragment key={s.id}>
                <div style={{ flex: "1 1 130px", minWidth: 120, padding: "14px 16px", borderRadius: 12, border: `1px solid ${mine ? p.priB : p.border}`, background: mine ? p.pri : p.field, color: mine ? "#fff" : p.text }}>
                  <div style={{ fontFamily: "Georgia, serif", fontSize: 32, lineHeight: 1 }}>{count(s.id)}</div>
                  <div style={{ marginTop: 6, fontSize: 13, fontWeight: 600 }}>{s.label}</div>
                </div>
                {i < STAGES.length - 1 && (
                  <span className="pl-arrow" style={{ display: "flex", alignItems: "center", color: p.muted }}><Svg><path d="m9 6 6 6-6 6" /></Svg></span>
                )}
              </Fragment>
            );
          })}
        </div>
      </Card>

      {/* Waiting for your approval */}
      <Card p={p} style={{ overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: `1px solid ${p.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <H2 p={p}>Waiting for your approval</H2>
            {waiting.length > 0 && <span style={{ padding: "3px 10px", borderRadius: 99, background: p.pri, color: "#fff", fontSize: 12, fontWeight: 700 }}>{waiting.length}</span>}
          </div>
        </div>
        {waiting.length === 0 ? (
          <Empty p={p} text="When an employee approves a reel, it appears here with a link for you to review." />
        ) : (
          waiting.map((r, i) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 22px", borderBottom: i === waiting.length - 1 ? 0 : `1px solid ${p.border}`, flexWrap: "wrap" }}>
              <IconBox p={p} size={46}><Svg size={20}><polygon points="6 4 20 12 6 20 6 4" /></Svg></IconBox>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{r.title}</div>
                <div style={{ marginTop: 3, fontSize: 12, color: p.muted }}>{r.client} · by {r.employee} · {r.sentAgo}</div>
                {r.note && (
                  <div style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 8, background: p.chipBg, color: p.chipFg, fontSize: 12, fontWeight: 600 }}>
                    <Svg size={13}><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></Svg>{r.note}
                  </div>
                )}
              </div>
              <button type="button" onClick={soon}
                style={{ height: 40, padding: "0 18px", borderRadius: 10, border: `1px solid ${p.priB}`, background: p.pri, color: "#fff", font: "600 13px Inter, system-ui", cursor: "pointer", whiteSpace: "nowrap" }}>
                Open and review
              </button>
            </div>
          ))
        )}
      </Card>

      {/* Clients: one card each */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <H2 p={p}>Your clients</H2>
          <button type="button" onClick={soon} style={linkBtn}>See all</button>
        </div>
        {clients.length === 0 ? (
          <Card p={p}><Empty p={p} text="No clients yet. Add the clients you work with, and the AI will learn how each one likes to be presented." /></Card>
        ) : (
          <div className="pl-grid">
            {clients.map((c, i) => {
              const pct = completion(c);
              const ig = i % 2 === 0; // DEMO: replace with the client's real Instagram connection status
              const mini = (label: string, n: number, hot?: boolean) => (
                <div style={{ flex: 1, padding: "10px 8px", borderRadius: 10, background: hot && n > 0 ? p.pri : p.field, color: hot && n > 0 ? "#fff" : p.text, textAlign: "center" }}>
                  <div style={{ fontFamily: "Georgia, serif", fontSize: 22, lineHeight: 1 }}>{n}</div>
                  <div style={{ marginTop: 4, fontSize: 11, fontWeight: 600, opacity: hot && n > 0 ? 1 : 0.8 }}>{label}</div>
                </div>
              );
              return (
                <button key={c.id} type="button" onClick={soon} className="pl-client"
                  style={{ textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: p.text, padding: 18, borderRadius: 16, border: `1px solid ${p.border}`, background: p.card, transition: "transform .2s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: COLORS[i % COLORS.length], color: "#fff", fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{initials(c.name)}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: p.muted, marginTop: 2 }}>{c.industry || "No industry yet"}</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
                    {mini("With you", countFor(c.name, "manager"), true)}
                    {mini("With client", countFor(c.name, "client"))}
                    {mini("Published", countFor(c.name, "published"))}
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: p.muted }}>
                      <span>Brand profile</span><b style={{ color: p.text }}>{pct}%</b>
                    </div>
                    <div style={{ marginTop: 6, height: 5, borderRadius: 99, background: p.track }}>
                      <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: "linear-gradient(90deg,#A64B35,#E0775A)", transition: "width .6s" }} />
                    </div>
                  </div>

                  <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, color: ig ? p.good : p.muted }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: ig ? p.good : p.border }} />
                    {ig ? "Instagram connected" : "Instagram not connected"}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Team + Alerts */}
      <div className="pl-two">
        <Card p={p} style={{ overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: `1px solid ${p.border}` }}>
  <H2 p={p}>Your team</H2>
  <button type="button" onClick={() => navigate("/team")} style={linkBtn}>Manage team</button>
</div>
          {team.length === 0 ? (
            <Empty p={p} text="Your employees and the clients they handle will show here." />
          ) : (
            team.map((e, i) => (
              <div key={e.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 22px", borderBottom: i === team.length - 1 ? 0 : `1px solid ${p.border}` }}>
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: COLORS[i % COLORS.length], color: "#fff", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{initials(e.name)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{e.name}</div>
                  <div style={{ marginTop: 2, fontSize: 12, color: p.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{Array.from(e.clients).join(", ") || "No clients yet"}</div>
                </div>
                <span style={{ padding: "4px 11px", borderRadius: 99, background: p.chipBg, color: p.chipFg, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{e.active} in progress</span>
              </div>
            ))
          )}
        </Card>

        <Card p={p} style={{ overflow: "hidden" }}>
          <div style={{ padding: "16px 22px", borderBottom: `1px solid ${p.border}` }}><H2 p={p}>Needs attention</H2></div>
          {alerts.length === 0 ? (
            <Empty p={p} text="Publishing problems and decisions the AI cannot make alone will show here." />
          ) : (
            alerts.map((a, i) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 22px", borderBottom: i === alerts.length - 1 ? 0 : `1px solid ${p.border}` }}>
                <IconBox p={p}><Svg><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></Svg></IconBox>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{a.text}</div>
                  <div style={{ marginTop: 2, fontSize: 12, color: p.muted }}>{a.client}</div>
                </div>
                <button type="button" onClick={soon} style={linkBtn}>Open</button>
              </div>
            ))
          )}
        </Card>
      </div>

      <p style={{ margin: 0, fontSize: 12, color: p.muted }}>
        Reels, team and alerts show demo data until the backend is connected. Your clients are real.
      </p>

      {notice && (
        <div role="status" style={{ position: "fixed", left: "50%", bottom: 28, transform: "translateX(-50%)", padding: "12px 20px", borderRadius: 12, background: p.text, color: p.bg, fontSize: 14, fontWeight: 600, boxShadow: "0 12px 30px rgba(0,0,0,.25)", zIndex: 50 }}>{notice}</div>
      )}
    </div>
  );
}