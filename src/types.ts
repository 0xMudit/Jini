export type DocumentCategory =
  | "Identity" | "Insurance" | "Banking" | "Employment" | "Housing"
  | "Medical" | "Warranty" | "Tax" | "Education" | "Loan" | "Subscriptions" | "General";

export type View = "home" | "assistant" | "library" | "timeline" | "settings";
export type BusyState = "auth" | "refresh" | "upload" | "query" | "seed" | "settings" | null;

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "hr" | "guest" | "member";
}

export interface ExtractedDate {
  id: string;
  label: string;
  isoDate: string;
  sourceText: string;
  confidence: number;
}

export interface ExtractedAmount {
  id: string;
  amount: number;
  currency: "INR" | "UNKNOWN";
  sourceText: string;
}

export interface VaultDocument {
  id: string;
  title: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  category: DocumentCategory;
  tags: string[];
  summary: string;
  dates: ExtractedDate[];
  amounts: ExtractedAmount[];
}

export interface Reminder {
  id: string;
  documentId: string;
  documentTitle: string;
  title: string;
  dueDate: string;
  sourceText: string;
  category: string;
  status: "open" | "done";
  createdAt: string;
}

export interface SearchResult {
  documentId: string;
  documentTitle: string;
  category: DocumentCategory;
  snippet: string;
  score: number;
}

export interface QueryResponse {
  answer: string;
  mode: "llm" | "extractive";
  citations: Array<{
    documentId: string;
    documentTitle: string;
    category: DocumentCategory;
    chunkId: string;
    snippet: string;
    score: number;
  }>;
  suggestedActions: string[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode?: QueryResponse["mode"];
  citations?: QueryResponse["citations"];
  suggestedActions?: string[];
}

export interface Insights {
  totals: {
    documents: number;
    chunks: number;
    reminders: number;
    extractedAmounts: number;
  };
  categoryCounts: Record<string, number>;
  highValuePayments: Array<{
    documentId: string;
    documentTitle: string;
    amount: number;
    amountLabel: string;
    sourceText: string;
  }>;
  subscriptions: Array<{
    documentId: string;
    documentTitle: string;
    amount: number;
    amountLabel: string;
    sourceText: string;
  }>;
  upcomingDates: Array<{
    documentId: string;
    documentTitle: string;
    label: string;
    isoDate: string;
    sourceText: string;
  }>;
  taxChecklist: Array<{
    label: string;
    present: boolean;
  }>;
}

export interface Health {
  ok: boolean;
  service: string;
  groq: boolean;
}

export interface AISettings {
  configured: boolean;
  model: string;
  source: "session" | "environment" | "none";
  provider: string;
}

export interface Notice {
  tone: "success" | "error" | "neutral";
  message: string;
}

export const categories: Array<DocumentCategory | "All"> = [
  "All", "Identity", "Insurance", "Banking", "Employment", "Housing",
  "Medical", "Warranty", "Tax", "Education", "Loan", "Subscriptions", "General",
];

export const navItems: Array<{ id: View; label: string }> = [
  { id: "home", label: "Home" },
  { id: "assistant", label: "Ask Jini" },
  { id: "library", label: "Library" },
  { id: "timeline", label: "Timeline" },
];

export const starterQuestions = [
  "When does my bike insurance expire?",
  "What is my laptop warranty period?",
  "Summarize my rent agreement.",
  "Show payments above INR 5,000.",
  "Which subscriptions am I paying for?",
  "What is missing for tax filing?",
];

export const viewCopy: Record<View, { eyebrow: string; title: string }> = {
  home: { eyebrow: "Private document intelligence", title: "" },
  assistant: { eyebrow: "Grounded answers with citations", title: "Ask Jini" },
  library: { eyebrow: "Your searchable document system", title: "Library" },
  timeline: { eyebrow: "Renewals, deadlines, and important dates", title: "Timeline" },
  settings: { eyebrow: "Connections and privacy", title: "Settings" },
};
