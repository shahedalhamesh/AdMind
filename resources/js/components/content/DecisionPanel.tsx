import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { approvalsApi } from "../../services/content";
import type { Approval, Decision } from "../../services/content";
import { Btn, Card, Field, Notice, TextArea, errorText, fieldError } from "../Ui";
import { useRefreshContent } from "./PublishJobCard";

const CHOICES: { id: Decision; label: string; variant: "primary" | "ghost" | "danger"; needsComment: boolean; help: string }[] = [
  { id: "approved", label: "Approve and send to the client", variant: "primary", needsComment: false, help: "The client will be asked to review it next." },
  { id: "changes_requested", label: "Ask for changes", variant: "ghost", needsComment: true, help: "The content goes back to the team with your notes." },
  { id: "rejected", label: "Reject", variant: "danger", needsComment: true, help: "The content goes back to a draft." },
];

// Stage 1: the internal review. `comment` is required unless you approve.
export default function DecisionPanel({ approval }: { approval: Approval }) {
  const refresh = useRefreshContent();
  const [choice, setChoice] = useState<Decision | null>(null);
  const [comment, setComment] = useState("");

  const decide = useMutation({
    mutationFn: () => approvalsApi.decide(approval.id, { decision: choice as Decision, comment: comment.trim() || undefined }),
    onSuccess: refresh,
  });

  const current = CHOICES.find((c) => c.id === choice);
  const ready = !!current && (!current.needsComment || comment.trim().length > 0);

  if (decide.isSuccess) {
    return (
      <Card>
        <Notice kind="success">
          {decide.data.stage === "internal" && choice === "approved"
            ? "Approved. The content was sent to the client."
            : "Your decision was saved."}
        </Notice>
      </Card>
    );
  }

  return (
    <Card>
      <h3 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 500 }}>Your review</h3>
      <p style={{ margin: "6px 0 14px", fontSize: 13, opacity: 0.75, lineHeight: 1.5 }}>The team is waiting for your decision on this content.</p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {CHOICES.map((c) => (
          <Btn key={c.id} small variant={choice === c.id ? c.variant : "ghost"} onClick={() => { setChoice(c.id); decide.reset(); }}>
            {c.label}
          </Btn>
        ))}
      </div>

      {current && (
        <form onSubmit={(e) => { e.preventDefault(); decide.mutate(); }} style={{ display: "grid", gap: 12, marginTop: 16 }}>
          <span style={{ fontSize: 13, opacity: 0.75 }}>{current.help}</span>
          <Field label={current.needsComment ? "Your notes *" : "Comment (optional)"} error={fieldError(decide.error, "comment")}>
            <TextArea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} dir="auto" autoFocus />
          </Field>
          {decide.isError && <Notice kind="error">{errorText(decide.error)}</Notice>}
          <div>
            <Btn variant={current.variant === "ghost" ? "primary" : current.variant} type="submit" disabled={decide.isPending || !ready}>
              {decide.isPending ? "Saving…" : `Confirm: ${current.label.toLowerCase()}`}
            </Btn>
          </div>
        </form>
      )}
    </Card>
  );
}