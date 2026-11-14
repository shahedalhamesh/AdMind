import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { usePortalTheme } from "../../services/portalTheme";
import { mediaApi } from "../../services/media";
import { Loading, Modal, Notice, errorText } from "../Ui";

// Choose a file from the client's library to attach to the content.
export default function MediaPicker({ contentId, clientId, attachedIds, onClose }: { contentId: number; clientId: number; attachedIds: number[]; onClose: () => void }) {
  const { p } = usePortalTheme();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["media", { clientId: String(clientId), type: "", page: 1 }], queryFn: () => mediaApi.list({ client_id: String(clientId), per_page: 48 }) });
  const attach = useMutation({
    mutationFn: (id: number) => mediaApi.attach(contentId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["content-media", contentId] }); onClose(); },
  });
  const items = (list.data?.data ?? []).filter((m) => m.status === "ready" && !attachedIds.includes(m.id));

  return (
    <Modal title="Add from the library" onClose={onClose} width={720}>
      {list.isLoading && <Loading />}
      {list.isError && <Notice kind="error">{errorText(list.error)}</Notice>}
      {attach.isError && <Notice kind="error">{errorText(attach.error)}</Notice>}
      {list.isSuccess && items.length === 0 && (
        <p style={{ margin: 0, fontSize: 14, color: p.muted }}>
          This client has no ready files. Add some in the <Link to="/media" style={{ color: p.link, fontWeight: 600 }}>Media library</Link>.
        </p>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, marginTop: 8 }}>
        {items.map((m) => (
          <button key={m.id} type="button" onClick={() => attach.mutate(m.id)} disabled={attach.isPending}
            style={{ padding: 0, border: `1px solid ${p.border}`, borderRadius: 12, overflow: "hidden", background: p.card, color: p.text, cursor: "pointer", fontFamily: "inherit" }}>
            {m.type === "image" && m.url && <img src={m.url} alt="" style={{ display: "block", width: "100%", height: 120, objectFit: "cover" }} />}
            {m.type === "video" && m.url && <video src={m.url} muted preload="metadata" style={{ display: "block", width: "100%", height: 120, objectFit: "cover", background: "#000" }} />}
            {m.type === "audio" && <div style={{ height: 120, display: "grid", placeItems: "center", fontSize: 13, color: p.muted }}>Audio</div>}
            <div style={{ padding: "6px 8px", fontSize: 12, color: p.muted, textAlign: "start" }}>{m.type}{m.source === "ai_generated" ? " · AI" : ""}</div>
          </button>
        ))}
      </div>
    </Modal>
  );
}