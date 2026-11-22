import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../components/AuthContext";
import { can } from "../services/auth";
import { usePortalTheme } from "../services/portalTheme";
import { clientsApi } from "../services/clients";
import { contentApi } from "../services/content";
import { ASPECT_RATIOS, MAX_UPLOAD_MB, mediaApi } from "../services/media";
import type { MediaItem } from "../services/media";
import { MediaPreview } from "../components/content/MediaGallery";
import { Badge, Btn, Field, Loading, Modal, Notice, Select, TextArea, errorText } from "../components/Ui";

export default function Media() {
  const { p } = usePortalTheme();
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [clientId, setClientId] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [openItem, setOpenItem] = useState<MediaItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const clients = useQuery({ queryKey: ["clients", { q: "", status: "" }], queryFn: () => clientsApi.list({}) });
  const list = useQuery({
    queryKey: ["media", { clientId, type, page }],
    queryFn: () => mediaApi.list({ client_id: clientId, type, page, per_page: 24 }),
    enabled: !!clientId,
    // the AI files are still being built: ask again every 5 seconds until none is left
    refetchInterval: (q) => (q.state.data?.data.some((m) => m.status === "processing") ? 5000 : false),
  });
  const items = list.data?.data ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ["media"] });

  const upload = useMutation({ mutationFn: (file: File) => mediaApi.upload(Number(clientId), file), onSuccess: refresh });

  const pick = (file: File | undefined) => {
    setUploadError("");
    if (!file) return;
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) { setUploadError(`The file is larger than ${MAX_UPLOAD_MB} MB.`); return; }
    upload.mutate(file);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: p.eyeb }}>Media</p>
          <h1 style={{ margin: "10px 0 0", fontFamily: "Georgia, serif", fontSize: 38, fontWeight: 500 }}>Media library</h1>
        </div>
        {can(user, "content.create") && clientId && (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input ref={fileInput} type="file" hidden accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,audio/mpeg,audio/wav,audio/mp4,audio/ogg,audio/aac,.m4a,.mp3,.wav" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
            <Btn onClick={() => fileInput.current?.click()} disabled={upload.isPending}>{upload.isPending ? "Uploading…" : "Upload a file"}</Btn>
            <button type="button" className="ai-button ai-button-solid" onClick={() => setCreating(true)} style={{ padding: "11px 20px", fontSize: 14, cursor: "pointer" }}>
              ✦ Create with AI
            </button>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "22px 0 18px" }}>
        <div style={{ width: 240 }}>
          <Select aria-label="Client" value={clientId} onChange={(e) => { setClientId(e.target.value); setPage(1); }}>
            <option value="">Choose a client…</option>
            {(clients.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <div style={{ width: 160 }}>
          <Select aria-label="Type" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
            <option value="">All files</option>
            <option value="image">Images</option>
            <option value="video">Videos</option>
            <option value="audio">Audio</option>
          </Select>
        </div>
      </div>

      {uploadError && <div style={{ marginBottom: 14 }}><Notice kind="error">{uploadError}</Notice></div>}
      {upload.isError && <div style={{ marginBottom: 14 }}><Notice kind="error">{errorText(upload.error)}</Notice></div>}
      {!clientId && <div style={{ padding: 28, borderRadius: 16, border: `1px dashed ${p.border}`, color: p.muted, fontSize: 15 }}>Choose a client to see their files.</div>}
      {clientId && list.isLoading && <Loading />}
      {list.isError && <Notice kind="error">{errorText(list.error)}</Notice>}
      {list.isSuccess && items.length === 0 && <div style={{ padding: 28, borderRadius: 16, border: `1px dashed ${p.border}`, color: p.muted, fontSize: 15 }}>No files yet.</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
        {items.map((m) => (
          <button key={m.id} type="button" onClick={() => setOpenItem(m)}
            style={{ padding: 0, border: `1px solid ${m.status === "processing" ? p.aiBorder : p.border}`, borderRadius: 14, overflow: "hidden", background: p.card, color: p.text, cursor: "pointer", fontFamily: "inherit", textAlign: "start" }}>
            {m.status === "ready" && m.type === "image" && m.url && <img src={m.url} alt="" style={{ display: "block", width: "100%", height: 150, objectFit: "cover" }} />}
            {m.status === "ready" && m.type === "video" && m.url && <video src={m.url} muted preload="metadata" style={{ display: "block", width: "100%", height: 150, objectFit: "cover", background: "#000" }} />}
            {(m.status !== "ready" || m.type === "audio") && (
              <div style={{ height: 150, display: "grid", placeItems: "center", padding: 12, fontSize: 13, color: m.status === "processing" ? p.aiText : p.muted, textAlign: "center" }}>
                {m.status === "processing" ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <span className="ai-dot" />Creating… {m.metadata?.step ?? ""}
                  </span>
                ) : m.status === "failed" ? "Failed" : "Audio"}
              </div>
            )}
            <div style={{ padding: "10px 12px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <Badge>{m.type}</Badge>
              {m.source === "ai_generated" && (
                <span className="ai-button" style={{ padding: "2px 9px", fontSize: 11, borderRadius: 99, boxShadow: "none" }}>✦ AI</span>
              )}
              {m.status === "failed" && <Badge tone="bad">failed</Badge>}
            </div>
          </button>
        ))}
      </div>

      {list.data && list.data.last_page > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 22, fontSize: 13, color: p.muted }}>
          <Btn small onClick={() => setPage((n) => n - 1)} disabled={page <= 1}>← Previous</Btn>
          <span>Page {list.data.current_page} of {list.data.last_page}</span>
          <Btn small onClick={() => setPage((n) => n + 1)} disabled={page >= list.data.last_page}>Next →</Btn>
        </div>
      )}

      {openItem && <MediaDetail itemId={openItem.id} fallback={openItem} onClose={() => setOpenItem(null)} onChanged={refresh} />}
      {creating && clientId && <CreateWithAi clientId={Number(clientId)} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); refresh(); }} />}
    </div>
  );
}

function MediaDetail({ itemId, fallback, onClose, onChanged }: { itemId: number; fallback: MediaItem; onClose: () => void; onChanged: () => void }) {
  const { p } = usePortalTheme();
  const { user } = useAuth();
  const q = useQuery({ queryKey: ["media-item", itemId], queryFn: () => mediaApi.get(itemId), refetchInterval: (s) => (s.state.data?.status === "processing" ? 5000 : false) });
  const m = q.data ?? fallback;
  const remove = useMutation({ mutationFn: () => mediaApi.remove(itemId), onSuccess: () => { onChanged(); onClose(); } });

  return (
    <Modal title="File" onClose={onClose} width={640}>
      <div style={{ display: "grid", gap: 14 }}>
        <MediaPreview m={m} onBroken={() => q.refetch()} />
        {m.prompt && <div dir="auto" style={{ fontSize: 13, color: p.muted, lineHeight: 1.6 }}>Request: {m.prompt}</div>}
        {m.metadata?.script && <div dir="auto" style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.7 }}><strong>Voiceover:</strong> {m.metadata.script}</div>}
        {m.metadata?.warnings?.map((w) => <span key={w} style={{ fontSize: 12, color: p.muted }}>{w}</span>)}
        {m.status === "ready" && can(user, "content.update") && <AddToPost media={m} />}
        {remove.isError && <Notice kind="error">{errorText(remove.error)}</Notice>}
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <Btn onClick={onClose}>Close</Btn>
          {can(user, "content.update") && m.status !== "processing" && (
            <Btn variant="danger" onClick={() => { if (window.confirm("Delete this file?")) remove.mutate(); }} disabled={remove.isPending}>Delete</Btn>
          )}
        </div>
      </div>
    </Modal>
  );
}

// Put this file in one of the client's drafts. The post then goes for approval with its media.
function AddToPost({ media }: { media: MediaItem }) {
  const { p } = usePortalTheme();
  const [contentId, setContentId] = useState("");

  const drafts = useQuery({
    queryKey: ["content-list", { clientId: String(media.client_id), status: "draft", forMedia: true }],
    queryFn: () => contentApi.list({ client_id: String(media.client_id), status: "draft", type: "", platform: "", page: 1, per_page: 50 }),
  });
  const items = drafts.data?.data ?? [];

  const attach = useMutation({ mutationFn: () => mediaApi.attach(Number(contentId), media.id) });

  const box: React.CSSProperties = { display: "grid", gap: 10, padding: 14, borderRadius: 14, border: `1px solid ${p.border}` };

  if (attach.isSuccess) {
    return (
      <div style={box}>
        <Notice kind="success">Added to the post.</Notice>
        <Link to={`/content/${contentId}`} style={{ fontSize: 14, fontWeight: 600, color: p.link }}>Open the post to send it for approval →</Link>
      </div>
    );
  }

  return (
    <div style={box}>
      <strong style={{ fontSize: 14 }}>Add to a post</strong>
      {drafts.isLoading && <Loading />}
      {drafts.isError && <Notice kind="error">{errorText(drafts.error)}</Notice>}
      {drafts.isSuccess && items.length === 0 && (
        <span style={{ fontSize: 13, color: p.muted, lineHeight: 1.6 }}>
          There is no draft for this client yet. Make one in Content: Create with AI, then Text, then Save as content.
        </span>
      )}
      {items.length > 0 && (
        <>
          <Select aria-label="Draft" value={contentId} onChange={(e) => setContentId(e.target.value)}>
            <option value="">Choose a draft…</option>
            {items.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </Select>
          {attach.isError && <Notice kind="error">{errorText(attach.error)}</Notice>}
          <div>
            <Btn variant="primary" onClick={() => attach.mutate()} disabled={!contentId || attach.isPending}>{attach.isPending ? "Adding…" : "Add to post"}</Btn>
          </div>
        </>
      )}
    </div>
  );
}

function CreateWithAi({ clientId, onClose, onCreated }: { clientId: number; onClose: () => void; onCreated: () => void }) {
  const { p } = usePortalTheme();
  const [kind, setKind] = useState<"image" | "reel">("image");
  const [request, setRequest] = useState("");
  const [ratio, setRatio] = useState("1:1");
  const [language, setLanguage] = useState<"Arabic" | "English">("Arabic");

  const create = useMutation({
    mutationFn: () => mediaApi.generate({ client_id: clientId, kind, request: request.trim(), aspect_ratio: ratio, ...(kind === "reel" ? { language } : {}) }),
    onSuccess: onCreated,
  });
  const chooseKind = (k: "image" | "reel") => { setKind(k); setRatio(k === "reel" ? "9:16" : "1:1"); };

  const kindBtn = (k: "image" | "reel", label: string) => (
    <button
      type="button"
      className={kind === k ? "ai-button ai-button-solid" : "ai-button"}
      style={{ padding: "6px 14px", fontSize: 13, cursor: "pointer" }}
      onClick={() => chooseKind(k)}
    >
      {label}
    </button>
  );

  const canCreate = !create.isPending && !!request.trim();

  return (
    <Modal title="Create with AI" onClose={onClose} width={560}>
      <div className="ai-surface" style={{ padding: 16 }}>
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {kindBtn("image", "Image")}
            {kindBtn("reel", "Reel")}
          </div>
          <Field label="What do you want? *" hint={kind === "reel" ? "Add “female voice” or “calm music” if you want a voiceover." : undefined}>
            <TextArea value={request} onChange={(e) => setRequest(e.target.value)} maxLength={2000} dir="auto" autoFocus />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Shape">
              <Select value={ratio} onChange={(e) => setRatio(e.target.value)}>{ASPECT_RATIOS.map((r) => <option key={r} value={r}>{r}</option>)}</Select>
            </Field>
            {kind === "reel" && (
              <Field label="Voiceover language">
                <Select value={language} onChange={(e) => setLanguage(e.target.value as "Arabic" | "English")}><option value="Arabic">Arabic</option><option value="English">English</option></Select>
              </Field>
            )}
          </div>
          <span style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: p.muted, lineHeight: 1.5 }}>
            <span className="ai-dot" style={{ marginTop: 4, flexShrink: 0 }} />
            <span>
              {kind === "reel" ? "A reel takes 2 to 12 minutes. You can leave this page: you get a notification when it is ready." : "An image takes about 30 seconds."} The AI builds one file at a time.
            </span>
          </span>
          {create.isError && <Notice kind="error">{errorText(create.error)}</Notice>}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="submit"
              className="ai-button ai-button-solid"
              disabled={!canCreate}
              style={{ padding: "10px 22px", cursor: canCreate ? "pointer" : "not-allowed", opacity: canCreate ? 1 : 0.55 }}
            >
              {create.isPending ? "Starting…" : "Create"}
            </button>
            <Btn onClick={onClose}>Cancel</Btn>
          </div>
        </form>
      </div>
    </Modal>
  );
}