import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../AuthContext";
import { can } from "../../services/auth";
import { usePortalTheme } from "../../services/portalTheme";
import { ASPECT_RATIOS, mediaApi } from "../../services/media";
import type { MediaItem } from "../../services/media";
import { Btn, Field, Loading, Modal, Notice, Select, TextArea, errorText } from "../Ui";
import MediaPicker from "./MediaPicker";

export function MediaPreview({ m, onBroken }: { m: MediaItem; onBroken?: () => void }) {
  if (m.status === "processing") return <Notice>This file is still being created ({m.metadata?.step ?? "processing"}).</Notice>;
  if (m.status === "failed") return <Notice kind="error">{m.error ?? "This file could not be created."}</Notice>;
  if (!m.url) return null;
  if (m.type === "image") return <img src={m.url} alt={m.prompt ?? ""} onError={onBroken} style={{ display: "block", maxWidth: "100%", borderRadius: 12 }} />;
  if (m.type === "video") return <video src={m.url} controls playsInline onError={onBroken} style={{ display: "block", maxWidth: "100%", maxHeight: 560, borderRadius: 12, background: "#000" }} />;
  return <audio src={m.url} controls onError={onBroken} style={{ width: "100%" }} />;
}

type Pending = { id: number; replace: number[] }; // an AI file being built, and the old files it replaces

// The images, reels and audio attached to a content item. With `editable` the team can add or remove files.
export default function MediaGallery({ contentId, clientId, editable }: { contentId: number; clientId?: number; editable?: boolean }) {
  const { p } = usePortalTheme();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [picking, setPicking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [replaceError, setReplaceError] = useState("");
  const key = ["content-media", contentId];
  const q = useQuery({ queryKey: key, queryFn: () => mediaApi.forContent(contentId) });

  // a link that expired makes the tag fail to load: ask the API again for a fresh one
  const refreshLinks = () => qc.invalidateQueries({ queryKey: key });
  const detach = useMutation({ mutationFn: (id: number) => mediaApi.detach(contentId, id), onSuccess: refreshLinks });
  const dropPending = (id: number) => setPending((list) => list.filter((x) => x.id !== id));

  // the new file is ready (the backend attached it): remove the old ones it replaces
  const finish = async (pe: Pending) => {
    dropPending(pe.id);
    try {
      for (const oldId of pe.replace) await mediaApi.detach(contentId, oldId);
    } catch {
      setReplaceError("The new file was added, but the old one could not be removed. Remove it by hand.");
    }
    refreshLinks();
  };

  if (q.isLoading) return <Loading />;
  if (q.isError) return <Notice kind="error">{errorText(q.error)}</Notice>;
  const items = q.data ?? [];
  if (items.length === 0 && pending.length === 0 && !editable) return null;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {items.map((m) => (
        <div key={m.id} style={{ display: "grid", gap: 8 }}>
          <MediaPreview m={m} onBroken={refreshLinks} />
          {m.metadata?.warnings?.map((w) => <span key={w} style={{ fontSize: 12, color: p.muted }}>{w}</span>)}
          {editable && <div><Btn small variant="danger" onClick={() => detach.mutate(m.id)} disabled={detach.isPending}>Remove from this content</Btn></div>}
        </div>
      ))}
      {pending.map((pe) => (
        <PendingMedia key={pe.id} id={pe.id} replacing={pe.replace.length > 0} onReady={() => finish(pe)} onDismiss={() => dropPending(pe.id)} />
      ))}
      {replaceError && <Notice kind="warning">{replaceError}</Notice>}
      {detach.isError && <Notice kind="error">{errorText(detach.error)}</Notice>}
      {editable && clientId !== undefined && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn small onClick={() => setPicking(true)}>{items.length === 0 ? "+ Add an image or reel" : "+ Add more"}</Btn>
          {can(user, "content.create") && <Btn small onClick={() => { setReplaceError(""); setCreating(true); }}>Create new with AI</Btn>}
        </div>
      )}
      {picking && clientId !== undefined && <MediaPicker contentId={contentId} clientId={clientId} attachedIds={items.map((i) => i.id)} onClose={() => setPicking(false)} />}
      {creating && clientId !== undefined && (
        <CreateForContent
          contentId={contentId}
          clientId={clientId}
          items={items}
          onClose={() => setCreating(false)}
          onStarted={(pe) => { setPending((list) => [...list, pe]); setCreating(false); }}
        />
      )}
    </div>
  );
}

// An AI file that is being built for this content: it is attached by itself when it is ready.
function PendingMedia({ id, replacing, onReady, onDismiss }: { id: number; replacing: boolean; onReady: () => void; onDismiss: () => void }) {
  const { p } = usePortalTheme();
  const handled = useRef(false);
  const q = useQuery({
    queryKey: ["media-item", id],
    queryFn: () => mediaApi.get(id),
    refetchInterval: (s) => (s.state.data?.status === "processing" ? 5000 : false),
  });
  const m = q.data;
  const status = m?.status;

  useEffect(() => {
    if (status === "ready" && !handled.current) {
      handled.current = true;
      onReady();
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (q.isError) return <Notice kind="error">{errorText(q.error)}</Notice>;
  if (status === "failed") {
    return (
      <div style={{ display: "grid", gap: 8 }}>
        <Notice kind="error">{m?.error || "The AI could not make this file."} The old file was kept.</Notice>
        <div><Btn small onClick={onDismiss}>Dismiss</Btn></div>
      </div>
    );
  }
  return (
    <div style={{ padding: 14, borderRadius: 12, border: `1px dashed ${p.border}`, fontSize: 14, color: p.muted, lineHeight: 1.6 }}>
      The AI is creating a new file… {m?.metadata?.step ? `(${m.metadata.step.replace(/_/g, " ")})` : ""}
      <div style={{ fontSize: 12, marginTop: 4 }}>
        {replacing ? "When it is ready it replaces the old one. " : "It will appear here when it is ready. "}You can stay on this page.
      </div>
    </div>
  );
}

function CreateForContent({ contentId, clientId, items, onClose, onStarted }: {
  contentId: number; clientId: number; items: MediaItem[]; onClose: () => void; onStarted: (pe: Pending) => void;
}) {
  const { p } = usePortalTheme();
  // start from the description of the file that is attached now, so the employee only changes what they want
  const prev = items.find((i) => i.prompt) ?? null;
  const firstKind: "image" | "reel" = prev?.type === "video" ? "reel" : "image";
  const [kind, setKind] = useState<"image" | "reel">(firstKind);
  const [request, setRequest] = useState(prev?.prompt ?? "");
  const [ratio, setRatio] = useState(prev?.aspect_ratio ?? (firstKind === "reel" ? "9:16" : "1:1"));
  const [language, setLanguage] = useState<"Arabic" | "English">("Arabic");

  const sameType = items.filter((i) => i.type === (kind === "reel" ? "video" : "image")).map((i) => i.id);
  const [replace, setReplace] = useState(true);

  const create = useMutation({
    mutationFn: () =>
      mediaApi.generate({
        client_id: clientId,
        kind,
        request: request.trim(),
        aspect_ratio: ratio,
        content_id: contentId,
        ...(kind === "reel" ? { language } : {}),
      }),
    onSuccess: (m) => onStarted({ id: m.id, replace: replace ? sameType : [] }),
  });
  const chooseKind = (k: "image" | "reel") => { setKind(k); setRatio(k === "reel" ? "9:16" : "1:1"); };

  return (
    <Modal title="Create new with AI" onClose={onClose} width={560}>
      <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn type="button" variant={kind === "image" ? "primary" : "ghost"} onClick={() => chooseKind("image")}>Image</Btn>
          <Btn type="button" variant={kind === "reel" ? "primary" : "ghost"} onClick={() => chooseKind("reel")}>Reel</Btn>
        </div>
        <Field
          label="What do you want? *"
          hint={prev
            ? "The old description is filled in. Change what you want. The AI makes a new picture from it: it cannot edit the old one."
            : kind === "reel" ? "Add “female voice” or “male voice” if you want a voiceover." : undefined}
        >
          <TextArea value={request} onChange={(e) => setRequest(e.target.value)} maxLength={2000} dir="auto" autoFocus rows={5} />
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
        {sameType.length > 0 && (
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
            Replace the current {kind === "reel" ? "reel" : "image"} when the new one is ready
          </label>
        )}
        <span style={{ fontSize: 12, color: p.muted, lineHeight: 1.5 }}>The AI builds one file at a time. If it fails, the old file stays.</span>
        {create.isError && <Notice kind="error">{errorText(create.error)}</Notice>}
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="primary" type="submit" disabled={create.isPending || !request.trim()}>{create.isPending ? "Starting…" : "Create"}</Btn>
          <Btn type="button" onClick={onClose}>Cancel</Btn>
        </div>
      </form>
    </Modal>
  );
}