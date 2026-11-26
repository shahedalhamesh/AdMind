import { useQuery } from "@tanstack/react-query";
import { mediaApi } from "../../services/media";
import { usePortalTheme } from "../../services/portalTheme";

// Shows what was asked when the image or reel was made.
// "Ask the AI to change it" already sends this request together with the change, so the person writes only the change.
export default function OriginalRequest({ contentId }: { contentId: number }) {
  const { p } = usePortalTheme();
  const attached = useQuery({ queryKey: ["content-media", contentId], queryFn: () => mediaApi.forContent(contentId) });
  const items = (attached.data ?? []).filter((m) => m.prompt);
  if (items.length === 0) return null;

  return (
    <div style={{ display: "grid", gap: 10, margin: "4px 0 18px" }}>
      {items.map((m) => (
        <div key={m.id} style={{ padding: "12px 14px", borderRadius: 12, border: `1px solid ${p.border}`, background: p.field }}>
          <div style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: p.muted, marginBottom: 6 }}>
            What was asked{m.type === "video" ? " · reel" : " · image"}
          </div>
          <div dir="auto" style={{ whiteSpace: "pre-wrap", maxHeight: 160, overflowY: "auto", fontSize: 14, lineHeight: 1.6, overflowWrap: "anywhere" }}>
            {m.prompt}
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: p.muted }}>
            To change it, write only what should be different. The AI already remembers this request.
          </div>
        </div>
      ))}
    </div>
  );
}