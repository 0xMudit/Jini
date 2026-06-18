import OpenAI from "openai";
import type { QueryCitation } from "./types";
import { getGroqConfig } from "./aiConfig";

export interface ChatHistoryItem {
  role: "user" | "assistant";
  content: string;
}

export async function answerWithGroq(
  question: string,
  citations: QueryCitation[],
  history: ChatHistoryItem[] = [],
) {
  const { apiKey, model } = getGroqConfig();
  if (!apiKey) {
    return null;
  }

  const client = new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });
  const context = citations.length
    ? citations
        .map((citation, index) => {
          return `[${index + 1}] ${citation.documentTitle} (${citation.category})\n${citation.snippet}`;
        })
        .join("\n\n")
    : "No matching vault context was retrieved for this turn.";

  const response = await client.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "You are Jini, a polished personal document copilot. Use recent chat history only to resolve follow-up references. If vault context is provided, answer only from that context and cite document names inline. If no matching vault context is provided, do not invent personal document facts: respond naturally to greetings or workflow messages, and for document questions say you cannot find matching evidence yet while asking for a document name or clearer query. Keep responses concise and helpful.",
      },
      ...history.slice(-8).map((item) => ({
        role: item.role,
        content: item.content,
      })),
      {
        role: "user",
        content: `Question: ${question}\n\nVault context:\n${context}`,
      },
    ],
  });

  return response.choices[0]?.message.content?.trim() ?? null;
}
