import type { QueryCitation, QueryResponse, VaultDocument } from "./types";
import { formatCurrency, normalizeWhitespace, tokenize } from "./textUtils";

interface ScoredChunk {
  document: VaultDocument;
  chunkId: string;
  text: string;
  score: number;
}

const INTENT_ACTIONS: Array<[RegExp, string]> = [
  [/expir|renew|valid/i, "Create calendar reminders 30 and 7 days before expiry."],
  [/salary slip|payslip|income/i, "Pin this employment document for income proof workflows."],
  [/tax|itr|filing|deduction/i, "Group tax-related documents by assessment year before filing."],
  [/payment|above|transaction|bank statement/i, "Export matching transactions to CSV for reconciliation."],
  [/subscription|recurring|auto debit/i, "Review recurring payments and cancel unused services."],
  [/rent|lease|agreement/i, "Save landlord, tenant, deposit, lock-in, and notice-period facts."],
];

export function searchDocuments(documents: VaultDocument[], query: string, category?: string) {
  const queryTokens = tokenize(query);
  const filtered = category && category !== "All" ? documents.filter((document) => document.category === category) : documents;

  const scoredChunks = filtered.flatMap((document) =>
    document.chunks.map((chunk) => ({
      document,
      chunkId: chunk.id,
      text: chunk.text,
      score: scoreChunk(query, queryTokens, document, chunk.text),
    })),
  );

  return scoredChunks
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

export function createExtractiveAnswer(question: string, scoredChunks: ScoredChunk[]): QueryResponse {
  const citations = scoredChunks.slice(0, 5).map(toCitation);
  const conversational = answerConversationalTurn(question);

  if (conversational) {
    return {
      answer: conversational.answer,
      mode: "extractive",
      citations: [],
      suggestedActions: conversational.suggestedActions,
    };
  }

  const specialized = answerKnownIntent(question, scoredChunks);

  if (specialized) {
    return {
      answer: specialized,
      mode: "extractive",
      citations,
      suggestedActions: suggestedActions(question),
    };
  }

  if (!scoredChunks.length) {
    return {
      answer:
        "I don’t see matching evidence in your vault for that yet. If you just uploaded or changed a file, try asking with the document name or the exact detail you want me to pull out. I’ll avoid guessing until I can cite a source.",
      mode: "extractive",
      citations: [],
      suggestedActions: [
        "Summarize the latest uploaded document",
        "Find important dates in my documents",
        "Search all documents for a specific name or amount",
      ],
    };
  }

  const evidence = scoredChunks
    .slice(0, 3)
    .map((chunk, index) => `${index + 1}. ${chunk.document.title}: ${normalizeWhitespace(chunk.text).slice(0, 420)}`)
    .join("\n\n");

  return {
    answer: `Based on the most relevant vault matches:\n\n${evidence}`,
    mode: "extractive",
    citations,
    suggestedActions: suggestedActions(question),
  };
}

function answerConversationalTurn(question: string) {
  const normalized = normalizeWhitespace(question).toLowerCase();

  if (/^(hi|hello|hey|yo|good morning|good afternoon|good evening)\b/.test(normalized)) {
    return {
      answer: "Hi — ask me about a document, deadline, payment, policy, agreement, or anything you want pulled from your vault.",
      suggestedActions: [
        "What changed in my latest document?",
        "Find upcoming expiry dates",
        "Summarize my newest document",
      ],
    };
  }

  if (/\b(thanks|thank you|cool|okay|ok|got it)\b/.test(normalized) && normalized.length < 80) {
    return {
      answer: "Got it. Send the next question whenever you’re ready.",
      suggestedActions: [
        "Show my upcoming reminders",
        "Summarize the latest document",
        "Find high-value payments",
      ],
    };
  }

  if (/\b(i\s+)?(uploaded|upload|added|add|updated|update|changed|replaced|attached)\b.*\b(doc|document|file|pdf|statement|invoice|policy|agreement)\b/.test(normalized)) {
    return {
      answer:
        "Got it. If the file finished uploading, Jini has indexed it and I can query it now. Ask what you want from that document, or mention its name if you want me to focus there.",
      suggestedActions: [
        "Summarize the latest uploaded document",
        "Find dates and deadlines in the latest document",
        "Extract payments or amounts from the latest document",
      ],
    };
  }

  return null;
}

function answerKnownIntent(question: string, scoredChunks: ScoredChunk[]) {
  if (!scoredChunks.length) {
    return null;
  }

  const questionLower = question.toLowerCase();
  const documents = uniqueDocuments(scoredChunks);

  if (/payment|transaction|above|over|greater/.test(questionLower)) {
    const threshold = extractThreshold(questionLower);
    if (threshold) {
      const paymentDocuments = /\bbank|statement|transaction/.test(questionLower)
        ? documents.filter((document) => document.category === "Banking" || /bank statement|account statement/i.test(`${document.title} ${document.extractedText}`))
        : documents;
      const matches = paymentDocuments
        .flatMap((document) =>
          document.amounts.map((amount) => ({
            document,
            amount,
          })),
        )
        .filter(({ amount }) => amount.amount >= threshold)
        .sort((a, b) => b.amount.amount - a.amount.amount)
        .slice(0, 8);

      if (matches.length) {
        return `Payments or amounts above ${formatCurrency(threshold)} found:\n\n${matches
          .map(({ document, amount }) => `- ${formatCurrency(amount.amount)} in ${document.title}: ${amount.sourceText}`)
          .join("\n")}`;
      }
    }
  }

  if (/expir|valid|warranty|renewal|due/.test(questionLower)) {
    const allDates = documents
      .flatMap((document) =>
        document.dates.map((date) => ({
          document,
          date,
        })),
      )
      .sort((a, b) => a.date.isoDate.localeCompare(b.date.isoDate));
    const preferredDates = allDates.filter(({ date }) =>
      /expiry|warranty|payment due|renewal|valid|expir/i.test(`${date.label} ${date.sourceText}`),
    );
    const dates = (preferredDates.length ? preferredDates : allDates).slice(0, 6);

    if (dates.length) {
      return `Relevant dates I found:\n\n${dates
        .map(({ document, date }) => `- ${date.isoDate} (${date.label}) from ${document.title}: ${date.sourceText}`)
        .join("\n")}`;
    }
  }

  if (/latest|recent|newest/.test(questionLower)) {
    const latest = documents.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))[0];
    return `The latest matching document is ${latest.title}, uploaded on ${latest.uploadedAt.slice(0, 10)}.\n\n${latest.summary}`;
  }

  if (/subscription|recurring|auto debit/.test(questionLower)) {
    const matches = documents
      .flatMap((document) =>
        document.amounts.map((amount) => ({
          document,
          amount,
        })),
      )
      .filter(({ document, amount }) => /subscription|recurring|auto debit|standing instruction|netflix|spotify|prime/i.test(`${document.extractedText} ${amount.sourceText}`))
      .slice(0, 8);

    if (matches.length) {
      return `Possible recurring subscriptions:\n\n${matches
        .map(({ document, amount }) => `- ${formatCurrency(amount.amount)} from ${document.title}: ${amount.sourceText}`)
        .join("\n")}`;
    }
  }

  return null;
}

function scoreChunk(query: string, queryTokens: string[], document: VaultDocument, text: string) {
  const chunkTokens = tokenize(`${document.title} ${document.category} ${document.tags.join(" ")} ${text}`);
  if (!chunkTokens.length) {
    return 0;
  }

  const frequency = new Map<string, number>();
  for (const token of chunkTokens) {
    frequency.set(token, (frequency.get(token) ?? 0) + 1);
  }

  let score = 0;
  for (const token of queryTokens) {
    score += (frequency.get(token) ?? 0) / Math.sqrt(chunkTokens.length);
  }

  const queryLower = query.toLowerCase();
  if (document.title.toLowerCase().includes(queryLower)) score += 4;
  if (document.category.toLowerCase().includes(queryLower)) score += 2;
  if (queryTokens.some((token) => document.tags.join(" ").toLowerCase().includes(token))) score += 1.5;
  if (/latest|recent|newest/i.test(query)) score += new Date(document.uploadedAt).getTime() / 10000000000000;

  return score;
}

function toCitation(chunk: ScoredChunk): QueryCitation {
  return {
    documentId: chunk.document.id,
    documentTitle: chunk.document.title,
    category: chunk.document.category,
    chunkId: chunk.chunkId,
    snippet: normalizeWhitespace(chunk.text).slice(0, 360),
    score: Number(chunk.score.toFixed(3)),
  };
}

function uniqueDocuments(scoredChunks: ScoredChunk[]) {
  const seen = new Set<string>();
  const documents: VaultDocument[] = [];

  for (const chunk of scoredChunks) {
    if (!seen.has(chunk.document.id)) {
      seen.add(chunk.document.id);
      documents.push(chunk.document);
    }
  }

  return documents;
}

function extractThreshold(question: string) {
  const match = question.match(/(?:₹|rs\.?|inr)?\s*([0-9]{1,3}(?:,[0-9]{2,3})+|[0-9]{3,})(?:\.\d{1,2})?/i);
  return match ? Number(match[1].replace(/,/g, "")) : null;
}

function suggestedActions(question: string) {
  const actions = INTENT_ACTIONS.filter(([regex]) => regex.test(question)).map(([, action]) => action);
  return actions.length ? actions.slice(0, 3) : ["Open the cited document and verify the extracted facts before acting."];
}
