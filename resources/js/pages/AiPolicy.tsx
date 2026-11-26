import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePortalTheme } from "../services/portalTheme";
import { clientsApi } from "../services/clients";
import type { Client } from "../services/clients";
import { AI_LEVELS, AI_LEVEL_HELP, AI_LEVEL_LABEL, aiPolicyApi, autoPublishOf } from "../services/aiPolicy";
import type { AiLevel, AiPolicy } from "../services/aiPolicy";
import { Badge, Btn, Loading, Notice, Select, errorText } from "../components/Ui";

export default function AiPolicyPage() {
  const { p } = usePortalTheme();
  const policies = useQuery({ queryKey: ["ai-policies"], queryFn: aiPolicyApi.list });
  const clients = useQuery({ queryKey: ["clients", { q: "", status: "" }], queryFn: () => clientsApi.list({}) });

  const overrides = new Map<number, AiPolicy>();
  (policies.data?.clients ?? []).forEach((o) => { if (o.client_id) overrides.set(o.client_id, o); });
  const defaultPolicy = policies.data?.default ?? null;
  const defaultLevel: AiLevel = defaultPolicy?.autonomy_level ?? "assisted";

  return (
    <div>
      <p style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: p.eyeb }}>Settings</p>
      <h1 style={{ margin: "10px 0 6px", fontFamily: "Georgia, serif", fontSize: 38, fontWeight: 500 }}>AI policy</h1>
      <p style={{ margin: "0 0 24px", color: p.muted, fontSize: 15, maxWidth: 640, lineHeight: 1.6 }}>
        Decide how much the AI may do. Set one rule for the whole company, then change it for a single client if you need to.
      </p>

      {(policies.isLoading || clients.isLoading) && <Loading />}
      {policies.isError && <Notice kind="error">{errorText(policies.error)}</Notice>}

      {policies.isSuccess && (
        <div style={{ display: "grid", gap: 22 }}>
          <section style={{ padding: 20, borderRadius: 16, border: `1px solid ${p.border}`, background: p.card }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Company default</h2>
            <p style={{ margin: "0 0 14px", color: p.muted, fontSize: 13 }}>Used for every client that has no rule of its own.</p>
            <PolicyForm
              key={`d-${defaultPolicy?.id ?? "none"}-${defaultLevel}`}
              clientId={null}
              existing={defaultPolicy}
              allowDefault={false}
            />
          </section>

          <section>
            <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>Clients</h2>
            {clients.isError && <Notice kind="error">{errorText(clients.error)}</Notice>}
            <div style={{ display: "grid", gap: 12 }}>
              {(clients.data ?? []).map((c: Client) => (
                <div key={c.id} style={{ padding: 16, borderRadius: 14, border: `1px solid ${p.border}`, background: p.card }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 15 }}>{c.name}</strong>
                    {overrides.has(c.id)
                      ? <Badge>{`Own rule: ${AI_LEVEL_LABEL[overrides.get(c.id)!.autonomy_level]}`}</Badge>
                      : <Badge>{`Company default: ${AI_LEVEL_LABEL[defaultLevel]}`}</Badge>}
                  </div>
                  <PolicyForm
                    key={`c-${c.id}-${overrides.get(c.id)?.id ?? "none"}-${overrides.get(c.id)?.autonomy_level ?? ""}`}
                    clientId={c.id}
                    existing={overrides.get(c.id) ?? null}
                    allowDefault
                  />
                </div>
              ))}
              {clients.isSuccess && (clients.data ?? []).length === 0 && (
                <div style={{ padding: 24, borderRadius: 14, border: `1px dashed ${p.border}`, color: p.muted }}>No clients yet.</div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function PolicyForm({ clientId, existing, allowDefault }: { clientId: number | null; existing: AiPolicy | null; allowDefault: boolean }) {
  const { p } = usePortalTheme();
  const qc = useQueryClient();
  const [level, setLevel] = useState<AiLevel | "default">(existing?.autonomy_level ?? (allowDefault ? "default" : "assisted"));
  const [autoPublish, setAutoPublish] = useState(autoPublishOf(existing));
  const [saved, setSaved] = useState(false);

  const done = () => {
    qc.invalidateQueries({ queryKey: ["ai-policies"] });
    qc.invalidateQueries({ queryKey: ["ai-effective"] });
    setSaved(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      setSaved(false);
      // "Use the company default" = remove this client's own rule
      if (level === "default") {
        if (existing) await aiPolicyApi.remove(existing.id);
        return;
      }
      await aiPolicyApi.save({
        client_id: clientId,
        autonomy_level: level,
        max_spend: existing?.max_spend ?? null,
        approval_rules: existing?.approval_rules ?? null,
        escalate_to_user_id: existing?.escalate_to_user_id ?? null,
        // keep the other publish rules, change only auto_publish
        publish_rules: { ...(existing?.publish_rules ?? {}), auto_publish: level === "autonomous" ? autoPublish : false },
      });
    },
    onSuccess: done,
  });

  const shownLevel: AiLevel | null = level === "default" ? null : level;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ width: 260 }}>
          <Select aria-label="AI level" value={level} onChange={(e) => { setLevel(e.target.value as AiLevel | "default"); setSaved(false); }}>
            {allowDefault && <option value="default">Use the company default</option>}
            {AI_LEVELS.map((l) => <option key={l} value={l}>{AI_LEVEL_LABEL[l]}</option>)}
          </Select>
        </div>
        <Btn variant="primary" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Btn>
        {saved && <span style={{ fontSize: 13, color: p.muted }}>Saved.</span>}
      </div>

      {shownLevel && <span style={{ fontSize: 13, color: p.muted, lineHeight: 1.5 }}>{AI_LEVEL_HELP[shownLevel]}</span>}

      {level === "autonomous" && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
          <input type="checkbox" checked={autoPublish} onChange={(e) => { setAutoPublish(e.target.checked); setSaved(false); }} />
          Publish by itself 2 minutes after the client approves
        </label>
      )}

      {save.isError && <Notice kind="error">{errorText(save.error)}</Notice>}
    </div>
  );
}