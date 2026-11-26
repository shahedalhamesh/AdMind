import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../AuthContext";
import { can } from "../../services/auth";
import { usePortalTheme } from "../../services/portalTheme";
import { fmtDateTime } from "../../services/content";
import { FEEDBACK_SOURCES, satisfactionApi, stars } from "../../services/satisfaction";
import type { FeedbackSource, Sentiment } from "../../services/satisfaction";
import { Badge, Btn, Field, Loading, Notice, Select, TextArea, TextInput, errorText, fieldError } from "../Ui";

const SENTIMENT_TONE: Record<Sentiment, "good" | "warn" | "bad"> = { positive: "good", neutral: "warn", negative: "bad" };

export default function SatisfactionTab({ clientId }: { clientId: number }) {
  const { p } = usePortalTheme();
  const { user } = useAuth();
  const qc = useQueryClient();
  const canEdit = can(user, "clients.update");
  const [page, setPage] = useState(1);

  const q = useQuery({ queryKey: ["satisfaction", clientId, page], queryFn: () => satisfactionApi.get(clientId, page) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["satisfaction", clientId] });
  const remove = useMutation({ mutationFn: (id: number) => satisfactionApi.remove(id), onSuccess: refresh });

  if (q.isLoading) return <Loading />;
  if (q.isError) return <Notice kind="error">{errorText(q.error)}</Notice>;

  const s = q.data!.summary;
  const rows = q.data!.feedback.data;
  const lastPage = q.data!.feedback.last_page;
  const topics = Object.entries(s.top_topics ?? {});

  const stat = (label: string, value: string | number) => (
    <div style={{ padding: 14, borderRadius: 14, border: `1px solid ${p.border}`, background: p.card, minWidth: 130 }}>
      <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: p.muted }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 22, fontWeight: 600 }}>{value}</div>
    </div>
  );

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {s.at_risk && <Notice kind="error">This client may be unhappy. The average rating is low or there is more than one negative comment.</Notice>}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {stat("Average rating", s.average_rating !== null ? `${s.average_rating.toFixed(1)} / 5` : "—")}
        {stat("Feedback", s.count)}
        {stat("Positive", s.by_sentiment?.positive ?? 0)}
        {stat("Neutral", s.by_sentiment?.neutral ?? 0)}
        {stat("Negative", s.by_sentiment?.negative ?? 0)}
      </div>

      {topics.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 13, color: p.muted }}>
          Topics:
          {topics.map(([t, n]) => <Badge key={t}>{`${t} · ${n}`}</Badge>)}
        </div>
      )}

      {canEdit && <AddForm clientId={clientId} onAdded={() => { setPage(1); refresh(); }} />}

      {remove.isError && <Notice kind="error">{errorText(remove.error)}</Notice>}
      {rows.length === 0 && (
        <div style={{ padding: 24, borderRadius: 14, border: `1px dashed ${p.border}`, color: p.muted, fontSize: 15 }}>No feedback yet.</div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {rows.map((r) => (
          <div key={r.id} style={{ display: "flex", gap: 14, padding: 14, borderRadius: 14, border: `1px solid ${p.border}`, background: p.card }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}>
                {r.rating && <span style={{ color: "#E8A33D", letterSpacing: 2 }}>{stars(r.rating)}</span>}
                {r.sentiment && <Badge tone={SENTIMENT_TONE[r.sentiment]}>{r.sentiment}</Badge>}
                <Badge>{r.source}</Badge>
                {r.topic && <Badge>{r.topic}</Badge>}
              </div>
              {r.comment && <div dir="auto" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 15, lineHeight: 1.6 }}>{r.comment}</div>}
              <div style={{ marginTop: 6, fontSize: 12, color: p.muted }}>{fmtDateTime(r.created_at)}</div>
            </div>
            {canEdit && (
              <Btn small variant="danger" disabled={remove.isPending}
                onClick={() => { if (window.confirm("Delete this feedback?")) remove.mutate(r.id); }}>Delete</Btn>
            )}
          </div>
        ))}
      </div>

      {lastPage > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, fontSize: 13, color: p.muted }}>
          <Btn small onClick={() => setPage((n) => n - 1)} disabled={page <= 1}>← Previous</Btn>
          <span>Page {page} of {lastPage}</span>
          <Btn small onClick={() => setPage((n) => n + 1)} disabled={page >= lastPage}>Next →</Btn>
        </div>
      )}
    </div>
  );
}

function AddForm({ clientId, onAdded }: { clientId: number; onAdded: () => void }) {
  const { p } = usePortalTheme();
  const [source, setSource] = useState<FeedbackSource>("survey");
  const [rating, setRating] = useState("");
  const [comment, setComment] = useState("");
  const [topic, setTopic] = useState("");

  const add = useMutation({
    mutationFn: () =>
      satisfactionApi.add(clientId, {
        source,
        ...(rating ? { rating: Number(rating) } : {}),
        ...(comment.trim() ? { comment: comment.trim() } : {}),
        ...(topic.trim() ? { topic: topic.trim() } : {}),
      }),
    onSuccess: () => { setRating(""); setComment(""); setTopic(""); onAdded(); },
  });

  // the backend needs a rating or a comment
  const ok = !!rating || !!comment.trim();

  return (
    <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }}
      style={{ display: "grid", gap: 12, padding: 16, borderRadius: 14, border: `1px solid ${p.border}`, background: p.card }}>
      <strong style={{ fontSize: 15 }}>Record what the client said</strong>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ width: 160 }}>
          <Field label="Where from" error={fieldError(add.error, "source")}>
            <Select value={source} onChange={(e) => setSource(e.target.value as FeedbackSource)}>
              {FEEDBACK_SOURCES.map((x) => <option key={x} value={x}>{x[0].toUpperCase() + x.slice(1)}</option>)}
            </Select>
          </Field>
        </div>
        <div style={{ width: 140 }}>
          <Field label="Rating" error={fieldError(add.error, "rating")}>
            <Select value={rating} onChange={(e) => setRating(e.target.value)}>
              <option value="">No rating</option>
              {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{`${n} ${"★".repeat(n)}`}</option>)}
            </Select>
          </Field>
        </div>
        <div style={{ width: 200 }}>
          <Field label="Topic (optional)" error={fieldError(add.error, "topic")}>
            <TextInput value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={80} dir="auto" placeholder="e.g. timing" />
          </Field>
        </div>
      </div>
      <Field label="Comment" error={fieldError(add.error, "comment")}>
        <TextArea value={comment} onChange={(e) => setComment(e.target.value)} dir="auto" maxLength={2000} />
      </Field>
      {add.isError && <Notice kind="error">{errorText(add.error)}</Notice>}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Btn variant="primary" type="submit" disabled={add.isPending || !ok}>{add.isPending ? "Saving…" : "Save"}</Btn>
        {!ok && <span style={{ fontSize: 12, color: p.muted }}>Add a rating or a comment.</span>}
      </div>
    </form>
  );
}