import { usePortalTheme } from "../../services/portalTheme";
import type { AgentEvent, AgentRun } from "../../services/agent";
import AiOrb from "./AiOrb";

// A friendly sentence for one step.
function describe(e: AgentEvent): string {
  const tool = (e.detail || "").replace(/_/g, " ");
  switch (e.label) {
    case "Agent Started": return `${e.agent} started`;
    case "Tool Execution Started":
      return e.detail === "delegate_work_to_coworker" ? `${e.agent} handed the work to another agent` : `${e.agent} is using a tool${tool ? ` (${tool})` : ""}`;
    case "Tool Execution Completed":
      return e.detail === "delegate_work_to_coworker" ? "The other agent finished" : "A step finished";
    case "Agent Final Answer": return `${e.agent} wrote the answer`;
    case "Retrying": return "The AI model was busy. Trying again…";
    case "Checking the answer": return "Checking the answer (fact-check)";
    default: return e.detail ? `${e.label}: ${e.detail}` : e.label;
  }
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// "Who is doing what" while the AI works on a text request. Only a nice-to-have: the answer does not depend on it.
export default function AgentTimeline({ run }: { run: Pick<AgentRun, "current_agent" | "elapsed_seconds" | "events"> | null | undefined }) {
  const { p } = usePortalTheme();
  const events = (run?.events ?? []).slice(-6);
  const secs = run?.elapsed_seconds ?? null;
  const who = run?.current_agent;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: 14, color: p.aiText }}>
        <AiOrb />
        <span>{who ? `${who} is working on it…` : "The AI is working on it. This usually takes between 15 seconds and 2 minutes…"}</span>
        {secs !== null && <span style={{ color: p.muted, fontVariantNumeric: "tabular-nums" }}>{mmss(secs)}</span>}
      </div>

      {events.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 4, fontSize: 13, paddingInlineStart: 8 }}>
          {events.map((e, i) => {
            const last = i === events.length - 1;
            return (
              <li key={e.n} style={{ display: "flex", gap: 8, color: last ? p.aiText : p.muted }}>
                <span aria-hidden>{last ? "›" : "✓"}</span>
                <span>{describe(e)}</span>
              </li>
            );
          })}
        </ul>
      )}

      {secs !== null && secs > 120 && (
        <span style={{ fontSize: 12, color: p.muted }}>This is taking longer than usual. The AI model may be busy. You can stay on this page.</span>
      )}
    </div>
  );
}