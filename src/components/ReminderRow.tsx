import { Check } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { Reminder } from "../types";
import { relativeDate } from "../lib/api";

export function ReminderRow({
  reminder,
  toggleReminder,
}: {
  reminder: Reminder;
  toggleReminder: (reminder: Reminder) => Promise<void>;
}) {
  return (
    <article className={reminder.status === "done" ? "timeline-row done" : "timeline-row"}>
      <button
        aria-label={reminder.status === "done" ? "Mark reminder open" : "Mark reminder complete"}
        onClick={() => void toggleReminder(reminder)}
        type="button"
      >
        {reminder.status === "done" ? <Check size={15} /> : null}
      </button>
      <span className="timeline-date">
        <strong>{format(parseISO(reminder.dueDate), "dd")}</strong>
        <small>{format(parseISO(reminder.dueDate), "MMM yyyy")}</small>
      </span>
      <span>
        <strong>{reminder.title}</strong>
        <small>{reminder.sourceText}</small>
        <em>{reminder.documentTitle}</em>
      </span>
      <span className="due-label">{relativeDate(reminder.dueDate)}</span>
    </article>
  );
}
