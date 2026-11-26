import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePortalTheme } from "../../services/portalTheme";
import { mediaApi } from "../../services/media";
import type { MediaItem } from "../../services/media";
import { Btn, Loading, Notice, errorText } from "../Ui";
import MediaPicker from "./MediaPicker";

export function MediaPreview({ m, onBroken }: { m: MediaItem; onBroken?: () => void }) {
  if (m.status === "processing") return <Notice>This file is still being created ({m.metadata?.step ?? "processing"}).</Notice>;
  if (m.status === "failed") return <Notice kind="error">{m.error ?? "This file could not be created."}</Notice>;
  if (!m.url) return null;
  if (m.type === "image") return <img src={m.url} alt={m.prompt ?? ""} onError={onBroken} style={{ display: "block", maxWidth: "100%", borderRadius: 12 }} />;
  if (m.type === "video") return <video src={m.url} controls playsInline onError={onBroken} style={{ display: "block", maxWidth: "100%", maxHeight: 560, borderRadius: 12, background: "#000" }} />;
  return <audio src={m.url} controls onError={onBroken} style={{ width: "100%" }} />;
}

// The images, reels and audio attached to a content item. With `editable` the team can add or remove files.
// New files are made with the AI panel "Ask the AI to change it" (RevisePanel), not from here.
export default function MediaGallery({ contentId, clientId, editable }: { contentId: number; clientId?: number; editable?: boolean }) {
  const { p } = usePortalTheme();
  const qc = useQueryClient();
  const [picking, setPicking] = useState(false);
  const key = ["content-media", contentId];
  const q = useQuery({ queryKey: key, queryFn: () => mediaApi.forContent(contentId) });

  // a link that expired makes the tag fail to load: ask the API again for a fresh one
  const refreshLinks = () => qc.invalidateQueries({ queryKey: key });
  const detach = useMutation({ mutationFn: (id: number) => mediaApi.detach(contentId, id), onSuccess: refreshLinks });

  if (q.isLoading) return <Loading />;
  if (q.isError) return <Notice kind="error">{errorText(q.error)}</Notice>;
  const items = q.data ?? [];
  if (items.length === 0 && !editable) return null;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {items.map((m) => (
        <div key={m.id} style={{ display: "grid", gap: 8 }}>
          <MediaPreview m={m} onBroken={refreshLinks} />
          {m.metadata?.warnings?.map((w) => <span key={w} style={{ fontSize: 12, color: p.muted }}>{w}</span>)}
          {editable && <div><Btn small variant="danger" onClick={() => detach.mutate(m.id)} disabled={detach.isPending}>Remove from this content</Btn></div>}
        </div>
      ))}
      {detach.isError && <Notice kind="error">{errorText(detach.error)}</Notice>}
      {editable && clientId !== undefined && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn small onClick={() => setPicking(true)}>{items.length === 0 ? "+ Add an image or reel" : "+ Add more"}</Btn>
        </div>
      )}
      {picking && clientId !== undefined && <MediaPicker contentId={contentId} clientId={clientId} attachedIds={items.map((i) => i.id)} onClose={() => setPicking(false)} />}
    </div>
  );
}