import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "../components/AuthContext";
import { ApiError } from "../services/api";
import { usePortalTheme } from "../services/portalTheme";
import { approvalsApi, contentApi, fmtDateTime, isInternalStage, localToIso } from "../services/content";
import type { Approval, Decision } from "../services/content";
import { PortalShell } from "./Portal";
import MediaGallery from "../components/content/MediaGallery";
import { useRefreshContent } from "../components/content/PublishJobCard";
import { Badge, Btn, Card, Field, Loading, Notice, TextArea, TextInput, errorText, fieldError } from "../components/Ui";

const CHOICES: { id: Decision; label: string; variant: "primary" | "ghost" | "danger"; needsComment: boolean; help: string }[] = [
  { id: "approved", label: "Approve", variant: "primary", needsComment: false, help: "You are happy with it. The agency will schedule it." },
  { id: "changes_requested", label: "Ask for changes", variant: "ghost", needsComment: true, help: "Tell the agency exactly what to change. Your notes help them get it right next time." },
  { id: "rejected", label: "Reject", variant: "danger", needsComment: true, help: "You do not want this content. Tell the agency why, so the next one is better." },
];

const STATUS: Record<string, string> = { pending: "Waiting", approved: "Approved", rejected: "Rejected", changes_requested: "Changes requested" };

export default function PortalReview() {
  const { p } = usePortalTheme();
  const { user } = useAuth();
  const id = Number(useParams().id);

  const q = useQuery({ queryKey: ["content", id], queryFn: () => contentApi.get(id), enabled: Number.isFinite(id) });
  const back = <Link to="/portal" style={{ color: p.link, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>← Back to your content</Link>;

  if (q.isLoading) return <PortalShell><Loading /></PortalShell>;
  if (q.isError || !q.data) {
    const notFound = q.error instanceof ApiError && q.error.status === 404;
    return (
      <PortalShell>
        {back}
        <h1 style={{ margin: "16px 0 0", fontFamily: "Georgia, serif", fontSize: 30, fontWeight: 500 }}>{notFound ? "We could not find this content" : "Could not open this content"}</h1>
        <p style={{ margin: "12px 0 0", color: p.muted }}>{notFound ? "It may have been removed." : errorText(q.error)}</p>
      </PortalShell>
    );
  }

  const { content: item, versions, approvals } = q.data;
  const version = item.current_version ?? versions[0] ?? null;
  // the request that is waiting for this client (the client stage, sent to this login)
  const mine = approvals.find((a) => a.status === "pending" && !isInternalStage(a) && a.requested_from_id === user?.id);
  const history = approvals.filter((a) => a.status !== "pending" && !isInternalStage(a));

  return (
    <PortalShell>
      {back}
      <h1 style={{ margin: "14px 0 0", fontFamily: "Georgia, serif", fontSize: 34, fontWeight: 500, overflowWrap: "anywhere" }}>{item.title}</h1>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}><Badge>{item.type}</Badge><Badge>{item.platform}</Badge></div>

      <div style={{ display: "grid", gap: 18, marginTop: 24 }}>
        <MediaGallery contentId={id} />

        <Card>
          {version ? <div dir="auto" style={{ whiteSpace: "pre-wrap", fontSize: 16, lineHeight: 1.8, overflowWrap: "anywhere" }}>{version.body}</div> : <span style={{ color: p.muted }}>No text.</span>}
          {version?.hashtags && version.hashtags.length > 0 && (
            <div dir="auto" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
              {version.hashtags.map((h) => <Badge key={h}>{h.startsWith("#") ? h : `#${h}`}</Badge>)}
            </div>
          )}
          {version?.script && (
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${p.border}` }}>
              <div style={{ fontSize: 12, color: p.muted, marginBottom: 6 }}>Script</div>
              <div dir="auto" style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.7 }}>{version.script}</div>
            </div>
          )}
        </Card>

        {mine ? <ClientDecision approval={mine} /> : <Notice>{item.status === "approved" || item.status === "scheduled" || item.status === "published" ? "Thank you. This content is approved." : "Nothing to decide on this content right now."}</Notice>}

        {history.length > 0 && (
          <Card>
            <h3 style={{ margin: "0 0 12px", fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 500 }}>Your earlier answers</h3>
            <div style={{ display: "grid", gap: 12 }}>
              {history.map((a: Approval) => (
                <div key={a.id} style={{ paddingBottom: 12, borderBottom: `1px solid ${p.border}` }}>
                  <Badge tone={a.status === "approved" ? "good" : "bad"}>{STATUS[a.status] ?? a.status}</Badge>
                  {a.comment && <div dir="auto" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6 }}>&ldquo;{a.comment}&rdquo;</div>}
                  {a.preferred_publish_at && (
                    <div style={{ marginTop: 8, fontSize: 13, color: p.muted }}>You asked to publish it on {fmtDateTime(a.preferred_publish_at)}</div>
                  )}
                  <div style={{ marginTop: 6, fontSize: 12, color: p.muted }}>{fmtDateTime(a.decided_at ?? a.created_at)}</div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </PortalShell>
  );
}

// The client's decision. The comment box is large on purpose: the AI learns from these notes.
function ClientDecision({ approval }: { approval: Approval }) {
  const refresh = useRefreshContent();
  const [choice, setChoice] = useState<Decision | null>(null);
  const [comment, setComment] = useState("");
  const [when, setWhen] = useState("");

  const decide = useMutation({
    mutationFn: () =>
      approvalsApi.decide(approval.id, {
        decision: choice as Decision,
        comment: comment.trim() || undefined,
        // the time the client would like it published: only with "approved"
        ...(choice === "approved" && when ? { preferred_publish_at: localToIso(when) } : {}),
      }),
    onSuccess: refresh,
  });

  const current = CHOICES.find((c) => c.id === choice);
  const ready = !!current && (!current.needsComment || comment.trim().length > 0);
  const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  if (decide.isSuccess) return <Notice kind="success">Thank you. Your answer was sent to the agency.</Notice>;

  return (
    <Card>
      <h3 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 22, fontWeight: 500 }}>What do you think?</h3>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
        {CHOICES.map((c) => (
          <Btn key={c.id} variant={choice === c.id ? c.variant : "ghost"} onClick={() => { setChoice(c.id); decide.reset(); }}>{c.label}</Btn>
        ))}
      </div>

      {current && (
        <form onSubmit={(e) => { e.preventDefault(); decide.mutate(); }} style={{ display: "grid", gap: 12, marginTop: 18 }}>
          <span style={{ fontSize: 14, opacity: 0.8, lineHeight: 1.5 }}>{current.help}</span>
          <Field label={current.needsComment ? "Your notes *" : "Comment (optional)"} error={fieldError(decide.error, "comment")}>
            <TextArea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} dir="auto" rows={6} autoFocus />
          </Field>

          {choice === "approved" && (
            <Field label="When would you like it published? (optional)" error={fieldError(decide.error, "preferred_publish_at")}>
              <TextInput type="datetime-local" lang="en-US" min={now} value={when} onChange={(e) => setWhen(e.target.value)} />
            </Field>
          )}

          {decide.isError && <Notice kind="error">{errorText(decide.error)}</Notice>}
          <div><Btn variant={current.variant === "ghost" ? "primary" : current.variant} type="submit" disabled={decide.isPending || !ready}>{decide.isPending ? "Sending…" : `Send: ${current.label.toLowerCase()}`}</Btn></div>
        </form>
      )}
    </Card>
  );
}