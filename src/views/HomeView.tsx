import {
  Archive, Bell, CalendarDays, CheckCircle2, Circle, Clock3,
  Database, FileText, Files, Layers3, Loader2, MessageSquareText,
  Sparkles, WalletCards, ChevronRight,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import type { View, BusyState, VaultDocument, Reminder, Insights } from "../types";
import { Metric } from "../components/Metric";
import { SectionHeading } from "../components/SectionHeading";
import { EmptyState } from "../components/EmptyState";
import { formatDate, relativeDate } from "../lib/api";

export function HomeView({
  busy,
  documents,
  hasPrivateDocuments,
  insights,
  navigate,
  onboardingSteps,
  reminders,
  seedDemo,
}: {
  busy: BusyState;
  documents: VaultDocument[];
  hasPrivateDocuments: boolean;
  insights: Insights | null;
  navigate: (view: View) => void;
  onboardingSteps: Array<{
    label: string;
    detail: string;
    done: boolean;
    action: () => void;
    actionLabel: string;
  }>;
  reminders: Reminder[];
  seedDemo: () => Promise<void>;
}) {
  const completedSteps = onboardingSteps.filter((step) => step.done).length;
  const categoryEntries = Object.entries(insights?.categoryCounts ?? {});
  const categoryMax = Math.max(1, ...categoryEntries.map(([, value]) => value));

  return (
    <div className="view-stack">
      <section className="welcome-band">
        <div className="welcome-copy">
          <span className="section-kicker">
            <Sparkles size={14} />
            Your next useful answer is one question away
          </span>
          <h2>Your life admin, finally searchable.</h2>
          <p>Find policies, deadlines, payments, warranties, and tax records without opening files one by one.</p>
          <div className="button-row">
            <button className="primary-button" onClick={() => navigate("assistant")} type="button">
              <MessageSquareText size={17} />
              Ask your vault
            </button>
            {!hasPrivateDocuments ? (
              <button
                className="secondary-button"
                disabled={busy === "seed"}
                onClick={() => void seedDemo()}
                type="button"
              >
                {busy === "seed" ? <Loader2 className="spin" size={17} /> : <Database size={17} />}
                Explore demo
              </button>
            ) : null}
          </div>
        </div>
        <div className="setup-progress">
          <div className="progress-heading">
            <div>
              <span>First-value checklist</span>
              <strong>{completedSteps} of {onboardingSteps.length} complete</strong>
            </div>
            <div className="progress-ring">{completedSteps}/3</div>
          </div>
          <div className="setup-list">
            {onboardingSteps.map((step) => (
              <button disabled={step.done} key={step.label} onClick={step.action} type="button">
                {step.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                <span>
                  <strong>{step.label}</strong>
                  <small>{step.detail}</small>
                </span>
                <em>{step.actionLabel}</em>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="metric-grid" aria-label="Vault overview">
        <Metric icon={Archive} label="Documents" value={insights?.totals.documents ?? documents.length} />
        <Metric icon={Layers3} label="Searchable chunks" value={insights?.totals.chunks ?? 0} />
        <Metric icon={Bell} label="Open reminders" value={reminders.length} />
        <Metric icon={WalletCards} label="Amounts detected" value={insights?.totals.extractedAmounts ?? 0} />
      </section>

      <div className="dashboard-grid">
        <section className="surface action-surface">
          <SectionHeading
            action="View timeline"
            icon={Clock3}
            onAction={() => navigate("timeline")}
            subtitle="What needs attention"
            title="Action center"
          />
          <div className="action-list">
            {reminders.slice(0, 4).map((reminder) => (
              <button className="action-row" key={reminder.id} onClick={() => navigate("timeline")} type="button">
                <span className="date-block">
                  <strong>{format(parseISO(reminder.dueDate), "dd")}</strong>
                  <small>{format(parseISO(reminder.dueDate), "MMM")}</small>
                </span>
                <span>
                  <strong>{reminder.title}</strong>
                  <small>{reminder.documentTitle}</small>
                </span>
                <span className="due-label">{relativeDate(reminder.dueDate)}</span>
              </button>
            ))}
            {!reminders.length ? (
              <EmptyState detail="Important dates appear here after documents are indexed." icon={CalendarDays} title="Nothing urgent" />
            ) : null}
          </div>
        </section>

        <section className="surface">
          <SectionHeading
            action="Open library"
            icon={Files}
            onAction={() => navigate("library")}
            subtitle="Recently indexed"
            title="Document activity"
          />
          <div className="document-activity">
            {documents.slice(0, 5).map((document) => (
              <button key={document.id} onClick={() => navigate("library")} type="button">
                <span className="file-icon"><FileText size={17} /></span>
                <span>
                  <strong>{document.title}</strong>
                  <small>{document.category} · {formatDate(document.uploadedAt)}</small>
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
            {!documents.length ? (
              <EmptyState detail="Load the guest workspace or add a file to begin." icon={Files} title="No documents yet" />
            ) : null}
          </div>
        </section>

        <section className="surface">
          <SectionHeading icon={Layers3} subtitle="How your vault is organized" title="Coverage" />
          <div className="category-bars">
            {categoryEntries.slice(0, 6).map(([name, value]) => (
              <div className="category-bar" key={name}>
                <span>
                  <strong>{name}</strong>
                  <small>{value}</small>
                </span>
                <div><i style={{ width: `${Math.max(12, (value / categoryMax) * 100)}%` }} /></div>
              </div>
            ))}
            {!categoryEntries.length ? (
              <EmptyState detail="Categories are detected automatically." icon={Layers3} title="No coverage yet" />
            ) : null}
          </div>
        </section>

        <section className="surface">
          <SectionHeading icon={WalletCards} subtitle="Extracted from your documents" title="Money signals" />
          <div className="money-list">
            {(insights?.highValuePayments ?? []).slice(0, 4).map((payment) => (
              <div key={`${payment.documentId}-${payment.sourceText}`}>
                <span>
                  <strong>{payment.documentTitle}</strong>
                  <small>{payment.sourceText}</small>
                </span>
                <em>{payment.amountLabel}</em>
              </div>
            ))}
            {!insights?.highValuePayments.length ? (
              <EmptyState detail="Large amounts appear here when detected." icon={WalletCards} title="No money signals" />
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
