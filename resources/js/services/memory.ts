export type BrandProfile = {
  businessName: string;
  industry: string;
  description: string;
  audience: string;
  goal: string;
  priorities: string;
  brandVoice: string;
  cta: string;
  restrictions: string;
};

export type KnowledgeDoc = {
  doc_id: string;
  name: string;
  chunks?: number;
};

const API = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";
const PROFILE_KEY = "admind_brand_profile";
const jsonHeaders = { "Content-Type": "application/json", Accept: "application/json" };

// Semantic memory: PUT /profile
export async function saveProfile(profile: BrandProfile): Promise<{ savedLocally: boolean }> {
  try {
    const res = await fetch(`${API}/profile`, {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify(profile),
    });
    if (!res.ok) throw new Error(String(res.status));
    return { savedLocally: false };
  } catch {
    // Backend not ready yet: keep the data on this device.
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    return { savedLocally: true };
  }
}

export function loadLocalProfile(): BrandProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as BrandProfile) : null;
  } catch {
    return null;
  }
}

// Knowledge base (Qdrant): POST /knowledge/upload, GET /knowledge, DELETE /knowledge/{doc_id}
export async function uploadKnowledge(file: File): Promise<void> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`${API}/knowledge/upload`, { method: "POST", body });
  if (!res.ok) throw new Error("Upload failed");
}

export async function listKnowledge(): Promise<KnowledgeDoc[]> {
  const res = await fetch(`${API}/knowledge`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("Could not load documents");
  return (await res.json()) as KnowledgeDoc[];
}

export async function deleteKnowledge(docId: string): Promise<void> {
  const res = await fetch(`${API}/knowledge/${encodeURIComponent(docId)}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Delete failed");
}