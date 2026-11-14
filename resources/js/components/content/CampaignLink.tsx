import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { campaignsApi } from "../../services/campaigns";
import { contentApi } from "../../services/content";
import { Btn, Card, Notice, Select, errorText } from "../Ui";

type Props = { item: { id: number; client_id: number; campaign_id?: number | null } };

export default function CampaignLink({ item }: Props) {
  const qc = useQueryClient();
  const [value, setValue] = useState(item.campaign_id ? String(item.campaign_id) : "");

  const campaigns = useQuery({
    queryKey: ["campaigns", { forClient: item.client_id }],
    queryFn: () => campaignsApi.list({ client_id: String(item.client_id), per_page: 100 }),
  });

  const save = useMutation({
    mutationFn: () => contentApi.update(item.id, { campaign_id: value ? Number(value) : null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content"] });
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      qc.invalidateQueries({ queryKey: ["campaign"] });
    },
  });

  const list = campaigns.data?.data ?? [];
  const changed = value !== (item.campaign_id ? String(item.campaign_id) : "");

  return (
    <Card>
      <h3 style={{ margin: "0 0 12px", fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 500 }}>Campaign</h3>
      <div style={{ display: "grid", gap: 12 }}>
        <Select aria-label="Campaign" value={value} onChange={(e) => setValue(e.target.value)} disabled={campaigns.isLoading}>
          <option value="">No campaign</option>
          {list.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        {campaigns.isSuccess && list.length === 0 && <span style={{ fontSize: 13, opacity: 0.7 }}>This client has no campaigns yet.</span>}
        {save.isError && <Notice kind="error">{errorText(save.error)}</Notice>}
        {save.isSuccess && !changed && <Notice kind="success">Saved.</Notice>}
        <div><Btn variant="primary" onClick={() => save.mutate()} disabled={!changed || save.isPending}>{save.isPending ? "Saving…" : "Save"}</Btn></div>
      </div>
    </Card>
  );
}