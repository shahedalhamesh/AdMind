// Sample data shaped like the planned API. Replace each part with real calls later.

export type ApprovalItem = { id: number; client: string; title: string; meta: string; status: "in_review" | "changes_requested" };
export type RunItem = { id: number; client: string; message: string; status: "running" | "succeeded"; when: string };

export const mockStats = { awaiting: 3, contentThisMonth: 24, published: 9, aiRequests: 31, aiCompleted: 28 };

export const mockApprovals: ApprovalItem[] = [
  { id: 1, client: "Maison Cocoa", title: "Winter gift box: carousel caption", meta: "Instagram post · sent 2h ago", status: "in_review" },
  { id: 2, client: "Nova Fitness", title: "January challenge: reel script", meta: "TikTok reel · sent yesterday", status: "in_review" },
  { id: 3, client: "Zayt Cafe", title: "New menu announcement", meta: "Instagram story · sent 2 days ago", status: "changes_requested" },
];

export const mockRuns: RunItem[] = [
  { id: 1, client: "Bayt Real Estate", message: "Property launch announcement, 3 captions", status: "running", when: "just now" },
  { id: 2, client: "Maison Cocoa", message: "Three captions for winter gift boxes", status: "succeeded", when: "12 min ago" },
  { id: 3, client: "Nova Fitness", message: "Reel script: 30-day challenge", status: "succeeded", when: "1 hour ago" },
];