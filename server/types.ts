export type DocumentCategory =
  | "Identity"
  | "Insurance"
  | "Banking"
  | "Employment"
  | "Housing"
  | "Medical"
  | "Warranty"
  | "Tax"
  | "Education"
  | "Loan"
  | "Subscriptions"
  | "General";

export type ReminderStatus = "open" | "done";

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

export interface DocumentChunk {
  id: string;
  documentId: string;
  ordinal: number;
  text: string;
  tokenCount: number;
}

export interface VaultDocument {
  id: string;
  ownerId: string;
  title: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  category: DocumentCategory;
  tags: string[];
  summary: string;
  extractedText: string;
  dates: ExtractedDate[];
  amounts: ExtractedAmount[];
  chunks: DocumentChunk[];
}

export interface Reminder {
  id: string;
  ownerId: string;
  documentId: string;
  documentTitle: string;
  title: string;
  dueDate: string;
  sourceText: string;
  category: string;
  status: ReminderStatus;
  createdAt: string;
}

export interface QueryCitation {
  documentId: string;
  documentTitle: string;
  category: DocumentCategory;
  chunkId: string;
  snippet: string;
  score: number;
}

export interface QueryResponse {
  answer: string;
  mode: "llm" | "extractive";
  citations: QueryCitation[];
  suggestedActions: string[];
}

export interface VaultStore {
  documents: VaultDocument[];
  reminders: Reminder[];
}
