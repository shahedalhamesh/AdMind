import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { usePortalTheme } from "../services/portalTheme";
import { satisfactionApi, stars } from "../services/satisfaction";
import { Badge, Loading, Notice, errorText } from "./Ui";

export default function AtRiskCard() {
  const { p } = usePortalTheme();
  const q = useQuery({ queryKey: ["satisfaction-overview"], queryFn: () => satisfactionApi.overview(90) });
  const risky = (q.data?.clients ?? []).filter((c) => c.at_risk).slice(0, 5);

  return (
    <div style={{ padding: 20, borderRadius: 16, border: `1px solid ${p.border}`, background: p.card }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Clients at risk</h2>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: p.muted }}>Clients with low ratings or negative comments in the last 90 days.</p>

      {q.isLoading && <Loading />}
      {q.isError && <Notice kind="error">{errorText(q.error)}</Notice>}
      {q.isSuccess && risky.length === 0 && (
        <div style={{ fontSize: 14, color: p.muted }}>No client is at risk right now.</div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {risky.map((c) => (
          <Link key={c.client_id} to={`/clients/${c.client_id}`}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12, border: `1px solid ${p.border}`, textDecoration: "none", color: p.text }}>
            <strong style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{c.client_name}</strong>
            {c.average_rating !== null && (
              <span style={{ color: "#E8A33D", fontSize: 13, whiteSpace: "nowrap" }}>
                {stars(Math.round(c.average_rating))} {c.average_rating.toFixed(1)}
              </span>
            )}
            <Badge tone="bad">{`${c.by_sentiment?.negative ?? 0} negative`}</Badge>
          </Link>
        ))}
      </div>
    </div>
  );
}