import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { usePortalTheme } from "../services/portalTheme";
import { clientsApi } from "../services/clients";
import { fmtDateTime } from "../services/content";
import { AGENT_LABEL, MODE_LABEL, agentPerformanceApi, fmtSeconds } from "../services/agentPerformance";
import type { PerfNumbers } from "../services/agentPerformance";
import { Btn, Loading, Notice, Select, TextInput, errorText } from "../components/Ui";

// Neon colors, one per state. Change them here and the whole page follows.
const C = {
  ok: "#2CF2A0",        // succeeded
  bad: "#FF4D6D",       // failed
  run: "#FFC53D",       // still running
  fixed: "#B26BFF",     // the fact check corrected the text
  checkFail: "#FF8A3D", // the fact check itself failed
  blue: "#3DA5FF",      // neutral numbers
};

const EMPTY = { from: "", to: "", client_id: "" };

type Pt = [number, number];

// a smooth line through the points
function smooth(pts: Pt[]): string {
  if (pts.length === 0) return "";
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const cx = (x0 + x1) / 2;
    d += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
  }
  return d;
}

const glowShadow = (c: string, dark: boolean, r = 8) => (dark ? `0 0 ${r}px ${c}` : "none");
const glowFilter = (c: string, dark: boolean, r = 5) => (dark ? `drop-shadow(0 0 ${r}px ${c})` : undefined);

function Dot({ color, dark }: { color: string; dark: boolean }) {
  return <span aria-hidden style={{ width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: glowShadow(color, dark, 8), flexShrink: 0 }} />;
}

function Legend({ items, dark }: { items: { color: string; label: string }[]; dark: boolean }) {
  const { p } = usePortalTheme();
  return (
    <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 13, color: p.muted }}>
      {items.map((i) => (
        <span key={i.label} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          <Dot color={i.color} dark={dark} />{i.label}
        </span>
      ))}
    </div>
  );
}

function Chip({ color, children, dark }: { color: string; children: React.ReactNode; dark: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600, color, border: `1px solid ${color}`, background: `${color}1A`, boxShadow: dark ? `0 0 8px ${color}40` : "none", whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

// a thin bar split in colors: succeeded, failed, still running
function StateBar({ n, dark }: { n: PerfNumbers; dark: boolean }) {
  const { p } = usePortalTheme();
  const total = Math.max(1, n.succeeded + n.failed + n.running);
  const seg = (v: number, color: string, label: string) =>
    v > 0 ? <div title={`${label}: ${v}`} style={{ width: `${(v / total) * 100}%`, background: color, boxShadow: glowShadow(color, dark, 6) }} /> : null;
  return (
    <div style={{ display: "flex", gap: 2, height: 8, borderRadius: 4, overflow: "hidden", background: p.border, minWidth: 120 }}>
      {seg(n.succeeded, C.ok, "Succeeded")}
      {seg(n.failed, C.bad, "Failed")}
      {seg(n.running, C.run, "Running")}
    </div>
  );
}

// the ring: succeeded / failed / running, with the success rate in the middle
function Donut({ n, dark, rate }: { n: PerfNumbers; dark: boolean; rate: string }) {
  const { p } = usePortalTheme();
  const R = 56;
  const CIRC = 2 * Math.PI * R;
  const total = n.succeeded + n.failed + n.running;
  const parts = [
    { v: n.succeeded, c: C.ok },
    { v: n.failed, c: C.bad },
    { v: n.running, c: C.run },
  ].filter((x) => x.v > 0);
  const gap = parts.length > 1 ? 6 : 0;
  let offset = 0;

  return (
    <div style={{ position: "relative", width: 160, height: 160, flexShrink: 0 }}>
      <svg width="160" height="160" viewBox="0 0 160 160" aria-hidden>
        <circle cx="80" cy="80" r={R} fill="none" stroke={p.border} strokeWidth="14" />
        {total > 0 && parts.map((x, i) => {
          const len = Math.max(0.5, (x.v / total) * CIRC - gap);
          const el = (
            <circle key={i} cx="80" cy="80" r={R} fill="none" stroke={x.c} strokeWidth="14"
              strokeDasharray={`${len} ${CIRC - len}`} strokeDashoffset={-offset}
              transform="rotate(-90 80 80)" style={{ filter: glowFilter(x.c, dark, 5) }} />
          );
          offset += len + gap;
          return el;
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
        <div>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 30, lineHeight: 1 }}>{rate}</div>
          <div style={{ marginTop: 4, fontSize: 11, color: p.muted }}>success</div>
        </div>
      </div>
    </div>
  );
}

// the small line inside a card
function Spark({ values, color, dark }: { values: number[]; color: string; dark: boolean }) {
  if (values.length < 2) return null;
  const w = 100, h = 30;
  const max = Math.max(1, ...values);
  const pts: Pt[] = values.map((v, i) => [(i / (values.length - 1)) * w, h - 3 - (v / max) * (h - 8)]);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <path d={smooth(pts)} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" style={{ filter: glowFilter(color, dark, 4) }} />
    </svg>
  );
}

// jobs per day: a green line (ok or still running) and a red line (failed)
function DayChart({ days, dark }: { days: { date: string; runs: number; failed: number }[]; dark: boolean }) {
  const { p } = usePortalTheme();
  const n = days.length;

  // fill the width of the box, and scroll only when there are too many days
  const box = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBoxW(el.clientWidth));
    ro.observe(el);
    setBoxW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const w = Math.max(560, n * 34, boxW - 12), h = 190;
  const L = 36, R = 16, T = 14, B = 26;
  const max = Math.max(1, ...days.map((x) => x.runs));
  const x = (i: number) => (n === 1 ? w / 2 : L + (i * (w - L - R)) / (n - 1));
  const y = (v: number) => T + (1 - v / max) * (h - T - B);
  const okPts: Pt[] = days.map((d, i) => [x(i), y(d.runs - d.failed)]);
  const badPts: Pt[] = days.map((d, i) => [x(i), y(d.failed)]);
  const ticks = Array.from(new Set([0, Math.round(max / 2), max]));
  const labelEvery = Math.max(1, Math.ceil(n / 8));

  return (
    <div ref={box} style={{ overflowX: "auto", borderRadius: 14, border: `1px solid ${p.border}`, background: p.card, padding: "10px 6px 0" }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Jobs per day">
        <defs>
          <linearGradient id="okFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.ok} stopOpacity={dark ? 0.28 : 0.18} />
            <stop offset="100%" stopColor={C.ok} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={w - R} y1={y(t)} y2={y(t)} stroke={p.border} strokeDasharray="3 5" />
            <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill={p.muted}>{t}</text>
          </g>
        ))}
        {n > 1 && <path d={`${smooth(okPts)} L ${x(n - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`} fill="url(#okFill)" />}
        {n > 1 && <path d={smooth(okPts)} fill="none" stroke={C.ok} strokeWidth="2.5" strokeLinecap="round" style={{ filter: glowFilter(C.ok, dark, 5) }} />}
        {n > 1 && <path d={smooth(badPts)} fill="none" stroke={C.bad} strokeWidth="2.5" strokeLinecap="round" style={{ filter: glowFilter(C.bad, dark, 5) }} />}
        {days.map((d, i) => (
          <g key={d.date}>
            <circle cx={x(i)} cy={y(d.runs - d.failed)} r="4" fill={p.card} stroke={C.ok} strokeWidth="2"><title>{`${d.date}: ${d.runs} jobs, ${d.failed} failed`}</title></circle>
            {d.failed > 0 && <circle cx={x(i)} cy={y(d.failed)} r="4" fill={p.card} stroke={C.bad} strokeWidth="2"><title>{`${d.date}: ${d.failed} failed`}</title></circle>}
            {i % labelEvery === 0 && <text x={x(i)} y={h - 8} textAnchor="middle" fontSize="11" fill={p.muted}>{d.date.slice(5)}</text>}
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function AgentPerformance() {
  const { p, dark } = usePortalTheme();
  const [f, setF] = useState(EMPTY);

  const clients = useQuery({ queryKey: ["clients", { q: "", status: "" }], queryFn: () => clientsApi.list({}) });
  const q = useQuery({ queryKey: ["agent-performance", f], queryFn: () => agentPerformanceApi.get(f) });
  const d = q.data;

  const rate = (n: PerfNumbers) => (n.success_rate === null ? "—" : `${Math.round(n.success_rate)}%`);
  const runsByDay = (d?.by_day ?? []).map((x) => x.runs);
  const failedByDay = (d?.by_day ?? []).map((x) => x.failed);

  const tile = (label: string, value: string | number, color: string, spark?: number[]) => (
    <div style={{ padding: 16, borderRadius: 14, border: `1px solid ${p.border}`, background: p.card, minWidth: 150, flex: "1 1 150px", display: "grid", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: p.muted }}>
        <Dot color={color} dark={dark} />{label}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 30, color, textShadow: dark ? `0 0 14px ${color}55` : "none" }}>{value}</div>
        {spark && <Spark values={spark} color={color} dark={dark} />}
      </div>
    </div>
  );

  const th: React.CSSProperties = { textAlign: "start", padding: "10px 12px", fontSize: 12, color: p.muted, fontWeight: 600, whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "12px", fontSize: 14, verticalAlign: "middle" };

  const table = (title: string, rows: { key: string; label: string; n: PerfNumbers }[]) => (
    <div>
      <h2 style={{ margin: "0 0 10px", fontSize: 18 }}>{title}</h2>
      <div style={{ overflowX: "auto", borderRadius: 14, border: `1px solid ${p.border}`, background: p.card }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${p.border}` }}>
              <th style={th}>Name</th>
              <th style={th}>Jobs</th>
              <th style={{ ...th, width: "32%" }}>Result</th>
              <th style={th}>Success</th>
              <th style={th}>Avg time</th>
              <th style={th}>Fact check</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} style={{ borderBottom: `1px solid ${p.border}` }}>
                <td style={{ ...td, fontWeight: 600 }}>{r.label}</td>
                <td style={td}>{r.n.runs}</td>
                <td style={td}>
                  <StateBar n={r.n} dark={dark} />
                  <div style={{ marginTop: 6, fontSize: 12, color: p.muted }}>
                    <span style={{ color: C.ok }}>{r.n.succeeded} ok</span>
                    {" · "}<span style={{ color: r.n.failed ? C.bad : p.muted }}>{r.n.failed} failed</span>
                    {r.n.running > 0 && <>{" · "}<span style={{ color: C.run }}>{r.n.running} running</span></>}
                  </div>
                </td>
                <td style={{ ...td, fontWeight: 700, color: r.n.success_rate === null ? p.muted : r.n.success_rate >= 80 ? C.ok : r.n.success_rate >= 50 ? C.run : C.bad }}>{rate(r.n)}</td>
                <td style={td}>{fmtSeconds(r.n.avg_duration_seconds)}</td>
                <td style={td}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {r.n.corrected_by_fact_check > 0 && <Chip color={C.fixed} dark={dark}>{r.n.corrected_by_fact_check} fixed</Chip>}
                    {r.n.fact_check_failed > 0 && <Chip color={C.checkFail} dark={dark}>{r.n.fact_check_failed} check failed</Chip>}
                    {r.n.corrected_by_fact_check === 0 && r.n.fact_check_failed === 0 && <span style={{ color: p.muted }}>—</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div>
      <p style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: p.eyeb }}>Insights</p>
      <h1 style={{ margin: "10px 0 6px", fontFamily: "Georgia, serif", fontSize: 38, fontWeight: 500 }}>AI performance</h1>
      <p style={{ margin: "0 0 22px", color: p.muted, fontSize: 15, maxWidth: 640, lineHeight: 1.6 }}>
        How well the AI agents work: how many jobs they did, how many failed, and how long they took.
        {d ? ` Showing ${d.period.from} to ${d.period.to}.` : ""}
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20, alignItems: "flex-end" }}>
        <div style={{ width: 170 }}>
          <TextInput aria-label="From" type="date" lang="en-US" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
        </div>
        <div style={{ width: 170 }}>
          <TextInput aria-label="To" type="date" lang="en-US" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
        </div>
        <div style={{ width: 220 }}>
          <Select aria-label="Client" value={f.client_id} onChange={(e) => setF({ ...f, client_id: e.target.value })}>
            <option value="">All clients</option>
            {(clients.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <Btn onClick={() => setF(EMPTY)}>Last 30 days</Btn>
      </div>

      {q.isLoading && <Loading />}
      {q.isError && <Notice kind="error">{errorText(q.error)}</Notice>}

      {d && (
        <div style={{ display: "grid", gap: 28 }}>
          {/* the big picture: a ring and the main numbers */}
          <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "center", padding: 22, borderRadius: 16, border: `1px solid ${p.border}`, background: p.card }}>
            <Donut n={d.totals} dark={dark} rate={rate(d.totals)} />
            <div style={{ flex: 1, minWidth: 240, display: "grid", gap: 14 }}>
              <Legend dark={dark} items={[
                { color: C.ok, label: `Succeeded (${d.totals.succeeded})` },
                { color: C.bad, label: `Failed (${d.totals.failed})` },
                { color: C.run, label: `Running (${d.totals.running})` },
              ]} />
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Chip color={C.fixed} dark={dark}>{d.totals.corrected_by_fact_check} fixed by fact check</Chip>
                <Chip color={C.checkFail} dark={dark}>{d.totals.fact_check_failed} fact check failed</Chip>
              </div>
              <div style={{ fontSize: 13, color: p.muted }}>Average time per job: <strong style={{ color: p.text }}>{fmtSeconds(d.totals.avg_duration_seconds)}</strong></div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {tile("Jobs", d.totals.runs, C.blue, runsByDay)}
            {tile("Success rate", rate(d.totals), C.ok)}
            {tile("Failed", d.totals.failed, C.bad, failedByDay)}
            {tile("Average time", fmtSeconds(d.totals.avg_duration_seconds), C.run)}
            {tile("Fixed by fact check", d.totals.corrected_by_fact_check, C.fixed)}
          </div>

          {d.totals.runs === 0 && (
            <div style={{ padding: 24, borderRadius: 14, border: `1px dashed ${p.border}`, color: p.muted }}>No AI jobs in this period.</div>
          )}

          {d.by_day.length > 0 && (
            <div>
              <h2 style={{ margin: "0 0 10px", fontSize: 18 }}>Jobs per day</h2>
              <DayChart days={d.by_day} dark={dark} />
              <div style={{ marginTop: 10 }}>
                <Legend dark={dark} items={[{ color: C.ok, label: "OK or still running" }, { color: C.bad, label: "Failed" }]} />
              </div>
            </div>
          )}

          {d.by_agent.length > 0 && table("By agent", d.by_agent.map((a) => ({ key: a.agent, label: AGENT_LABEL[a.agent] ?? a.agent, n: a })))}
          {d.by_mode.length > 0 && table("By kind of work", d.by_mode.map((m) => ({ key: m.mode, label: MODE_LABEL[m.mode] ?? m.mode, n: m })))}

          <div>
            <h2 style={{ margin: "0 0 10px", fontSize: 18 }}>Recommendations</h2>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {tile("New", d.recommendations.new, C.blue)}
              {tile("Accepted", d.recommendations.accepted, C.ok)}
              {tile("Dismissed", d.recommendations.dismissed, C.bad)}
            </div>
          </div>

          <div>
            <h2 style={{ margin: "0 0 10px", fontSize: 18 }}>Latest failures</h2>
            {d.recent_failures.length === 0 ? (
              <div style={{ fontSize: 14, color: p.muted }}>No failures.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {d.recent_failures.map((r) => (
                  <div key={r.id} style={{ padding: 14, borderRadius: 14, border: `1px solid ${p.border}`, borderInlineStart: `4px solid ${C.bad}`, background: p.card }}>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 13, color: p.muted }}>
                      <strong style={{ color: p.text }}>{AGENT_LABEL[r.agent] ?? r.agent}</strong>
                      <span>{fmtDateTime(r.started_at)}</span>
                      {r.client_id && <Link to={`/clients/${r.client_id}`} style={{ color: p.link, textDecoration: "none" }}>Client #{r.client_id}</Link>}
                    </div>
                    <div dir="auto" style={{ marginTop: 6, fontSize: 14, lineHeight: 1.6, overflowWrap: "anywhere" }}>{r.error || "No message."}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}