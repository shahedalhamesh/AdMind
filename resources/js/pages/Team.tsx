import { useEffect, useMemo, useState } from "react";
import { usePortalTheme, type Pal } from "../services/portalTheme";

type Role = "Employee" | "Manager";
type Employee = {
  id: string; name: string; email: string; phone: string;
  role: Role; clients: string[]; status: "Invited" | "Active"; added: string;
};
type ClientLite = { id: string; name: string; industry?: string };

// Temporary storage until the backend exists:
// users -> GET/POST /api/users, responsible employee per client -> UC-06.
const STORE_TEAM = "admind_team";
const STORE_CLIENTS = "admind_clients";
const COLORS = ["#A64B35", "#0E7C85", "#6E2A19", "#2E4A7A", "#7A5A1E", "#4A2C6B"];

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now() + Math.random());
const initials = (n: string) => n.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

function loadTeam(): Employee[] {
  try {
    const raw = localStorage.getItem(STORE_TEAM);
    return raw ? (JSON.parse(raw) as Employee[]) : [];
  } catch { return []; }
}
function loadClients(): ClientLite[] {
  try {
    const raw = localStorage.getItem(STORE_CLIENTS);
    const list = raw ? (JSON.parse(raw) as ClientLite[]) : [];
    return list.filter((c) => c.name?.trim());
  } catch { return []; }
}

const fieldStyle = (p: Pal): React.CSSProperties => ({
  width: "100%", boxSizing: "border-box", height: 46, padding: "0 14px", borderRadius: 10,
  border: `1px solid ${p.border}`, background: p.field, color: p.text, fontSize: 14, fontFamily: "inherit", outline: "none",
});

const Svg = ({ size = 17, children }: { size?: number; children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);

export default function Team() {
  const { p } = usePortalTheme();
  const clients = useMemo(loadClients, []);
  const [team, setTeam] = useState<Employee[]>(loadTeam);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "Employee" as Role });
  const [error, setError] = useState("");
  const [picker, setPicker] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  useEffect(() => {
    try { localStorage.setItem(STORE_TEAM, JSON.stringify(team)); } catch { /* ignore */ }
  }, [team]);

  const shown = team.filter((e) => {
    const q = query.trim().toLowerCase();
    return !q || e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q);
  });

  const ownerOf = (clientId: string) => team.find((e) => e.clients.includes(clientId));

  // One responsible employee per client: assigning moves the client from any other employee.
  const toggleClient = (empId: string, clientId: string) =>
    setTeam((list) =>
      list.map((e) => {
        if (e.id !== empId) return { ...e, clients: e.clients.filter((x) => x !== clientId) };
        return e.clients.includes(clientId)
          ? { ...e, clients: e.clients.filter((x) => x !== clientId) }
          : { ...e, clients: [...e.clients, clientId] };
      })
    );

  const addEmployee = () => {
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    if (!name) return setError("Please enter the employee's name.");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Please enter a valid email.");
    if (team.some((e) => e.email === email)) return setError("An employee with this email already exists.");
    // TODO (backend): POST /api/users { name, email, phone, role } and send the invitation email.
    setTeam((l) => [...l, { id: uid(), name, email, phone: form.phone.trim(), role: form.role, clients: [], status: "Invited", added: new Date().toISOString() }]);
    setForm({ name: "", email: "", phone: "", role: "Employee" });
    setError("");
    setShowForm(false);
  };

  const removeEmployee = (id: string) => {
    // TODO (backend): DELETE /api/users/{id}
    setTeam((l) => l.filter((e) => e.id !== id));
    setConfirm(null);
    if (picker === id) setPicker(null);
  };

  const ghostBtn: React.CSSProperties = {
    height: 36, padding: "0 14px", borderRadius: 9, border: `1px solid ${p.border}`, background: "transparent",
    color: p.text, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
  };

  const label = (t: string) => <div style={{ fontSize: 13, fontWeight: 600, color: p.text, marginBottom: 8 }}>{t}</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, color: p.text }}>
      <style>{`
        .tm-in::placeholder{color:${p.muted};opacity:.7}
        .tm-in:focus{border-color:${p.priB}!important;box-shadow:0 0 0 3px ${p.priSh}}
        .tm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px}
        .tm-form{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
        @media (max-width: 900px){.tm-form{grid-template-columns:1fr 1fr}}
        @media (max-width: 560px){.tm-form{grid-template-columns:1fr}.tm-grid{grid-template-columns:1fr}}
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
        <div>
          <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 12, fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: p.eyeb }}>
            <span style={{ width: 32, height: 3, borderRadius: 2, background: "#C75B41" }} />Team
          </p>
          <h1 style={{ margin: "12px 0 0", fontFamily: "Georgia, serif", fontSize: 38, fontWeight: 500, letterSpacing: "-.02em" }}>Your team</h1>
          <p style={{ margin: "8px 0 0", fontSize: 15, color: p.muted }}>
            {team.length === 0 ? "Add your employees and choose which clients each one handles."
              : `${team.length} member${team.length === 1 ? "" : "s"}. Each client has one responsible employee.`}
          </p>
        </div>
        <button type="button" onClick={() => { setShowForm((s) => !s); setError(""); }}
          style={{ height: 48, padding: "0 22px", borderRadius: 10, border: `1px solid ${p.priB}`, background: p.pri, color: "#fff", font: "600 14px Inter, system-ui", cursor: "pointer", display: "flex", alignItems: "center", gap: 9, boxShadow: `0 12px 26px ${p.priSh}` }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12h14M12 5v14" /></svg>
          {showForm ? "Close" : "Add employee"}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <section style={{ borderRadius: 16, border: `1px solid ${p.border}`, background: p.card, padding: 22 }}>
          <div className="tm-form">
            <div>{label("Full name")}<input className="tm-in" style={fieldStyle(p)} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Sara Ahmed" /></div>
            <div>{label("Email")}<input className="tm-in" type="email" style={fieldStyle(p)} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="sara@company.com" /></div>
            <div>{label("Phone (optional)")}<input className="tm-in" type="tel" style={fieldStyle(p)} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+966 5X XXX XXXX" /></div>
            <div>{label("Role")}
              <select className="tm-in" style={{ ...fieldStyle(p), cursor: "pointer" }} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                <option value="Employee">Employee</option>
                <option value="Manager">Manager</option>
              </select>
            </div>
          </div>
          {error && <p role="alert" style={{ margin: "12px 0 0", fontSize: 13, color: p.pri }}>{error}</p>}
          <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <button type="button" onClick={addEmployee}
              style={{ height: 44, padding: "0 22px", borderRadius: 10, border: `1px solid ${p.priB}`, background: p.pri, color: "#fff", font: "600 14px Inter, system-ui", cursor: "pointer" }}>Add to team</button>
            <span style={{ fontSize: 12, color: p.muted }}>An invitation email will be sent once the backend is connected.</span>
          </div>
        </section>
      )}

      {/* Search */}
      {team.length > 0 && (
        <input className="tm-in" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or email"
          style={{ ...fieldStyle(p), maxWidth: 380 }} />
      )}

      {/* Empty */}
      {team.length === 0 && !showForm && (
        <section style={{ borderRadius: 16, border: `1px dashed ${p.border}`, background: p.card, padding: "36px 24px", textAlign: "center" }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 22 }}>No team members yet</div>
          <p style={{ margin: "8px auto 0", maxWidth: 440, fontSize: 14, lineHeight: 1.6, color: p.muted }}>
            Add the people who work on your clients. Then choose which clients each one is responsible for.
          </p>
        </section>
      )}

      {/* Employees */}
      <div className="tm-grid">
        {shown.map((e, i) => {
          const mine = e.clients.map((id) => clients.find((c) => c.id === id)).filter((c): c is ClientLite => !!c);
          const open = picker === e.id;
          return (
            <section key={e.id} style={{ borderRadius: 16, border: `1px solid ${p.border}`, background: p.card, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: COLORS[i % COLORS.length], color: "#fff", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{initials(e.name)}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.name}</div>
                  <div style={{ marginTop: 2, fontSize: 12, color: p.muted }}>{e.role} · {e.status}</div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: p.muted }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}><Svg size={15}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></Svg><span style={{ color: p.text, wordBreak: "break-all" }}>{e.email}</span></div>
                {e.phone && <div style={{ display: "flex", alignItems: "center", gap: 9 }}><Svg size={15}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" /></Svg><span style={{ color: p.text }}>{e.phone}</span></div>}
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: p.eyeb }}>Handles {mine.length} client{mine.length === 1 ? "" : "s"}</div>
                <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {mine.length === 0 && <span style={{ fontSize: 13, color: p.muted }}>No clients assigned yet.</span>}
                  {mine.map((c) => (
                    <span key={c.id} style={{ padding: "6px 12px", borderRadius: 99, background: p.chipBg, color: p.chipFg, fontSize: 12, fontWeight: 600 }}>{c.name}</span>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button type="button" onClick={() => setPicker(open ? null : e.id)} style={ghostBtn}>{open ? "Done" : "Assign clients"}</button>
                {confirm === e.id ? (
                  <>
                    <button type="button" onClick={() => removeEmployee(e.id)} style={{ ...ghostBtn, background: p.pri, color: "#fff", border: `1px solid ${p.priB}` }}>Confirm remove</button>
                    <button type="button" onClick={() => setConfirm(null)} style={{ ...ghostBtn, color: p.muted }}>Cancel</button>
                  </>
                ) : (
                  <button type="button" onClick={() => setConfirm(e.id)} style={{ ...ghostBtn, color: p.muted }}>Remove</button>
                )}
              </div>

              {open && (
                <div style={{ borderTop: `1px solid ${p.border}`, paddingTop: 14 }}>
                  {clients.length === 0 ? (
                    <div style={{ fontSize: 13, color: p.muted }}>Add clients first, then you can assign them here.</div>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {clients.map((c) => {
                        const on = e.clients.includes(c.id);
                        const owner = ownerOf(c.id);
                        const takenBy = owner && owner.id !== e.id ? owner.name.split(" ")[0] : "";
                        return (
                          <button key={c.id} type="button" onClick={() => toggleClient(e.id, c.id)} aria-pressed={on}
                            style={{ padding: "8px 14px", borderRadius: 99, fontSize: 13, fontWeight: on ? 600 : 500, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${on ? p.priB : p.border}`, background: on ? p.pri : p.field, color: on ? "#fff" : p.text }}>
                            {c.name}{takenBy && <span style={{ opacity: 0.7, fontWeight: 500 }}> · {takenBy}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {clients.some((c) => ownerOf(c.id) && ownerOf(c.id)!.id !== e.id) && (
                    <div style={{ marginTop: 10, fontSize: 12, color: p.muted }}>A name next to a client means someone else handles it. Choosing it moves it to this employee.</div>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {team.length > 0 && shown.length === 0 && (
        <div style={{ fontSize: 14, color: p.muted }}>No one matches "{query}".</div>
      )}
    </div>
  );
}