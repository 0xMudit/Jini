import { format, isValid, parse, parseISO } from "date-fns";
import { nanoid } from "nanoid";
import type { DocumentCategory, ExtractedAmount, ExtractedDate } from "./types";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "has",
  "have",
  "how",
  "i",
  "in",
  "is",
  "it",
  "latest",
  "me",
  "my",
  "of",
  "on",
  "or",
  "show",
  "that",
  "the",
  "this",
  "to",
  "what",
  "when",
  "which",
  "with",
]);

const CATEGORY_RULES: Array<[DocumentCategory, RegExp]> = [
  ["Tax", /\b(income tax|itr|form 16|tds|deduction|assessment year|tax filing|capital gain)\b/i],
  ["Warranty", /\b(warranty|invoice|bill|serial number|repair|service center|guarantee)\b/i],
  ["Identity", /\b(aadhaar|aadhar|pan\b|passport|voter|driving licence|driver'?s license|identity)\b/i],
  ["Insurance", /\b(insurance|policy|premium|idv|insured|nominee|claim|coverage)\b/i],
  ["Banking", /\b(bank statement|account statement|upi|neft|imps|rtgs|debit|credit|ifsc|transaction)\b/i],
  ["Employment", /\b(salary slip|payslip|offer letter|appointment letter|ctc|employer|employee|form 16)\b/i],
  ["Housing", /\b(rent agreement|lease|landlord|tenant|security deposit|maintenance)\b/i],
  ["Medical", /\b(medical|diagnostic|blood test|prescription|hospital|patient|lab report)\b/i],
  ["Education", /\b(certificate|degree|marksheet|transcript|college|university|diploma)\b/i],
  ["Loan", /\b(loan|emi|principal|interest rate|repayment|sanction letter|foreclosure)\b/i],
  ["Subscriptions", /\b(subscription|recurring|auto debit|standing instruction|netflix|spotify|prime|saas)\b/i],
];

const DATE_PATTERNS = [
  {
    regex: /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/g,
    formats: ["dd/MM/yyyy", "d/M/yyyy", "dd-MM-yyyy", "d-M-yyyy", "dd/MM/yy", "d/M/yy", "dd-MM-yy", "d-M-yy"],
  },
  {
    regex: /\b(\d{4}[/-]\d{1,2}[/-]\d{1,2})\b/g,
    formats: ["yyyy-MM-dd", "yyyy/M/d", "yyyy/MM/dd", "yyyy-M-d"],
  },
  {
    regex:
      /\b(\d{1,2}\s+(?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s+\d{4})\b/gi,
    formats: ["d MMM yyyy", "d MMMM yyyy", "dd MMM yyyy", "dd MMMM yyyy"],
  },
  {
    regex:
      /\b((?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s+\d{1,2},?\s+\d{4})\b/gi,
    formats: ["MMM d yyyy", "MMMM d yyyy", "MMM dd yyyy", "MMMM dd yyyy"],
  },
];

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s₹.-]/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

export function splitIntoChunks(text: string, documentId: string, chunkSize = 850, overlap = 120) {
  const normalized = normalizeWhitespace(text);
  const chunks = [];
  let start = 0;
  let ordinal = 0;

  while (start < normalized.length) {
    const end = Math.min(start + chunkSize, normalized.length);
    const boundary = findChunkBoundary(normalized, end, start);
    const chunkText = normalized.slice(start, boundary).trim();

    if (chunkText.length > 60) {
      chunks.push({
        id: nanoid(),
        documentId,
        ordinal,
        text: chunkText,
        tokenCount: tokenize(chunkText).length,
      });
      ordinal += 1;
    }

    if (boundary >= normalized.length) {
      break;
    }

    start = Math.max(0, boundary - overlap);
  }

  return chunks;
}

function findChunkBoundary(text: string, proposedEnd: number, start: number) {
  const punctuation = Math.max(text.lastIndexOf(". ", proposedEnd), text.lastIndexOf("\n", proposedEnd));
  if (punctuation > start + 250) {
    return punctuation + 1;
  }
  return proposedEnd;
}

export function inferCategory(text: string, fileName: string): DocumentCategory {
  const haystack = `${fileName}\n${text.slice(0, 5000)}`;
  return CATEGORY_RULES.find(([, regex]) => regex.test(haystack))?.[0] ?? "General";
}

export function inferTags(text: string, category: DocumentCategory): string[] {
  const tags = new Set<string>([category]);
  const rules: Array<[string, RegExp]> = [
    ["expiry", /\b(expir|valid till|valid up to|renewal|maturity)\b/i],
    ["payment", /\b(payment|paid|debit|credit|upi|emi|premium)\b/i],
    ["tax", /\b(tax|tds|deduction|itr|form 16)\b/i],
    ["identity", /\b(aadhaar|pan|passport)\b/i],
    ["recurring", /\b(recurring|subscription|auto debit|standing instruction)\b/i],
  ];

  for (const [tag, regex] of rules) {
    if (regex.test(text)) {
      tags.add(tag);
    }
  }

  return Array.from(tags).slice(0, 6);
}

export function summarizeText(text: string): string {
  const normalized = normalizeWhitespace(text);
  if (!normalized) {
    return "No readable text was extracted from this file.";
  }

  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const scored = sentences
    .slice(0, 40)
    .map((sentence, index) => ({
      sentence,
      score: scoreSummarySentence(sentence) - index * 0.02,
      index,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .sort((a, b) => a.index - b.index)
    .map(({ sentence }) => sentence);

  return scored.join(" ").slice(0, 900);
}

function scoreSummarySentence(sentence: string) {
  const keywords = /\b(expir|valid|amount|premium|salary|rent|warranty|policy|statement|invoice|tax|loan|subscription)\b/i;
  return Math.min(sentence.length / 120, 2) + (keywords.test(sentence) ? 2 : 0);
}

export function extractDates(text: string): ExtractedDate[] {
  const lines = text.split(/\r?\n/).flatMap((line) => softLineSplit(line));
  const dates = new Map<string, ExtractedDate>();

  for (const line of lines) {
    for (const pattern of DATE_PATTERNS) {
      for (const match of line.matchAll(pattern.regex)) {
        const raw = match[1];
        const parsed = parseDate(raw, pattern.formats);

        if (!parsed) {
          continue;
        }

        const isoDate = format(parsed, "yyyy-MM-dd");
        const key = `${isoDate}:${normalizeWhitespace(line).slice(0, 80)}`;
        if (!dates.has(key)) {
          dates.set(key, {
            id: nanoid(),
            label: inferDateLabel(line),
            isoDate,
            sourceText: normalizeWhitespace(line).slice(0, 220),
            confidence: inferDateConfidence(line),
          });
        }
      }
    }
  }

  return Array.from(dates.values()).slice(0, 40);
}

function parseDate(raw: string, formats: string[]) {
  const cleaned = raw.replace(",", "").trim();

  for (const dateFormat of formats) {
    const parsed = parse(cleaned, dateFormat, new Date());
    if (isValid(parsed)) {
      return parsed;
    }
  }

  const isoParsed = parseISO(cleaned);
  return isValid(isoParsed) ? isoParsed : null;
}

function inferDateLabel(line: string) {
  if (/\b(expir\w*|valid till|valid up to|renewal|maturity)\b/i.test(line)) return "Expiry";
  if (/\b(due|pay by|last date|emi|premium)\b/i.test(line)) return "Payment due";
  if (/\b(start|from|commencement|issued)\b/i.test(line)) return "Start date";
  if (/\b(warranty|guarantee)\b/i.test(line)) return "Warranty";
  if (/\b(statement|period)\b/i.test(line)) return "Statement period";
  return "Important date";
}

function inferDateConfidence(line: string) {
  return /\b(expir|valid|due|warranty|maturity|renewal|premium|emi)\b/i.test(line) ? 0.86 : 0.62;
}

export function extractAmounts(text: string): ExtractedAmount[] {
  const results: ExtractedAmount[] = [];
  const lines = text.split(/\r?\n/).flatMap((line) => softLineSplit(line));
  const amountRegex =
    /(?:₹|rs\.?|inr)\s*([0-9]{1,3}(?:,[0-9]{2,3})+|[0-9]{4,})(?:\.\d{1,2})?|([0-9]{1,3}(?:,[0-9]{2,3})+|[0-9]{4,})(?:\.\d{1,2})?\s*(?:₹|rs\.?|inr)/gi;

  for (const line of lines) {
    const normalizedLine = normalizeWhitespace(line);
    if (!/\b(amount|payment|paid|debit|credit|upi|emi|premium|rent|salary|invoice|total|rs|inr)\b|₹/i.test(normalizedLine)) {
      continue;
    }

    for (const match of normalizedLine.matchAll(amountRegex)) {
      const rawAmount = match[1] ?? match[2];
      const amount = Number(rawAmount.replace(/,/g, ""));
      if (Number.isFinite(amount) && amount >= 100) {
        results.push({
          id: nanoid(),
          amount,
          currency: /₹|rs\.?|inr/i.test(match[0]) || /₹|rs\.?|inr/i.test(normalizedLine) ? "INR" : "UNKNOWN",
          sourceText: normalizedLine.slice(0, 240),
        });
      }
    }
  }

  return dedupeAmounts(results).slice(0, 80);
}

function dedupeAmounts(amounts: ExtractedAmount[]) {
  const seen = new Set<string>();
  return amounts.filter((amount) => {
    const key = `${amount.amount}:${amount.sourceText.slice(0, 60)}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function normalizeWhitespace(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function softLineSplit(line: string) {
  const normalized = line.trim();
  if (normalized.length <= 280) {
    return [normalized];
  }
  return normalized.split(/(?<=[.;])\s+/);
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}
