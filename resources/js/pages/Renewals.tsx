import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { usePortalTheme } from "../services/portalTheme";
import { contractsApi } from "../services/contracts";
import type { Contract, ContractStatus } from "../services/contracts";
import { Badge, Loading, Notice, Select, errorText } from "../components/Ui";

const STATUS_LABEL: Record<ContractStatus, string> = { active: "Active", expiring: "Ending soon", expired: "Expired", cancelled: "Cancelled" };
const STATUS_TONE: Record<ContractStatus, "warn" | "bad" | undefined> = { active: undefined, expiring: "warn", expired: "bad", cancelled: "bad" };

function daysText(c: Contract): string {
  if (c.days_left === null || c.status === "cancelled") return "—";
  if (c.days_left < 0) return `Ended ${Math.abs(c.days_left)} days ago`;
  if (c.days_left === 0) return "Today";
  return `${c.days_left} days`;
}

export default function Renewals() {
  const { p } = usePortalTheme();
  const [status, setStatus] = useState("expiring");
  const q = useQuery({ queryKey: ["contracts", "all", status], queryFn: () => contractsApi.listAll(status) });
  const rows = q.data ?? [];

  // the amount is null for people who may not see it: show that column only when at least one row has it
  const showAmount = rows.some((c) => c.amount !== null && c.amount !== undefined);

  const th: React.CSSProperties = { textAlign: "start", padding: "10px 12px", fontSize: 12, color: p.muted, fontWeight: 600, whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "12px", fontSize: 14, verticalAlign: "middle" };

  return (
    <div>
      <p style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: p.eyeb }}>Clients</p>
      <h1 style={{ margin: "10px 0 6px", fontFamily: "Georgia, serif", fontSize: 38, fontWeight: 500 }}>Renewals</h1>
      <p style={{ margin: "0 0 22px", color: p.muted, fontSize: 15, maxWidth: 640, lineHeight: 1.6 }}>
        Every client's contracts in one place. A contract shows "Ending soon" when it ends or renews within 30 days.
      </p>

      <div style={{ width: 220, marginBottom: 18 }}>
        <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="expiring">Ending soon</option>
          <option value="">All contracts</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </div>

      {q.isLoading && <Loading />}
      {q.isError && <Notice kind="error">{errorText(q.error)}</Notice>}
      {q.isSuccess && rows.length === 0 && (
        <div style={{ padding: 28, borderRadius: 16, border: `1px dashed ${p.border}`, color: p.muted, fontSize: 15 }}>
          {status === "expiring" ? "No contract is ending soon." : "No contracts."}
        </div>
      )}

      {rows.length > 0 && (
        <div style={{ overflowX: "auto", borderRadius: 14, border: `1px solid ${p.border}`, background: p.card }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${p.border}` }}>
                <th style={th}>Client</th>
                <th style={th}>Service</th>
                <th style={th}>Ends</th>
                <th style={th}>Renewal</th>
                <th style={th}>Time left</th>
                {showAmount && <th style={th}>Amount</th>}
                <th style={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} style={{ borderBottom: `1px solid ${p.border}` }}>
                  <td style={td}>
                    <Link to={`/clients/${c.client_id}`} style={{ color: p.link, fontWeight: 600, textDecoration: "none" }}>
                      {c.client?.name ?? `Client #${c.client_id}`}
                    </Link>
                  </td>
                  <td style={td} dir="auto">{c.service}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{c.ends_on ?? "—"}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{c.renewal_date ?? "—"}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{daysText(c)}</td>
                  {showAmount && <td style={td}>{c.amount ?? ""}</td>}
                  <td style={td}><Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status] ?? c.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}