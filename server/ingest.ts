import { nanoid } from "nanoid";
import type { Reminder, VaultDocument } from "./types";
import { extractAmounts, extractDates, inferCategory, inferTags, splitIntoChunks, summarizeText } from "./textUtils";

interface IngestInput {
  ownerId: string;
  title: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  text: string;
  uploadedAt?: string;
}

export function createDocumentFromText(input: IngestInput) {
  const id = nanoid();
  const extractedText = input.text.trim();
  const category = inferCategory(extractedText, input.originalName);
  const dates = extractDates(extractedText);
  const amounts = extractAmounts(extractedText);
  const document: VaultDocument = {
    id,
    ownerId: input.ownerId,
    title: input.title || input.originalName.replace(/\.[^.]+$/, ""),
    originalName: input.originalName,
    storedName: input.storedName,
    mimeType: input.mimeType,
    size: input.size,
    uploadedAt: input.uploadedAt ?? new Date().toISOString(),
    category,
    tags: inferTags(extractedText, category),
    summary: summarizeText(extractedText),
    extractedText,
    dates,
    amounts,
    chunks: splitIntoChunks(extractedText, id),
  };

  return {
    document,
    reminders: createReminders(document),
  };
}

function createReminders(document: VaultDocument): Reminder[] {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  return document.dates
    .filter((date) => new Date(date.isoDate) >= yesterday)
    .filter((date) => /expiry|payment due|warranty|important date/i.test(date.label))
    .map((date) => ({
      id: nanoid(),
      ownerId: document.ownerId,
      documentId: document.id,
      documentTitle: document.title,
      title: `${date.label}: ${document.title}`,
      dueDate: date.isoDate,
      sourceText: date.sourceText,
      category: date.label,
      status: "open" as const,
      createdAt: new Date().toISOString(),
    }))
    .slice(0, 8);
}
