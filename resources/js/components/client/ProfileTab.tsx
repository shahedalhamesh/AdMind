import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../AuthContext";
import { can } from "../../services/auth";
import { asStrings, clientsApi } from "../../services/clients";
import type { Client, ProfileProposal } from "../../services/clients";
import { Btn, Card, Field, Loading, Notice, TagInput, TextArea, TextInput, errorText, fieldError } from "../Ui";

// Brand profile: PUT /clients/{id}/profile needs `tone` and `target_audience`; the rest is optional.
export default function ProfileTab({ client }: { client: Client }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const canEdit = can(user, "clients.update");

  const query = useQuery({ queryKey: ["client-profile", client.id], queryFn: () => clientsApi.profile(client.id) });

  const [tone, setTone] = useState("");
  const [audience, setAudience] = useState("");
  const [style, setStyle] = useState("");
  const [guidelines, setGuidelines] = useState("");
  const [colors, setColors] = useState<string[]>([]);
  const [fonts, setFonts] = useState<string[]>([]);
  const [forbidden, setForbidden] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);

  // fill the form when the saved profile arrives
  useEffect(() => {
    const pr = query.data?.profile;
    if (!pr) return;
    setTone(pr.tone ?? "");
    setAudience(pr.target_audience ?? "");
    setStyle(pr.content_style ?? "");
    setGuidelines(pr.guidelines ?? "");
    setColors(asStrings(pr.colors));
    setFonts(asStrings(pr.fonts));
    setForbidden(asStrings(pr.forbidden_words));
    setPlatforms(asStrings(pr.platforms));
  }, [query.data]);

  /* ---- extract from a pasted brief (proposes only, nothing is saved) ---- */
  const [brief, setBrief] = useState("");
  const [proposal, setProposal] = useState<ProfileProposal["proposed"] | null>(null);

  const extract = useMutation({
    mutationFn: () => clientsApi.extract(brief),
    onSuccess: (res) => {
      const pr = res.proposed;
      setProposal(pr);
      if (pr.tone) setTone(pr.tone);
      if (pr.target_audience) setAudience(pr.target_audience);
      if (pr.platforms.length) setPlatforms(pr.platforms);
      if (pr.forbidden_words.length) setForbidden(pr.forbidden_words);
    },
  });

  // the proposal also suggests an industry: that belongs to the client, so it is applied only on request
  const applyIndustry = useMutation({
    mutationFn: (industry: string) => clientsApi.update(client.id, { industry }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client", client.id] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
  });

  /* ---- save ---- */
  const save = useMutation({
    mutationFn: () =>
      clientsApi.saveProfile(client.id, {
        tone: tone.trim(),
        target_audience: audience.trim(),
        content_style: style.trim() || null,
        guidelines: guidelines.trim() || null,
        colors,
        fonts,
        forbidden_words: forbidden,
        platforms,
      }),
    onSuccess: () => {
      setProposal(null);
      qc.invalidateQueries({ queryKey: ["client-profile", client.id] });
    },
  });

  if (query.isLoading) return <Loading />;
  if (query.isError) return <Notice kind="error">{errorText(query.error)}</Notice>;

  const hasProfile = !!query.data?.profile;
  const err = save.error;

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {!hasProfile && (
        <Notice>
          This client has no brand profile yet. The AI writes in the client&apos;s voice, so fill in at least the tone and the audience.
        </Notice>
      )}

      {canEdit && (
        <Card>
          <h3 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 500 }}>Fill it from a brief</h3>
          <p style={{ margin: "6px 0 14px", fontSize: 13, opacity: 0.75, lineHeight: 1.5 }}>
            Paste an email or notes from the client. The AI suggests the fields below. Nothing is saved until you press Save.
          </p>
          <TextArea
            aria-label="Client brief"
            placeholder="Paste the client's brief here (at least 10 characters)"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            style={{ minHeight: 120 }}
          />
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <Btn variant="primary" small onClick={() => extract.mutate()} disabled={extract.isPending || brief.trim().length < 10}>
              {extract.isPending ? "Reading the brief… (a few seconds)" : "Suggest fields"}
            </Btn>
            {extract.isError && <span style={{ fontSize: 13 }}><Notice kind="error">{errorText(extract.error)}</Notice></span>}
          </div>
          {proposal && (
            <div style={{ marginTop: 14 }}>
              <Notice kind="success">The fields below were filled from your brief. Review them, then press Save.</Notice>
              {proposal.industry && proposal.industry !== client.industry && (
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 13 }}>
                  <span>Suggested industry: <strong>{proposal.industry}</strong></span>
                  <Btn small onClick={() => applyIndustry.mutate(proposal.industry as string)} disabled={applyIndustry.isPending}>
                    {applyIndustry.isPending ? "Applying…" : "Use as industry"}
                  </Btn>
                  {applyIndustry.isSuccess && <span>Applied.</span>}
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      <Card>
        <form
          onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
          style={{ display: "grid", gap: 14 }}
        >
          <Field label="Tone *" error={fieldError(err, "tone")}>
            <TextInput value={tone} onChange={(e) => setTone(e.target.value)} maxLength={255} disabled={!canEdit} required />
          </Field>
          <Field label="Target audience *" error={fieldError(err, "target_audience")}>
            <TextArea value={audience} onChange={(e) => setAudience(e.target.value)} disabled={!canEdit} required />
          </Field>
          <Field label="Content style" error={fieldError(err, "content_style")}>
            <TextArea value={style} onChange={(e) => setStyle(e.target.value)} disabled={!canEdit} />
          </Field>
          <Field label="Guidelines" error={fieldError(err, "guidelines")}>
            <TextArea value={guidelines} onChange={(e) => setGuidelines(e.target.value)} disabled={!canEdit} />
          </Field>
          <Field label="Platforms" error={fieldError(err, "platforms")} hint={canEdit ? "Press Enter after each one." : undefined}>
            <TagInput value={platforms} onChange={setPlatforms} placeholder="For example: instagram" disabled={!canEdit} />
          </Field>
          <Field label="Forbidden words" error={fieldError(err, "forbidden_words")} hint={canEdit ? "Words the AI must never use." : undefined}>
            <TagInput value={forbidden} onChange={setForbidden} placeholder="Type a word and press Enter" disabled={!canEdit} />
          </Field>
          <Field label="Colors" error={fieldError(err, "colors")} hint={canEdit ? "For example #A64B35" : undefined}>
            <TagInput value={colors} onChange={setColors} placeholder="Type a color and press Enter" disabled={!canEdit} />
          </Field>
          <Field label="Fonts" error={fieldError(err, "fonts")}>
            <TagInput value={fonts} onChange={setFonts} placeholder="Type a font and press Enter" disabled={!canEdit} />
          </Field>

          {err && <Notice kind="error">{errorText(err)}</Notice>}
          {save.isSuccess && save.data.ai_synced && <Notice kind="success">Saved. The AI now knows this profile.</Notice>}
          {save.isSuccess && !save.data.ai_synced && (
            <Notice kind="warning">
              Saved here, but the AI memory could not be updated{save.data.ai_error ? `: ${save.data.ai_error}` : "."} Try saving again later.
            </Notice>
          )}

          {canEdit && (
            <div>
              <Btn variant="primary" type="submit" disabled={save.isPending || !tone.trim() || !audience.trim()}>
                {save.isPending ? "Saving…" : "Save profile"}
              </Btn>
            </div>
          )}
        </form>
      </Card>
    </div>
  );
}