import { api } from "./api";

export type Sentiment = "positive" | "neutral" | "negative";
export type FeedbackSource = "survey" | "message" | "complaint";
export const FEEDBACK_SOURCES: FeedbackSource[] = ["survey", "message", "complaint"];

export type Feedback = {
  id: number;
  client_id: number;
  source: FeedbackSource;
  rating: number | null;
  comment: string | null;
  sentiment: Sentiment | null;
  topic: string | null;
  created_at: string;
};

export type SatisfactionSummary = {
  average_rating: number | null;
  count: number;
  by_sentiment: Partial<Record<Sentiment, number>>;
  top_topics: Record<string, number>;
  at_risk: boolean;
};

export type SatisfactionReply = {
  summary: SatisfactionSummary;
  feedback: { data: Feedback[]; current_page: number; last_page: number };
};

export type SatisfactionOverviewRow = {
  client_id: number;
  client_name: string;
  average_rating: number | null;
  count: number;
  by_sentiment: Partial<Record<Sentiment, number>>;
  top_topics: Record<string, number>;
  at_risk: boolean;
};

export const satisfactionApi = {
  get: (clientId: number, page: number) =>
    api<SatisfactionReply>(`/clients/${clientId}/satisfaction`, { params: { per_page: 20, page } }),
  overview: (days = 90) =>
    api<{ days: number; clients: SatisfactionOverviewRow[] }>("/satisfaction/overview", { params: { days } }),
  // the client's own feedback from the portal (saved as a survey)
  sendMine: (body: { rating?: number; comment?: string; topic?: string }) =>
    api<Feedback>("/satisfaction", { method: "POST", body }),
  add: (clientId: number, body: { source: FeedbackSource; rating?: number; comment?: string; topic?: string }) =>
    api<Feedback>(`/clients/${clientId}/satisfaction`, { method: "POST", body }),
  remove: (id: number) => api<{ message: string }>(`/satisfaction/${id}`, { method: "DELETE" }),
};

export const stars = (n: number | null) => (n ? "★".repeat(n) + "☆".repeat(5 - n) : "");