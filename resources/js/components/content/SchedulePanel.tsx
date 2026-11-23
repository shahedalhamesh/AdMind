import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { clientsApi } from "../../services/clients";
import { contentApi, localToIso, publishApi } from "../../services/content";
import type { ContentItem } from "../../services/content";
import { Btn, Card, Field, Notice, Select, TextInput, errorText, fieldError } from "../Ui";
import { useRefreshContent } from "./PublishJobCard";

// Approved content: post it now, or choose a time in the future.
// The account is the client's account on the content's platform; the first one is used unless you pick another.
export default function SchedulePanel({ item }: { item: ContentItem }) {
  const refresh = useRefreshContent();
  const [when, setWhen] = useState("");
  const [accountId, setAccountId] = useState("");

  const accounts = useQuery({ queryKey: ["client-social", item.client_id], queryFn: () => clientsApi.accounts(item.client_id) });
  const matching = (accounts.data ?? []).filter((a) => a.platform === item.platform);
  const account = accountId ? { social_account_id: Number(accountId) } : {};

  const schedule = useMutation({
    mutationFn: () => contentApi.schedule(item.id, { scheduled_at: localToIso(when), ...account }),
    onSuccess: refresh,
  });

  // "Post now": the backend only schedules in the future, so schedule 2 minutes ahead and publish that job right away.
  const postNow = useMutation({
    mutationFn: async () => {
      const job = await contentApi.schedule(item.id, { scheduled_at: new Date(Date.now() + 2 * 60000).toISOString(), ...account });
      await publishApi.publishNow(job.id);
      return job;
    },
    onSettled: () => { refresh(); setTimeout(refresh, 5000); setTimeout(refresh, 15000); },
  });

  const busy = schedule.isPending || postNow.isPending;
  const noAccount = accounts.isSuccess && matching.length === 0;
  const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  return (
    <Card>
      <h3 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 500 }}>Publish the post</h3>
      <p style={{ margin: "6px 0 14px", fontSize: 13, opacity: 0.75, lineHeight: 1.5 }}>
        Post it now, or choose when it should be posted.
      </p>

      {noAccount ? (
        <Notice kind="warning">
          This client has no {item.platform} account yet.{" "}
          <Link to={`/clients/${item.client_id}`} style={{ fontWeight: 600 }}>Add one on the client page</Link> (Social accounts), then come back.
        </Notice>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); schedule.mutate(); }} style={{ display: "grid", gap: 12 }}>
          {matching.length > 1 && (
            <Field label="Account" error={fieldError(schedule.error, "social_account_id")}>
              <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">First {item.platform} account</option>
                {matching.map((a) => <option key={a.id} value={a.id}>{a.account_name}</option>)}
              </Select>
            </Field>
          )}

          <div>
            <Btn variant="primary" type="button" onClick={() => postNow.mutate()} disabled={busy || accounts.isLoading}>
              {postNow.isPending ? "Sending…" : "Post now"}
            </Btn>
          </div>
          {postNow.isError && (
            <Notice kind="error">
              {errorText(postNow.error)} If it was scheduled anyway, you can post it by hand and mark it as published.
            </Notice>
          )}

          <Field label="Or choose a date and time" error={fieldError(schedule.error, "scheduled_at")}>
           <TextInput type="datetime-local" lang="en-US" min={now} value={when} onChange={(e) => setWhen(e.target.value)} />
          </Field>
          {schedule.isError && <Notice kind="error">{errorText(schedule.error)}</Notice>}
          <div>
            <Btn type="submit" disabled={busy || !when || accounts.isLoading}>
              {schedule.isPending ? "Scheduling…" : "Schedule"}
            </Btn>
          </div>
        </form>
      )}
    </Card>
  );
}