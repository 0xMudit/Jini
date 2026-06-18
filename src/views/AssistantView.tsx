import { useEffect, useRef } from "react";
import {
  ArrowRight, BookOpen, Bot, Database, Loader2, MessageSquareText, ShieldCheck, Sparkles,
} from "lucide-react";
import type { BusyState, ChatMessage, DocumentCategory, VaultDocument } from "../types";
import { categories, starterQuestions } from "../types";

export function AssistantView({
  askQuestion,
  busy,
  chatMessages,
  documents,
  question,
  selectedCategory,
  setQuestion,
  setSelectedCategory,
}: {
  askQuestion: (question?: string) => Promise<void>;
  busy: BusyState;
  chatMessages: ChatMessage[];
  documents: VaultDocument[];
  question: string;
  selectedCategory: DocumentCategory | "All";
  setQuestion: (question: string) => void;
  setSelectedCategory: (category: DocumentCategory | "All") => void;
}) {
  const threadRef = useRef<HTMLDivElement | null>(null);
  const hasConversation = chatMessages.length > 0;
  const documentCountLabel = `${documents.length} indexed document${documents.length === 1 ? "" : "s"}`;
  const categoryLabel = selectedCategory === "All" ? "All documents" : selectedCategory;

  useEffect(() => {
    threadRef.current?.scrollTo({
      top: threadRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [busy, chatMessages.length]);

  return (
    <div className="assistant-layout">
      <section className="assistant-main surface">
        <div className="assistant-intro">
          <span className="assistant-mark"><Sparkles size={20} /></span>
          <div className="assistant-title-copy">
            <p className="assistant-kicker">Jini assistant</p>
            <h2>Chat with Jini</h2>
            <p>Ask follow-up questions. Jini uses Groq with your indexed document evidence and citations.</p>
          </div>
        </div>

        <div className="assistant-context-bar" aria-label="Assistant context">
          <span><Database size={14} />{documentCountLabel}</span>
          <span><BookOpen size={14} />{categoryLabel}</span>
          <span><ShieldCheck size={14} />Citations on</span>
        </div>

        <div className="answer-area" aria-live="polite">
          <div className="chat-thread" ref={threadRef}>
            {!hasConversation && busy !== "query" ? (
              <div className="chat-empty-state">
                <MessageSquareText size={24} />
                <strong>What can I help you find?</strong>
                <span>{documents.length ? "Start with a prompt or type your own question below." : "Load demo documents or add your own to begin."}</span>
                <div className="starter-grid">
                  {starterQuestions.map((starterQuestion) => (
                    <button key={starterQuestion} onClick={() => void askQuestion(starterQuestion)} type="button">
                      <span>{starterQuestion}</span>
                      <ArrowRight size={15} />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {chatMessages.map((message) => (
              <article className={`chat-message ${message.role}`} key={message.id}>
                <span className="chat-avatar" aria-hidden="true">
                  {message.role === "assistant" ? <Bot size={16} /> : "Y"}
                </span>
                <div className="chat-stack">
                  <div className="chat-label">
                    <Bot size={14} />
                    <span>{message.role === "assistant" ? "Jini" : "You"}</span>
                  </div>
                  <div className="chat-bubble">
                    <div className="chat-copy">{message.content}</div>
                  </div>
                  {message.role === "assistant" && message.citations?.length ? (
                    <div className="message-citations">
                      <span>Cited sources</span>
                      {message.citations.slice(0, 3).map((citation, index) => (
                        <small key={citation.chunkId}>[{index + 1}] {citation.documentTitle}</small>
                      ))}
                    </div>
                  ) : null}
                  {message.role === "assistant" && message.suggestedActions?.length ? (
                    <div className="reply-tools">
                      <span>Try next</span>
                      <div>
                        {message.suggestedActions.map((action) => (
                          <button disabled={busy === "query"} key={action} onClick={() => void askQuestion(action)} type="button">{action}</button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}

            {busy === "query" ? (
              <article className="chat-message assistant">
                <span className="chat-avatar" aria-hidden="true"><Bot size={16} /></span>
                <div className="chat-stack">
                  <div className="chat-label"><Bot size={14} /><span>Jini</span></div>
                  <div className="chat-bubble thinking-bubble">
                    <Loader2 className="spin" size={18} />
                    <span>
                      <strong>Jini is searching your vault</strong>
                      <small>Ranking evidence and sending the grounded context to Groq...</small>
                    </span>
                  </div>
                </div>
              </article>
            ) : null}
          </div>
        </div>

        <div className="prompt-composer">
          <textarea
            aria-label="Ask a question about your documents"
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void askQuestion();
              }
            }}
            placeholder="Ask about a deadline, payment, policy, agreement, or document..."
            rows={3}
            value={question}
          />
          <div className="composer-footer">
            <div className="composer-left">
              <select
                aria-label="Limit answer to a category"
                onChange={(event) => setSelectedCategory(event.target.value as DocumentCategory | "All")}
                value={selectedCategory}
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat === "All" ? "All documents" : cat}</option>
                ))}
              </select>
              <span>Shift + Enter for a new line</span>
            </div>
            <button
              className="primary-button"
              disabled={busy === "query" || !question.trim()}
              onClick={() => void askQuestion()}
              type="button"
            >
              {busy === "query" ? <Loader2 className="spin" size={17} /> : <Sparkles size={17} />}
              Ask Jini
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
