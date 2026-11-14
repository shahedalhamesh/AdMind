import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "../components/AuthContext";
import { can } from "../services/auth";
import { ApiError } from "../services/api";
import { usePortalTheme } from "../services/portalTheme";
import { STATUS_LABEL, contentApi, contentTone, fmtDateTime, isInternalStage, publishApi } from "../services/content";
import DecisionPanel from "../components/content/DecisionPanel";
import SchedulePanel from "../components/content/SchedulePanel";
import PublishJobCard, { useRefreshContent } from "../components/content/PublishJobCard";
import { Badge, Btn, Card, Loading, Notice, errorText } from "../components/Ui";
import MediaGallery from "../components/content/MediaGallery";

const APPROVAL_LABEL: Record<string, string> = {
  pending: "Waiting",
  approved: "Approved",
  rejected: "Rejected",
  changes_requested: "Changes requested",
};

export default function ContentDetail() {
  const { p } = usePortalTheme();
  const { user } = useAuth();
  const refresh = useRefreshContent();
  const id = Number(useParams().id);

  const query = useQuery({ queryKey: ["content", id], queryFn: () => contentApi.get(id), enabled: Number.isFinite(id) });

  const item = query.data?.content;
  const isScheduledOrPublished = item?.status === "scheduled" || item?.status === "published";

  // the posting time of this content (its publish job)
  const jobs = useQuery({
    queryKey: ["publish-jobs", { client_id: String(item?.client_id), content: id }],
    queryFn: () => publishApi.list({ client_id: String(item!.client_id), status: "pending,published", per_page: 100 }),
    enabled: !!item && isScheduledOrPublished,
  });

  const submit = useMutation({ mutationFn: () => contentApi.submit(id), onSuccess: refresh });

  const back = <Link to="/content" style={{ color: p.link, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>← All content</Link>;

  if (query.isLoading) return <Loading />;
  if (query.isError || !query.data || !item) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div style={{ maxWidth: 560 }}>
        {back}
        <h1 style={{ margin: "16px 0 0", fontFamily: "Georgia, serif", fontSize: 32, fontWeight: 500 }}>{notFound ? "Content not found" : "Could not open this content"}</h1>
        <p style={{ margin: "12px 0 0", fontSize: 15, lineHeight: 1.6, color: p.muted }}>{notFound ? "It does not exist, or it belongs to another company." : errorText(query.error)}</p>
      </div>
    );
  }

  const { versions, approvals } = query.data;
  const version = item.current_version ?? versions[0] ?? null;
  const pendingInternal = approvals.find((a) => a.status === "pending" && isInternalStage(a));
  const pendingClient = approvals.find((a) => a.status === "pending" && !isInternalStage(a));
  // the person asked to decide it, or a manager (the backend checks this again)
  const canDecide = !!pendingInternal && can(user, "approvals.respond") && (can(user, "approvals.manage") || pendingInternal.requested_from_id === user?.id);
  const canEditContent = can(user, "content.update");
  const job = (jobs.data?.data ?? []).filter((j) => j.content_id === id)[0];

  return (
    <div>
      {back}

      <div style={{ marginTop: 14 }}>
        <h1 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 36, fontWeight: 500, overflowWrap: "anywhere" }}>{item.title}</h1>
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 14, color: p.muted }}>
          <Badge tone={contentTone(item.status)}>{STATUS_LABEL[item.status] ?? item.status}</Badge>
          <Badge>{item.type}</Badge>
          <Badge>{item.platform}</Badge>
          {item.client && <Link to={`/clients/${item.client.id}`} style={{ color: p.link, fontWeight: 600, textDecoration: "none" }}>{item.client.name}</Link>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 22, marginTop: 26, alignItems: "start" }}>
        {/* The content itself */}
        <div style={{ display: "grid", gap: 18 }}>
          <Card>
             <MediaGallery contentId={id} clientId={item.client_id} editable={canEditContent} />
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 500 }}>Text</h3>
              {version && <span style={{ fontSize: 12, color: p.muted }}>Version {version.version_number}{version.language ? ` · ${version.language.toUpperCase()}` : ""}</span>}
            </div>
            {version ? (
              <div dir="auto" style={{ whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.7, overflowWrap: "anywhere" }}>{version.body}</div>
            ) : (
              <span style={{ color: p.muted, fontSize: 14 }}>No text yet.</span>
            )}
            {version?.hashtags && version.hashtags.length > 0 && (
              <div dir="auto" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
                {version.hashtags.map((h) => <Badge key={h}>{h.startsWith("#") ? h : `#${h}`}</Badge>)}
              </div>
            )}
          </Card>

          {version?.script && (
            <Card>
              <h3 style={{ margin: "0 0 12px", fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 500 }}>Script</h3>
              <div dir="auto" style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.7, overflowWrap: "anywhere" }}>{version.script}</div>
            </Card>
          )}

          {versions.length > 1 && (
            <Card>
              <h3 style={{ margin: "0 0 12px", fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 500 }}>Versions</h3>
              <div style={{ display: "grid", gap: 8, fontSize: 13 }}>
                {versions.map((v) => (
                  <div key={v.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, color: v.id === version?.id ? p.text : p.muted }}>
                    <span>Version {v.version_number}{v.id === version?.id ? " (current)" : ""}{v.instruction ? ` · ${v.instruction}` : ""}</span>
                    <span style={{ whiteSpace: "nowrap" }}>{fmtDateTime(v.created_at)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* What can be done now */}
        <div style={{ display: "grid", gap: 18 }}>
          {canDecide && pendingInternal && <DecisionPanel approval={pendingInternal} />}

          {item.status === "in_review" && !canDecide && (
            <Notice>
              {pendingClient ? "This content is with the client for review." : pendingInternal ? "This content is waiting for a manager's review." : "This content is in review."}
            </Notice>
          )}

          {item.status === "draft" && item.current_version_id && canEditContent && (
            <Card>
              <h3 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 500 }}>Send for approval</h3>
              <p style={{ margin: "6px 0 14px", fontSize: 13, opacity: 0.75, lineHeight: 1.5 }}>
                {can(user, "approvals.manage") ? "As a manager, this goes straight to the client." : "It goes to a manager first. The client sees nothing yet."}
              </p>
              {submit.isError && <div style={{ marginBottom: 12 }}><Notice kind="error">{errorText(submit.error)}</Notice></div>}
              {submit.isSuccess && <div style={{ marginBottom: 12 }}><Notice kind="success">{submit.data.stage === "internal" ? "Sent to a manager for review." : "Sent to the client."}</Notice></div>}
              <Btn variant="primary" onClick={() => submit.mutate()} disabled={submit.isPending || submit.isSuccess}>{submit.isPending ? "Sending…" : "Send for approval"}</Btn>
            </Card>
          )}

          {item.status === "revision_requested" && (
            <Notice kind="warning">Changes were requested. The team updates the text, then sends it again.</Notice>
          )}

          {item.status === "approved" && canEditContent && <SchedulePanel item={item} />}
          {item.status === "approved" && !canEditContent && <Notice kind="success">Approved. Waiting to be scheduled.</Notice>}

          {isScheduledOrPublished && (
            jobs.isLoading ? <Loading /> : job ? <PublishJobCard job={job} clientName={item.client?.name} /> : null
          )}

          <Card>
            <h3 style={{ margin: "0 0 12px", fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 500 }}>Approval history</h3>
            {approvals.length === 0 ? (
              <span style={{ fontSize: 14, color: p.muted }}>Nobody has reviewed this yet.</span>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {approvals.map((a) => (
                  <div key={a.id} style={{ paddingBottom: 12, borderBottom: `1px solid ${p.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", fontSize: 13 }}>
                      <span style={{ fontWeight: 600 }}>{isInternalStage(a) ? "Manager review" : "Client review"}</span>
                      <Badge tone={a.status === "approved" ? "good" : a.status === "pending" ? "warn" : "bad"}>{APPROVAL_LABEL[a.status] ?? a.status}</Badge>
                    </div>
                    {a.comment && <div dir="auto" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6, overflowWrap: "anywhere" }}>&ldquo;{a.comment}&rdquo;</div>}
                    <div style={{ marginTop: 6, fontSize: 12, color: p.muted }}>{fmtDateTime(a.decided_at ?? a.created_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}