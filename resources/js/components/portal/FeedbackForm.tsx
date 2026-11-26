import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { usePortalTheme } from "../../services/portalTheme";
import { satisfactionApi } from "../../services/satisfaction";
import { Btn, Field, Notice, Select, TextArea, errorText, fieldError } from "../Ui";

// "How are we doing?": the client rates the agency from the portal.
export default function FeedbackForm() {
  const { p } = usePortalTheme();
  const [rating, setRating] = useState(0);
  const [topic, setTopic] = useState("");
  const [comment, setComment] = useState("");

  const send = useMutation({
    mutationFn: () =>
      satisfactionApi.sendMine({
        ...(rating ? { rating } : {}),
        ...(comment.trim() ? { comment: comment.trim() } : {}),
        ...(topic ? { topic } : {}),
      }),
    onSuccess: () => { setRating(0); setTopic(""); setComment(""); },
  });

  const ok = rating > 0 || !!comment.trim();

  if (send.isSuccess) {
    return (
      <div style={{ display: "grid", gap: 14 }}>
        <Notice kind="success">Thank you! Your agency got your feedback.</Notice>
        <div><Btn onClick={() => send.reset()}>Send another</Btn></div>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); send.mutate(); }}
      style={{ display: "grid", gap: 16, padding: 22, borderRadius: 16, border: `1px solid ${p.border}`, background: p.card }}>
      <div>
        <h2 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 500 }}>How are we doing?</h2>
        <p style={{ margin: "6px 0 0", fontSize: 14, color: p.muted, lineHeight: 1.6 }}>Tell your agency what you think. It helps them serve you better.</p>
      </div>

      <div>
        <div style={{ display: "flex", gap: 6 }} role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} out of 5`}
              onClick={() => setRating(rating === n ? 0 : n)}
              style={{ border: 0, background: "transparent", cursor: "pointer", fontSize: 34, lineHeight: 1, padding: 2, color: n <= rating ? "#E8A33D" : p.muted, opacity: n <= rating ? 1 : 0.5 }}>
              {n <= rating ? "★" : "☆"}
            </button>
          ))}
        </div>
        {fieldError(send.error, "rating") && <div style={{ fontSize: 12, color: "#E5484D", marginTop: 4 }}>{fieldError(send.error, "rating")}</div>}
      </div>

      <div style={{ width: 240 }}>
        <Field label="About (optional)" error={fieldError(send.error, "topic")}>
          <Select value={topic} onChange={(e) => setTopic(e.target.value)}>
            <option value="">Anything</option>
            <option value="content">The content</option>
            <option value="timing">Timing</option>
            <option value="communication">Communication</option>
            <option value="results">Results</option>
          </Select>
        </Field>
      </div>

      <Field label="Your comment" error={fieldError(send.error, "comment")}>
        <TextArea value={comment} onChange={(e) => setComment(e.target.value)} dir="auto" maxLength={2000} />
      </Field>

      {send.isError && <Notice kind="error">{errorText(send.error)}</Notice>}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Btn variant="primary" type="submit" disabled={send.isPending || !ok}>{send.isPending ? "Sending…" : "Send"}</Btn>
        {!ok && <span style={{ fontSize: 12, color: p.muted }}>Choose stars or write a comment.</span>}
      </div>
    </form>
  );
}