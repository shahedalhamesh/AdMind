import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../AuthContext";
import { can } from "../../services/auth";
import { usePortalTheme } from "../../services/portalTheme";
import { fmtDateTime, isOverdue, localToIso, publishApi } from "../../services/content";
import type { PublishJob } from "../../services/content";
import { AMBER, Badge, Btn, Notice, TextInput, errorText, RED } from "../Ui";

export function useRefreshContent() {
  const qc = useQueryClient();
  return () => {
    for (const key of ["publish-jobs", "content", "content-list", "content-total", "approvals"]) {
      qc.invalidateQueries({ queryKey: [key] });
    }
  };
}

// Real publishing runs in the background and can take minutes: refresh every 5 seconds for 5 minutes.
export function usePollContent() {
  const refresh = useRefreshContent();
  return () => {
    refresh();
    let n = 0;
    const t = window.setInterval(() => {
      refresh();
      n += 1;
      if (n >= 60) window.clearInterval(t);
    }, 5000);
  };
}

// One scheduled post. With automatic publishing the AI service posts it; otherwise the team posts it and marks it here.
export default function PublishJobCard({ job, clientName }: { job: PublishJob; clientName?: string }) {
  const { p } = usePortalTheme();
  const { user } = useAuth();
  const refresh = useRefreshContent();
  const canEdit = can(user, "content.update");

  const [mode, setMode] = useState<null | "publish" | "reschedule" | "cancel">(null);
  const [postId, setPostId] = useState("");
  const [when, setWhen] = useState("");

  const done = () => { setMode(null); refresh(); };
  const markPublished = useMutation({ mutationFn: () => publishApi.markPublished(job.id, postId.trim() || undefined), onSuccess: done });
  const reschedule = useMutation({ mutationFn: () => publishApi.reschedule(job.id, localToIso(when)), onSuccess: done });
  const cancel = useMutation({ mutationFn: () => publishApi.cancel(job.id), onSuccess: done });
  // 202: the queue worker publishes it, so keep refreshing for a few minutes to see the result
  const poll = usePollContent();
  const publishNow = useMutation({
    mutationFn: () => publishApi.publishNow(job.id),
    onSuccess: poll,
  });

  const pending = job.status === "pending";
  const failed = job.status === "failed";
  const overdue = isOverdue(job);
  const err = markPublished.error ?? reschedule.error ?? cancel.error ?? publishNow.error;
  const title = job.content?.title ?? `Content #${job.content_id}`;

  return (
    <div style={{ padding: "16px 18px", borderRadius: 14, border: `1px solid ${overdue || failed ? RED : p.border}`, background: p.card }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
          <Link to={`/content/${job.content_id}`} style={{ color: p.text, fontSize: 16, fontWeight: 600, textDecoration: "none", overflowWrap: "anywhere" }}>{title}</Link>
          <div style={{ marginTop: 4, fontSize: 13, color: p.muted }}>
            {[clientName, job.social_account ? `${job.social_account.platform} · ${job.social_account.account_name}` : job.content?.platform].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 13 }}>
          <div style={{ fontWeight: 600, color: overdue ? RED : p.text }}>{fmtDateTime(job.scheduled_at)}</div>
          {job.published_at && <div style={{ color: p.muted }}>Posted {fmtDateTime(job.published_at)}</div>}
        </div>
                {job.status === "publishing" ? <Badge tone="warn">Publishing…</Badge>
          : failed ? <Badge tone="bad">Failed</Badge>
          : overdue ? <Badge tone="bad">Overdue</Badge>
          : <Badge tone={job.status === "published" ? "good" : job.status === "cancelled" ? "plain" : "warn"}>{job.status}</Badge>}
      </div>

      {failed && job.last_error && (
        <div style={{ marginTop: 12 }}><Notice kind="error">{job.last_error}</Notice></div>
      )}
      {publishNow.isSuccess && (
        <div style={{ marginTop: 12 }}><Notice kind="success">Sent to publish. This can take a minute.</Notice></div>
      )}

      {failed && canEdit && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          <Btn small variant="primary" onClick={() => publishNow.mutate()} disabled={publishNow.isPending}>
            {publishNow.isPending ? "Sending…" : "Try again"}
          </Btn>
        </div>
      )}

      {pending && canEdit && mode === null && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          <Btn small variant="primary" onClick={() => publishNow.mutate()} disabled={publishNow.isPending}>
            {publishNow.isPending ? "Sending…" : "Publish now"}
          </Btn>
          <Btn small onClick={() => setMode("publish")}>Mark as published</Btn>
          <Btn small onClick={() => setMode("reschedule")}>Reschedule</Btn>
          <Btn small variant="danger" onClick={() => setMode("cancel")}>Cancel</Btn>
        </div>
      )}

      {mode === "publish" && (
        <div style={{ marginTop: 14, display: "grid", gap: 10, maxWidth: 460 }}>
          <span style={{ fontSize: 13, color: p.muted }}>Did the team post it? You can add the post link or id (optional).</span>
          <TextInput value={postId} onChange={(e) => setPostId(e.target.value)} placeholder="Post link or id (optional)" maxLength={255} />
          <div style={{ display: "flex", gap: 8 }}>
            <Btn small variant="primary" onClick={() => markPublished.mutate()} disabled={markPublished.isPending}>{markPublished.isPending ? "Saving…" : "Yes, it is published"}</Btn>
            <Btn small onClick={() => setMode(null)}>Back</Btn>
          </div>
        </div>
      )}

      {mode === "reschedule" && (
        <div style={{ marginTop: 14, display: "grid", gap: 10, maxWidth: 360 }}>
          <TextInput type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          <div style={{ display: "flex", gap: 8 }}>
            <Btn small variant="primary" onClick={() => reschedule.mutate()} disabled={reschedule.isPending || !when}>{reschedule.isPending ? "Saving…" : "Save new time"}</Btn>
            <Btn small onClick={() => setMode(null)}>Back</Btn>
          </div>
        </div>
      )}

      {mode === "cancel" && (
        <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
          <span style={{ color: AMBER }}>Cancel this post? The content goes back to Approved.</span>
          <Btn small variant="danger" onClick={() => cancel.mutate()} disabled={cancel.isPending}>{cancel.isPending ? "Cancelling…" : "Yes, cancel it"}</Btn>
          <Btn small onClick={() => setMode(null)}>No</Btn>
        </div>
      )}

      {err && <div style={{ marginTop: 12 }}><Notice kind="error">{errorText(err)}</Notice></div>}
    </div>
  );
}