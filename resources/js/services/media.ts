import { api } from "./api";
import type { Paginated } from "./content";

/* Mirrors section 5k of the backend. The `url` of a media item is a signed link that expires after 2 hours:
   never store it, always ask the API again. */

export type MediaItem = {
  id: number;
  client_id: number;
  type: "image" | "video" | "audio";
  source: "upload" | "ai_generated";
  status: "processing" | "ready" | "failed";
  prompt: string | null;
  aspect_ratio: string | null;
  duration_seconds: number | null;
  error: string | null;
  metadata: { step?: string; script?: string; image_prompt?: string; warnings?: string[] } | null;
  url: string | null;
};

export const ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4"] as const;
export const MAX_UPLOAD_MB = 50;

const asList = (r: MediaItem[] | { data: MediaItem[] }): MediaItem[] => (Array.isArray(r) ? r : r?.data ?? []);

export const mediaApi = {
  // the media attached to a content item, in display order
  forContent: async (contentId: number) => asList(await api<MediaItem[] | { data: MediaItem[] }>(`/content/${contentId}/media`)),
  attach: async (contentId: number, mediaId: number) =>
    asList(await api<MediaItem[] | { data: MediaItem[] }>(`/content/${contentId}/media`, { method: "POST", body: { media_id: mediaId } })),
  detach: async (contentId: number, mediaId: number) =>
    asList(await api<MediaItem[] | { data: MediaItem[] }>(`/content/${contentId}/media/${mediaId}`, { method: "DELETE" })),

  list: (params: { client_id?: string; type?: string; page?: number; per_page?: number }) => api<Paginated<MediaItem>>("/media", { params }),
  get: (id: number) => api<MediaItem>(`/media/${id}`),
  upload: (clientId: number, file: File) => {
    const fd = new FormData();
    fd.append("client_id", String(clientId));
    fd.append("file", file);
    return api<MediaItem>("/media", { method: "POST", formData: fd });
  },
  remove: (id: number) => api<unknown>(`/media/${id}`, { method: "DELETE" }),

  // the AI creates an image (about 30 seconds) or a reel (2 to 12 minutes). Only one at a time: a second request gets 429.
  generate: (body: { client_id: number; kind: "image" | "reel"; request: string; aspect_ratio: string; language?: "Arabic" | "English" }) =>
    api<MediaItem>("/media/generate", { method: "POST", body }),
};