import { ApiError } from "../../services/api";
import type { MediaItem } from "../../services/media";
import { Notice, Select, errorText } from "../Ui";

export type Voice = "none" | "male" | "female";

// The AI makes a voiceover only when the request says "male voice" or "female voice".
export function withVoice(request: string, voice: Voice): string {
  if (voice === "none") return request;
  const clean = request.replace(/\b(fe)?male voice\b/gi, "").trim();
  return `${voice} voice. ${clean}`.slice(0, 2000);
}

export function VoiceSelect({ value, onChange, noneLabel, disabled }: { value: Voice; onChange: (v: Voice) => void; noneLabel: string; disabled?: boolean }) {
  return (
    <Select aria-label="Voiceover" value={value} onChange={(e) => onChange(e.target.value as Voice)} disabled={disabled}>
      <option value="none">{noneLabel}</option>
      <option value="male">Male voice</option>
      <option value="female">Female voice</option>
    </Select>
  );
}

// A failed file: add a hint when the free daily GPU quota ran out.
export function mediaHint(text: string): string {
  return /zerogpu|quota/i.test(text) ? `${text} The free daily AI quota may have run out. Try again tomorrow.` : text;
}

// An error while asking for a file: 429 means the AI is already making another one.
export function mediaErrorText(err: unknown): string {
  if (err instanceof ApiError && err.status === 429) return "The AI is busy making another file. Try again in a few minutes.";
  return mediaHint(errorText(err));
}

// Small notes from the AI about a finished file (for example: the music is switched off).
export function MediaWarnings({ m }: { m: Pick<MediaItem, "metadata"> | null | undefined }) {
  const list = m?.metadata?.warnings ?? [];
  if (list.length === 0) return null;
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {list.map((w, i) => <Notice key={i} kind="warning">{w}</Notice>)}
    </div>
  );
}