import { CalendarDays, Check, CheckCircle2 } from "lucide-react";
import type { Reminder } from "../types";
import { SectionHeading } from "../components/SectionHeading";
import { EmptyState } from "../components/EmptyState";
import { ReminderRow } from "../components/ReminderRow";

export function TimelineView({
  reminders,
  toggleReminder,
}: {
  reminders: Reminder[];
  toggleReminder: (reminder: Reminder) => Promise<void>;
}) {
  const open = reminders.filter((reminder) => reminder.status === "open");
  const done = reminders.filter((reminder) => reminder.status === "done");

  return (
    <div className="timeline-layout">
      <section className="surface timeline-main">
        <SectionHeading icon={CalendarDays} subtitle={`${open.length} upcoming items`} title="Upcoming" />
        <div className="timeline-list">
          {open.map((reminder) => (
            <ReminderRow key={reminder.id} reminder={reminder} toggleReminder={toggleReminder} />
          ))}
          {!open.length ? (
            <EmptyState detail="Dates from indexed documents will appear automatically." icon={CheckCircle2} title="You are caught up" />
          ) : null}
        </div>
      </section>
      <aside className="surface completed-panel">
        <SectionHeading icon={CheckCircle2} subtitle="Completed reminders" title="Done" />
        <div className="timeline-list compact">
          {done.map((reminder) => (
            <ReminderRow key={reminder.id} reminder={reminder} toggleReminder={toggleReminder} />
          ))}
          {!done.length ? (
            <EmptyState detail="Completed reminders move here." icon={Check} title="Nothing completed yet" />
          ) : null}
        </div>
      </aside>
    </div>
  );
}
