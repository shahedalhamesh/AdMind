import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUser } from "../services/auth";

/* ---------- Palette (Light = gray-blue, Dark = navy) ---------- */
const LIGHT = {
  bg: "#A9B5CD", hdr: "rgba(201,209,224,0.55)", card: "#C9D1E0", field: "#B4BED3",
  border: "#8E9AB4", text: "#101B32", muted: "#25344F", pri: "#A64B35", priB: "#D9694C",
  priSh: "rgba(166,75,53,0.35)", eyeb: "#6E2A19", track: "#9CA9C4", iconBg: "#B4BED3",
  iconFg: "#101B32", glow: "rgba(199,91,65,0.28)",
};
const DARK = {
  bg: "#0B1426", hdr: "rgba(16,27,50,0.6)", card: "#101B32", field: "#16223F",
  border: "#2E3E63", text: "#FFFFFF", muted: "#AAB6CE", pri: "#BC553B", priB: "#E58A70",
  priSh: "rgba(188,85,59,0.4)", eyeb: "#E58A70", track: "#16223F", iconBg: "#16223F",
  iconFg: "#20D5DF", glow: "rgba(199,91,65,0.22)",
};
type Pal = typeof LIGHT;

/* ---------- Data ---------- */
const INDUSTRIES = ["Food and beverage", "Fashion and beauty", "Real estate", "Health and wellness", "Technology", "Education", "Travel and hospitality", "Retail and e-commerce", "Automotive", "Other"];
const SIZES = ["Just me", "2 to 10 people", "11 to 50 people", "51 to 200 people", "200+ people"];
const SERVICES = ["Social media management", "Reels and video production", "Photography", "Paid ads", "Influencer marketing", "Content writing", "Branding and design", "SEO", "Website design", "Event marketing"];
const TONES = ["Professional", "Friendly", "Luxury", "Playful", "Bold", "Minimal", "Warm", "Educational"];
const AGES = ["Under 18", "18 to 24", "25 to 34", "35 to 44", "45 to 54", "55+"];
const GENDERS = ["Everyone", "Mostly women", "Mostly men"];
const PRICE_TIERS = ["Budget", "Mid-range", "Premium"];
const DIALECTS = ["Gulf Arabic", "Levantine Arabic", "Egyptian Arabic", "Modern Standard Arabic", "English"];
const EMOJIS = ["Yes", "Sometimes", "No"];
const REEL_STYLES = ["Fast and punchy", "Cinematic", "Casual and real", "Calm and minimal"];

const STEPS = [
  { id: "company", label: "Company" },
  { id: "offer", label: "What you offer" },
  { id: "clients", label: "Your clients" },
  { id: "contact", label: "Logo and contact" },
];

type Company = {
  name: string; nameAr: string; founded: string; size: string; country: string; city: string; website: string;
  about: string; services: string[]; otherServices: string; differentiator: string;
  contactName: string; email: string; phone: string;
};
const EMPTY_COMPANY: Company = {
  name: "", nameAr: "", founded: "", size: "", country: "", city: "", website: "",
  about: "", services: [], otherServices: "", differentiator: "",
  contactName: "", email: "", phone: "",
};

type Client = {
  id: string;
  name: string; industry: string; city: string; instagram: string;
  sells: string; bestSellers: string; priceTier: string[];
  audience: string; ages: string[]; gender: string[];
  tones: string[]; dialect: string[]; emojis: string[];
  reelStyle: string[]; music: string;
  colors: string[]; slogan: string; hashtags: string;
  avoid: string; mustInclude: string;
  inspiration: string; competitors: string;
  approverName: string; approverPhone: string;
  notes: string;
};
const newClient = (): Client => ({
  id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now() + Math.random()),
  name: "", industry: "", city: "", instagram: "",
  sells: "", bestSellers: "", priceTier: [],
  audience: "", ages: [], gender: [],
  tones: [], dialect: [], emojis: [],
  reelStyle: [], music: "",
  colors: [], slogan: "", hashtags: "",
  avoid: "", mustInclude: "",
  inspiration: "", competitors: "",
  approverName: "", approverPhone: "",
  notes: "",
});

// Temporary storage until the backend endpoints exist.
const STORE_COMPANY = "admind_company_profile";
const STORE_CLIENTS = "admind_clients";

/* ---------- Theme ---------- */
function useIsDark() {
  const read = () =>
    document.documentElement.classList.contains("dark") ||
    document.documentElement.getAttribute("data-theme") === "dark" ||
    localStorage.getItem("theme") === "dark";
  const [dark, setDark] = useState(read);
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(read()));
    obs.observe(document.documentElement, { attributes: true });
    return () => obs.disconnect();
  }, []);
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch { /* ignore */ }
    setDark(next);
  };
  return { dark, toggle };
}

/* ---------- UI pieces ---------- */
const Check = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
);

const Label = ({ p, text, optional, hint }: { p: Pal; text: string; optional?: boolean; hint?: string }) => (
  <div>
    <div style={{ fontSize: 13, fontWeight: 600, color: p.text }}>
      {text} {optional && <span style={{ fontWeight: 500, color: p.muted }}>(optional)</span>}
    </div>
    {hint && <div style={{ marginTop: 3, fontSize: 12, color: p.muted }}>{hint}</div>}
  </div>
);

const fieldStyle = (p: Pal): React.CSSProperties => ({
  width: "100%", boxSizing: "border-box", borderRadius: 10, border: `1px solid ${p.border}`,
  background: p.field, color: p.text, fontSize: 14, fontFamily: "inherit", outline: "none",
});

function TextField({ p, label, value, onChange, placeholder, optional, hint, type = "text" }: {
  p: Pal; label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  optional?: boolean; hint?: string; type?: string;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <Label p={p} text={label} optional={optional} hint={hint} />
      <input className="ob-in" type={type} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...fieldStyle(p), height: 48, padding: "0 14px", marginTop: 8 }} />
    </div>
  );
}

function SelectField({ p, label, value, onChange, options, optional }: {
  p: Pal; label: string; value: string; onChange: (v: string) => void; options: string[]; optional?: boolean;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <Label p={p} text={label} optional={optional} />
      <select className="ob-in" value={value} onChange={(e) => onChange(e.target.value)}
        style={{ ...fieldStyle(p), height: 48, padding: "0 12px", marginTop: 8, cursor: "pointer" }}>
        <option value="">Choose…</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function AreaField({ p, label, value, onChange, placeholder, rows = 3, optional, hint }: {
  p: Pal; label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  rows?: number; optional?: boolean; hint?: string;
}) {
  return (
    <div>
      <Label p={p} text={label} optional={optional} hint={hint} />
      <textarea className="ob-in" rows={rows} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...fieldStyle(p), padding: "13px 14px", marginTop: 8, resize: "vertical", lineHeight: 1.5 }} />
    </div>
  );
}

function Chips({ p, label, items, value, onChange, single, optional, hint }: {
  p: Pal; label: string; items: string[]; value: string[]; onChange: (v: string[]) => void;
  single?: boolean; optional?: boolean; hint?: string;
}) {
  const toggle = (i: string) => {
    if (value.includes(i)) return onChange(value.filter((x) => x !== i));
    if (single) return onChange([i]);
    onChange([...value, i]);
  };
  return (
    <div>
      <Label p={p} text={label} optional={optional} hint={hint} />
      <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 9 }}>
        {items.map((i) => {
          const on = value.includes(i);
          return (
            <button key={i} type="button" onClick={() => toggle(i)} aria-pressed={on}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 99,
                fontSize: 13, fontWeight: on ? 600 : 500, cursor: "pointer", fontFamily: "inherit",
                border: `1px solid ${on ? p.priB : p.border}`, background: on ? p.pri : p.field,
                color: on ? "#fff" : p.text, transition: "all .15s",
              }}>
              {on && <Check size={13} />}
              {i}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DropZone({ p, title, sub, accept, multiple, files, onFiles, compact }: {
  p: Pal; title: string; sub: string; accept: string; multiple?: boolean;
  files: File[]; onFiles: (f: File[]) => void; compact?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <div role="button" tabIndex={0} onClick={() => ref.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && ref.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); onFiles(Array.from(e.dataTransfer.files)); }}
        style={{ borderRadius: 14, border: `2px dashed ${p.border}`, background: p.field, padding: compact ? 18 : 28, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", cursor: "pointer" }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: p.iconBg, color: p.iconFg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m17 8-5-5-5 5" /><path d="M12 3v12" /></svg>
        </div>
        <div style={{ marginTop: 10, fontSize: 14, fontWeight: 600, color: p.text }}>{title}</div>
        <div style={{ marginTop: 4, fontSize: 12, color: p.muted }}>{sub}</div>
        <input ref={ref} type="file" hidden accept={accept} multiple={multiple}
          onChange={(e) => onFiles(Array.from(e.target.files ?? []))} />
      </div>
      {files.length > 0 && (
        <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: 8 }}>
          {files.map((f) => (
            <li key={f.name} style={{ padding: "6px 12px", borderRadius: 8, background: p.field, border: `1px solid ${p.border}`, fontSize: 12, color: p.text }}>{f.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ColorsField({ p, colors, onChange }: { p: Pal; colors: string[]; onChange: (c: string[]) => void }) {
  const [c, setC] = useState("#A64B35");
  return (
    <div>
      <Label p={p} text="Brand colors" optional hint="Add up to five. Click a color to remove it." />
      <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {colors.map((x) => (
          <button key={x} type="button" onClick={() => onChange(colors.filter((y) => y !== x))} title="Remove"
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px 8px 8px", borderRadius: 10, border: `1px solid ${p.border}`, background: p.field, color: p.text, cursor: "pointer", fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
            <span style={{ width: 28, height: 28, borderRadius: 7, background: x, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.15)" }} />{x}
          </button>
        ))}
        {colors.length < 5 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 10, border: `1px dashed ${p.border}` }}>
            <input type="color" value={c} onChange={(e) => setC(e.target.value)} aria-label="Pick a color"
              style={{ width: 30, height: 30, border: 0, padding: 0, background: "none", cursor: "pointer" }} />
            <button type="button" onClick={() => !colors.includes(c.toUpperCase()) && onChange([...colors, c.toUpperCase()])}
              style={{ border: 0, background: "none", color: p.text, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>+ Add color</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ p, id, n, icon, title, sub, children }: {
  p: Pal; id: string; n: number; icon: React.ReactNode; title: string; sub: string; children: React.ReactNode;
}) {
  return (
    <section id={id} data-step style={{ scrollMarginTop: 90, borderRadius: 18, border: `1px solid ${p.border}`, background: p.card, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "22px 28px", borderBottom: `1px solid ${p.border}`, flexWrap: "wrap" }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: p.iconBg, color: p.iconFg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
        </div>
        <div>
          <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: ".2em", color: p.eyeb }}>STEP {n} OF {STEPS.length}</div>
          <h2 style={{ margin: "3px 0 0", fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 500, color: p.text }}>{title}</h2>
        </div>
        <div style={{ marginLeft: "auto", fontSize: 13, color: p.muted, maxWidth: 300 }}>{sub}</div>
      </div>
      <div style={{ padding: "26px 28px", display: "flex", flexDirection: "column", gap: 22 }}>{children}</div>
    </section>
  );
}

const Row = ({ children }: { children: React.ReactNode }) => (
  <div className="ob-row" style={{ display: "flex", gap: 18 }}>{children}</div>
);

const SubTitle = ({ p, text }: { p: Pal; text: string }) => (
  <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: p.eyeb, paddingTop: 6, borderTop: `1px solid ${p.border}` }}>{text}</div>
);

/* ---------- One client (existing client of the company) ---------- */
function ClientCard({ p, c, index, files, onChange, onFiles, onRemove, defaultOpen }: {
  p: Pal; c: Client; index: number; files: File[];
  onChange: (patch: Partial<Client>) => void; onFiles: (f: File[]) => void; onRemove: () => void; defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderRadius: 14, border: `1px solid ${p.border}`, background: p.field, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px" }}>
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
          style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, border: 0, background: "none", cursor: "pointer", textAlign: "left", color: p.text, fontFamily: "inherit" }}>
          <span style={{ width: 34, height: 34, borderRadius: 9, background: p.pri, color: "#fff", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{index + 1}</span>
          <span>
            <span style={{ display: "block", fontSize: 15, fontWeight: 600 }}>{c.name || "New client"}</span>
            <span style={{ display: "block", fontSize: 12, color: p.muted }}>{[c.industry, c.city].filter(Boolean).join(" · ") || "Click to fill in this client's details"}</span>
          </span>
          <svg style={{ marginLeft: "auto", transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg>
        </button>
        <button type="button" onClick={onRemove}
          style={{ height: 34, padding: "0 12px", borderRadius: 8, border: `1px solid ${p.border}`, background: "transparent", color: p.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Remove</button>
      </div>

      {open && (
        <div style={{ padding: "6px 18px 22px", display: "flex", flexDirection: "column", gap: 20 }}>
          <SubTitle p={p} text="Basics" />
          <Row>
            <TextField p={p} label="Client name" value={c.name} onChange={(v) => onChange({ name: v })} placeholder="Brand or business name" />
            <SelectField p={p} label="Industry" value={c.industry} onChange={(v) => onChange({ industry: v })} options={INDUSTRIES} />
          </Row>
          <Row>
            <TextField p={p} label="City" optional value={c.city} onChange={(v) => onChange({ city: v })} placeholder="Riyadh" />
            <TextField p={p} label="Instagram account" optional value={c.instagram} onChange={(v) => onChange({ instagram: v })} placeholder="@clientbrand" />
          </Row>

          <SubTitle p={p} text="What they sell" />
          <AreaField p={p} label="Main products or services" rows={3} value={c.sells} onChange={(v) => onChange({ sells: v })} placeholder="What do they offer?" />
          <Row>
            <TextField p={p} label="Best sellers" optional value={c.bestSellers} onChange={(v) => onChange({ bestSellers: v })} placeholder="The products that sell most" />
          </Row>
          <Chips p={p} label="Price level" single optional items={PRICE_TIERS} value={c.priceTier} onChange={(v) => onChange({ priceTier: v })} />

          <SubTitle p={p} text="Their customers" />
          <AreaField p={p} label="Who buys from them?" rows={2} value={c.audience} onChange={(v) => onChange({ audience: v })} placeholder="Who they are and what they care about." />
          <Chips p={p} label="Age range" optional items={AGES} value={c.ages} onChange={(v) => onChange({ ages: v })} />
          <Chips p={p} label="Mostly" single optional items={GENDERS} value={c.gender} onChange={(v) => onChange({ gender: v })} />

          <SubTitle p={p} text="How they talk" />
          <Chips p={p} label="Tone of voice" items={TONES} value={c.tones} onChange={(v) => onChange({ tones: v })} />
          <Chips p={p} label="Language or dialect" single items={DIALECTS} value={c.dialect} onChange={(v) => onChange({ dialect: v })} />
          <Chips p={p} label="Do they like emojis?" single optional items={EMOJIS} value={c.emojis} onChange={(v) => onChange({ emojis: v })} />

          <SubTitle p={p} text="Style of reels and content" />
          <Chips p={p} label="Preferred style" optional items={REEL_STYLES} value={c.reelStyle} onChange={(v) => onChange({ reelStyle: v })} />
          <TextField p={p} label="Music mood" optional value={c.music} onChange={(v) => onChange({ music: v })} placeholder="Upbeat, calm, traditional..." />

          <SubTitle p={p} text="Brand" />
          <ColorsField p={p} colors={c.colors} onChange={(v) => onChange({ colors: v })} />
          <Row>
            <TextField p={p} label="Slogan" optional value={c.slogan} onChange={(v) => onChange({ slogan: v })} placeholder="Their tagline" />
            <TextField p={p} label="Fixed hashtags" optional value={c.hashtags} onChange={(v) => onChange({ hashtags: v })} placeholder="#brand #campaign" />
          </Row>

          <SubTitle p={p} text="Rules" />
          <AreaField p={p} label="Words or topics to avoid" optional rows={2} hint="For example, a luxury brand may never say 'cheap'." value={c.avoid} onChange={(v) => onChange({ avoid: v })} placeholder="cheap, discount, politics" />
          <AreaField p={p} label="Must appear in every ad" optional rows={2} value={c.mustInclude} onChange={(v) => onChange({ mustInclude: v })} placeholder="Logo at the end, delivery info, phone number..." />

          <SubTitle p={p} text="Inspiration" />
          <AreaField p={p} label="Accounts or ads they love" optional rows={2} value={c.inspiration} onChange={(v) => onChange({ inspiration: v })} placeholder="Links or names" />
          <TextField p={p} label="Main competitors" optional value={c.competitors} onChange={(v) => onChange({ competitors: v })} placeholder="@competitor1, @competitor2" />

          <SubTitle p={p} text="Approval and files" />
          <Row>
            <TextField p={p} label="Who approves content?" optional value={c.approverName} onChange={(v) => onChange({ approverName: v })} placeholder="Name at the client" />
            <TextField p={p} label="Their phone" optional type="tel" value={c.approverPhone} onChange={(v) => onChange({ approverPhone: v })} placeholder="+966 5X XXX XXXX" />
          </Row>
          <DropZone compact p={p} title="Upload files for this client" sub="Price list, catalog, brand guide, photos. The AI reads them." accept=".pdf,.doc,.docx,.txt,image/*" multiple files={files} onFiles={onFiles} />
          <AreaField p={p} label="Anything else the AI should know?" optional rows={3} value={c.notes} onChange={(v) => onChange({ notes: v })} placeholder="Anything that helps us write and make content that feels like this client." />
        </div>
      )}
    </div>
  );
}

/* ---------- Page ---------- */
export default function Onboarding() {
  const navigate = useNavigate();
  const { dark, toggle } = useIsDark();
  const p = dark ? DARK : LIGHT;
  const user = getUser();

  // Shown to the advertising company right after verification
  // (not to platform admins, and not to the company's own clients).
  const isCompanyUser = !user?.is_platform_admin && !(user?.role && /client/i.test(user.role));
  useEffect(() => {
    if (!isCompanyUser) navigate("/dashboard", { replace: true });
  }, [isCompanyUser, navigate]);

  const [co, setCo] = useState<Company>(() => {
    try {
      const s = localStorage.getItem(STORE_COMPANY);
      if (s) return { ...EMPTY_COMPANY, ...JSON.parse(s) };
    } catch { /* ignore */ }
    return { ...EMPTY_COMPANY, contactName: user?.name ?? "", email: user?.email ?? "" };
  });
  const [clients, setClients] = useState<Client[]>(() => {
    try {
      const s = localStorage.getItem(STORE_CLIENTS);
      if (s) return JSON.parse(s);
    } catch { /* ignore */ }
    return [];
  });
  const [clientFiles, setClientFiles] = useState<Record<string, File[]>>({});
  const [logo, setLogo] = useState<File[]>([]);
  const [active, setActive] = useState("company");
  const [saved, setSaved] = useState(false);
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const setC = <K extends keyof Company>(k: K, v: Company[K]) => setCo((s) => ({ ...s, [k]: v }));
  const updClient = (id: string, patch: Partial<Client>) =>
    setClients((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const addClient = () => {
    const c = newClient();
    setClients((l) => [...l, c]);
    setJustAdded(c.id);
  };
  const removeClient = (id: string) => setClients((l) => l.filter((c) => c.id !== id));

  // autosave draft
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORE_COMPANY, JSON.stringify(co));
        localStorage.setItem(STORE_CLIENTS, JSON.stringify(clients));
        setSaved(true);
      } catch { /* ignore */ }
    }, 600);
    return () => clearTimeout(t);
  }, [co, clients]);

  // highlight the step in view
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-step]"));
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-30% 0px -60% 0px" }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const done = useMemo(() => ({
    company: !!(co.name && co.country && co.city && co.size),
    offer: !!(co.about && (co.services.length > 0 || co.otherServices.trim())),
    clients: clients.some((c) => c.name.trim()),
    contact: !!(co.contactName && co.email),
  } as Record<string, boolean>), [co, clients]);
  const doneCount = Object.values(done).filter(Boolean).length;

  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  // Nothing is required: the company can continue with everything empty.
  const finish = () => {
    // TODO (backend): save the company profile, then for each client:
    // POST /api/clients (client + profile) and POST /api/clients/{id}/documents for its files.
    try {
      localStorage.setItem(STORE_COMPANY, JSON.stringify(co));
      localStorage.setItem(STORE_CLIENTS, JSON.stringify(clients.filter((c) => c.name.trim())));
    } catch { /* ignore */ }
    navigate("/dashboard", { replace: true });
  };

  const ICONS = {
    company: <><path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" /></>,
    offer: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9Z" />,
    clients: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9" /><path d="M16 3.1a4 4 0 0 1 0 7.8" /></>,
    contact: <><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" /></>,
  };

  return (
    <div style={{ minHeight: "100vh", background: p.bg, color: p.text, position: "relative", fontFamily: "Inter, system-ui, sans-serif", transition: "background .3s" }}>
      <style>{`
        .ob-in::placeholder{color:${p.muted};opacity:.7}
        .ob-in:focus{border-color:${p.priB}!important;box-shadow:0 0 0 3px ${p.priSh}}
        @keyframes ob-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        .ob-rise{animation:ob-rise .7s cubic-bezier(.2,.7,.2,1) backwards}
        @media (max-width: 980px){
          .ob-grid{grid-template-columns:1fr!important}
          .ob-side{display:none!important}
          .ob-row{flex-direction:column!important}
        }
        @media (prefers-reduced-motion: reduce){*{animation:none!important;scroll-behavior:auto!important}}
      `}</style>
      <div aria-hidden style={{ position: "absolute", inset: "0 0 auto 0", height: 460, background: `radial-gradient(ellipse at 85% -20%, ${p.glow} 0%, transparent 60%)`, pointerEvents: "none" }} />

      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 20, height: 72, boxSizing: "border-box", padding: "0 40px", display: "flex", alignItems: "center", gap: 14, borderBottom: `1px solid ${p.border}`, background: p.hdr, backdropFilter: "blur(10px)" }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: dark ? "#fff" : "#101B32", boxShadow: "0 0 0 3px #A64B35", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={dark ? "#101B32" : "#fff"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" /><path d="M9 13a4.5 4.5 0 0 0 3-4" /><path d="M12 13h4" /><path d="M12 8h8" /></svg>
        </div>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 600, letterSpacing: ".14em" }}>ADMIND</div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: p.muted }}>{saved ? "Draft saved" : "Saving…"}</span>
          <button type="button" onClick={toggle} aria-label="Toggle theme"
            style={{ width: 42, height: 42, borderRadius: 10, border: `1px solid ${p.border}`, background: p.card, color: p.text, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {dark
              ? <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2" /></svg>
              : <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>}
          </button>
          <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg,#C75B41,#A64B35)", color: "#fff", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {(user?.name ?? "U").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase()}
          </div>
        </div>
      </header>

      <div className="ob-grid" style={{ position: "relative", display: "grid", gridTemplateColumns: "300px minmax(0, 900px)", gap: 56, padding: "44px 40px 80px", maxWidth: 1360, margin: "0 auto" }}>
        {/* Side steps */}
        <aside className="ob-side">
          <div style={{ position: "sticky", top: 96 }}>
            <p style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: p.eyeb }}>Company profile</p>
            <nav style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 2 }}>
              {STEPS.map((s, i) => {
                const on = active === s.id;
                return (
                  <button key={s.id} type="button" onClick={() => go(s.id)}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, border: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: on ? 600 : 500, background: on ? p.card : "transparent", color: on || done[s.id] ? p.text : p.muted }}>
                    {done[s.id]
                      ? <span style={{ width: 24, height: 24, borderRadius: "50%", background: p.pri, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={13} /></span>
                      : <span style={{ width: 24, height: 24, borderRadius: "50%", border: `1.5px solid ${p.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600 }}>{i + 1}</span>}
                    {s.label}
                  </button>
                );
              })}
            </nav>
            <div style={{ marginTop: 26, padding: 16, borderRadius: 14, border: `1px solid ${p.border}`, background: p.card }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: p.muted }}>
                <span>Completed</span><b style={{ color: p.text }}>{doneCount} of {STEPS.length}</b>
              </div>
              <div style={{ marginTop: 8, height: 8, borderRadius: 99, background: p.track, overflow: "hidden" }}>
                <div style={{ width: `${(doneCount / STEPS.length) * 100}%`, height: "100%", borderRadius: 99, background: "linear-gradient(90deg,#A64B35,#E0775A)", transition: "width .4s" }} />
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: p.muted, lineHeight: 1.5 }}>Your draft is saved as you type.</div>
            </div>
          </div>
        </aside>

        {/* Form */}
        <main style={{ display: "flex", flexDirection: "column", gap: 26, minWidth: 0 }}>
          <div className="ob-rise">
            <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 12, fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: p.eyeb }}>
              <span style={{ width: 32, height: 3, borderRadius: 2, background: "#C75B41" }} />Welcome{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
            </p>
            <h1 style={{ margin: "12px 0 0", fontFamily: "Georgia, serif", fontSize: 42, fontWeight: 500, letterSpacing: "-.02em", lineHeight: 1.1 }}>Tell us about your company.</h1>
            <p style={{ margin: "12px 0 0", fontSize: 16, lineHeight: 1.6, color: p.muted, maxWidth: 660 }}>
              Introduce your company, then add the clients you already work with. Our AI learns how each client likes to be presented, so every reel and post fits them. Nothing here is required, and you can skip it and come back later.
            </p>
          </div>

          <Section p={p} id="company" n={1} icon={ICONS.company} title="About your company" sub="The basics.">
            <Row>
              <TextField p={p} label="Company name" optional value={co.name} onChange={(v) => setC("name", v)} placeholder="Your company name" />
              <TextField p={p} label="Company name in Arabic" optional value={co.nameAr} onChange={(v) => setC("nameAr", v)} placeholder="اسم الشركة" />
            </Row>
            <Row>
              <TextField p={p} label="Year founded" optional value={co.founded} onChange={(v) => setC("founded", v.replace(/\D/g, "").slice(0, 4))} placeholder="2018" />
              <SelectField p={p} label="Company size" optional value={co.size} onChange={(v) => setC("size", v)} options={SIZES} />
            </Row>
            <Row>
              <TextField p={p} label="Country" optional value={co.country} onChange={(v) => setC("country", v)} placeholder="Saudi Arabia" />
              <TextField p={p} label="City" optional value={co.city} onChange={(v) => setC("city", v)} placeholder="Riyadh" />
            </Row>
            <TextField p={p} label="Website" optional value={co.website} onChange={(v) => setC("website", v)} placeholder="https://yourcompany.com" />
          </Section>

          <Section p={p} id="offer" n={2} icon={ICONS.offer} title="What you offer" sub="Your departments and what sets you apart.">
            <AreaField p={p} label="Describe your company" optional hint="Two or three sentences is perfect." rows={3} value={co.about} onChange={(v) => setC("about", v)} placeholder="What your company does and who you work with." />
            <Chips p={p} label="Your services and departments" optional items={SERVICES} value={co.services} onChange={(v) => setC("services", v)} />
            <TextField p={p} label="Other services" optional value={co.otherServices} onChange={(v) => setC("otherServices", v)} placeholder="Anything not in the list, separated by commas" />
            <AreaField p={p} label="What makes you different?" optional rows={3} value={co.differentiator} onChange={(v) => setC("differentiator", v)} placeholder="Why do clients choose you?" />
          </Section>

          <Section p={p} id="clients" n={3} icon={ICONS.clients} title="Your clients" sub="The clients you already work with. Add as many as you like.">
            <div style={{ fontSize: 14, color: p.muted, lineHeight: 1.6 }}>
              Each client gets its own profile. Our AI uses it to write and plan in that client's voice. You can add more clients later from the Clients page.
            </div>
            {clients.map((c, i) => (
              <ClientCard key={c.id} p={p} c={c} index={i} defaultOpen={c.id === justAdded}
                files={clientFiles[c.id] ?? []}
                onChange={(patch) => updClient(c.id, patch)}
                onFiles={(f) => setClientFiles((m) => ({ ...m, [c.id]: f }))}
                onRemove={() => removeClient(c.id)} />
            ))}
            <button type="button" onClick={addClient}
              style={{ height: 52, borderRadius: 12, border: `2px dashed ${p.border}`, background: "transparent", color: p.text, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12h14M12 5v14" /></svg>
              {clients.length === 0 ? "Add your first client" : "Add another client"}
            </button>
          </Section>

          <Section p={p} id="contact" n={4} icon={ICONS.contact} title="Logo and contact" sub="Your logo, and who we should talk to.">
            <DropZone p={p} title="Upload your company logo" sub="PNG, SVG or JPG, up to 5 MB" accept="image/png,image/svg+xml,image/jpeg" files={logo} onFiles={setLogo} />
            <Row>
              <TextField p={p} label="Contact person" optional value={co.contactName} onChange={(v) => setC("contactName", v)} placeholder="Full name" />
              <TextField p={p} label="Phone" optional type="tel" value={co.phone} onChange={(v) => setC("phone", v)} placeholder="+966 5X XXX XXXX" />
            </Row>
            <TextField p={p} label="Email" optional type="email" value={co.email} onChange={(v) => setC("email", v)} placeholder="you@company.com" />
          </Section>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14, padding: "22px 26px", borderRadius: 16, border: `1px solid ${p.border}`, background: p.card }}>
            <span style={{ fontSize: 14, color: p.muted }}>
              Nothing here is required. You can fill it in later from your company profile.
            </span>
            <button type="button" onClick={finish}
              style={{ height: 50, padding: "0 28px", borderRadius: 10, border: `1px solid ${p.priB}`, background: p.pri, color: "#fff", font: "600 15px Inter, system-ui", cursor: "pointer", boxShadow: `0 12px 26px ${p.priSh}` }}>
              {doneCount === 0 ? "Skip for now" : "Save and continue"}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}