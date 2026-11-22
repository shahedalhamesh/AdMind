import { useState } from "react";
import type { ComponentProps } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";
import { usePortalTheme } from "../services/portalTheme";
import { clientsApi } from "../services/clients";
import type { Paginated } from "../services/content";
import PublishJobCard from "../components/content/PublishJobCard";
import { Loading, Notice, RED, Select, errorText } from "../components/Ui";

/* Mirrors section 5g: GET /publish-jobs (the calendar). Posting is manual: the team posts, then marks it published. */

type CardJob = ComponentProps<typeof PublishJobCard>["job"];
type Job = { id: number; scheduled_at: string; status: string; content?: { client_id: number; title: string } | null };
type Tab = "today" | "overdue" | "scheduled" | "published";

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function paramsFor(tab: Tab, clientId: string) {
  const today = ymd(new Date());
  const base = { per_page: 100, ...(clientId ? { client_id: clientId } : {}) };
  if (tab === "today") return { ...base, status: "pending", from: today, to: today };
  if (tab === "overdue") return { ...base, status: "pending", overdue: 1 };
  if (tab === "scheduled") return { ...base, status: "pending", from: today };
  return { ...base, status: "published" };
}

export default function Publishing() {
  const { p } = usePortalTheme();
  const [tab, setTab] = useState<Tab>("today");
  const [clientId, setClientId] = useState("");

  const clients = useQuery({ queryKey: ["clients", { q: "", status: "" }], queryFn: () => clientsApi.list({}) });
  const clientName = (id?: number) => (clients.data ?? []).find((c) => c.id === id)?.name;

  const list = useQuery({
    queryKey: ["publish-jobs", { page: "calendar", tab, clientId }],
    queryFn: () => api<Paginated<Job>>("/publish-jobs", { params: paramsFor(tab, clientId) }),
    refetchInterval: 60000,
  });
  // only for the red number on the Overdue tab
  const overdue = useQuery({
    queryKey: ["publish-jobs", { page: "calendar-overdue", clientId }],
    queryFn: () => api<Paginated<Job>>("/publish-jobs", { params: { ...paramsFor("overdue", clientId), per_page: 1 } }),
    refetchInterval: 60000,
  });
  const overdueCount = overdue.data?.total ?? 0;

  const jobs = list.data?.data ?? [];
  // group by day (the date part of scheduled_at)
  const days: [string, Job[]][] = [];
  for (const j of jobs) {
    const day = (j.scheduled_at ?? "").slice(0, 10);
    const last = days[days.length - 1];
    if (last && last[0] === day) last[1].push(j);
    else days.push([day, [j]]);
  }

  const tabs: [Tab, string][] = [["today", "To publish today"], ["overdue", overdueCount > 0 ? `Overdue (${overdueCount})` : "Overdue"], ["scheduled", "All scheduled"], ["published", "Published"]];
  const empty: Record<Tab, string> = {
    today: "Nothing to publish today.",
    overdue: "Nothing is late. Good.",
    scheduled: "No scheduled content.",
    published: "Nothing published yet.",
  };

  return (
    <div>
      <p style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: p.eyeb }}>Publishing</p>
      <h1 style={{ margin: "10px 0 0", fontFamily: "Georgia, serif", fontSize: 38, fontWeight: 500 }}>Publishing calendar</h1>
      <p style={{ margin: "8px 0 0", fontSize: 15, color: p.muted, maxWidth: 680 }}>
        You post on Instagram yourself, then tap <strong style={{ color: p.text }}>Mark as published</strong> here. Late items are highlighted.
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", margin: "22px 0 0" }}>
        <div style={{ width: 220 }}>
          <Select aria-label="Filter by client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">All clients</option>
            {(clients.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
      </div>

      <div role="tablist" style={{ display: "flex", gap: 6, margin: "18px 0 20px", borderBottom: `1px solid ${p.border}`, overflowX: "auto" }}>
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} type="button" onClick={() => setTab(id)}
            style={{ padding: "11px 16px", border: 0, borderBottom: `2px solid ${tab === id ? p.pri : "transparent"}`, background: "transparent", color: id === "overdue" && overdueCount > 0 ? RED : tab === id ? p.text : p.muted, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
            {label}
          </button>
        ))}
      </div>

      {list.isLoading && <Loading />}
      {list.isError && <Notice kind="error">{errorText(list.error)}</Notice>}
      {list.isSuccess && jobs.length === 0 && (
        <div style={{ padding: 28, borderRadius: 16, border: `1px dashed ${p.border}`, color: p.muted, fontSize: 15 }}>{empty[tab]}</div>
      )}

      <div style={{ display: "grid", gap: 22 }}>
        {days.map(([day, items]) => (
          <div key={day}>
            <div style={{ margin: "0 0 10px", fontFamily: "ui-monospace, monospace", fontSize: 12, letterSpacing: ".14em", color: p.eyeb }}>{day}</div>
            <div style={{ display: "grid", gap: 12 }}>
              {items.map((j) => (
                <PublishJobCard key={j.id} job={j as unknown as CardJob} clientName={clientName(j.content?.client_id)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}