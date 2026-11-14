import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { clientsApi } from "../../services/clients";
import { contentApi, localToIso } from "../../services/content";
import type { ContentItem } from "../../services/content";
import { Btn, Card, Field, Notice, Select, TextInput, errorText, fieldError } from "../Ui";
import { useRefreshContent } from "./PublishJobCard";

// Approved content gets a posting time (it must be in the future).
// The account is the client's account on the content's platform; the first one is used unless you pick another.
export default function SchedulePanel({ item }: { item: ContentItem }) {
  const refresh = useRefreshContent();
  const [when, setWhen] = useState("");
  const [accountId, setAccountId] = useState("");

  const accounts = useQuery({ queryKey: ["client-social", item.client_id], queryFn: () => clientsApi.accounts(item.client_id) });
  const matching = (accounts.data ?? []).filter((a) => a.platform === item.platform);

  const schedule = useMutation({
    mutationFn: () =>
      contentApi.schedule(item.id, {
        scheduled_at: localToIso(when),
        ...(accountId ? { social_account_id: Number(accountId) } : {}),
      }),
    onSuccess: refresh,
  });

  const noAccount = accounts.isSuccess && matching.length === 0;
  const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  return (
    <Card>
      <h3 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 500 }}>Schedule the post</h3>
      <p style={{ margin: "6px 0 14px", fontSize: 13, opacity: 0.75, lineHeight: 1.5 }}>
        Choose when it should be posted. At that time the team posts it, then marks it as published.
      </p>

      {noAccount ? (
        <Notice kind="warning">
          This client has no {item.platform} account yet.{" "}
          <Link to={`/clients/${item.client_id}`} style={{ fontWeight: 600 }}>Add one on the client page</Link> (Social accounts), then come back.
        </Notice>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); schedule.mutate(); }} style={{ display: "grid", gap: 12 }}>
          <Field label="Date and time *" error={fieldError(schedule.error, "scheduled_at")}>
            <TextInput type="datetime-local" min={now} value={when} onChange={(e) => setWhen(e.target.value)} required />
          </Field>
          {matching.length > 1 && (
            <Field label="Account" error={fieldError(schedule.error, "social_account_id")}>
              <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">First {item.platform} account</option>
                {matching.map((a) => <option key={a.id} value={a.id}>{a.account_name}</option>)}
              </Select>
            </Field>
          )}
          {schedule.isError && <Notice kind="error">{errorText(schedule.error)}</Notice>}
          <div>
            <Btn variant="primary" type="submit" disabled={schedule.isPending || !when || accounts.isLoading}>
              {schedule.isPending ? "Scheduling…" : "Schedule"}
            </Btn>
          </div>
        </form>
      )}
    </Card>
  );
}