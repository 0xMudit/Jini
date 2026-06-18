import { ArrowRight, Database, KeyRound, MessageSquareText, ShieldCheck, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function ProductTour({
  closeTour,
  seedDemo,
  setTourStep,
  step,
}: {
  closeTour: () => void;
  seedDemo: () => Promise<void>;
  setTourStep: (step: number) => void;
  step: number;
}) {
  const steps: Array<{ icon: LucideIcon; eyebrow: string; title: string; detail: string }> = [
    {
      icon: ShieldCheck,
      eyebrow: "Welcome to Jini",
      title: "Your paperwork just became searchable.",
      detail: "In under a minute, you'll see Jini find a real deadline, answer a question, and show the exact source.",
    },
    {
      icon: Database,
      eyebrow: "Instant value",
      title: "A realistic vault is already waiting.",
      detail: "Policies, invoices, statements, and agreements are preloaded so your first useful answer is one click away.",
    },
    {
      icon: MessageSquareText,
      eyebrow: "Trust every answer",
      title: "Ask naturally. Verify instantly.",
      detail: "Jini answers from your files, keeps the evidence visible, and turns important dates into clear next actions.",
    },
    {
      icon: KeyRound,
      eyebrow: "Ready when you are",
      title: "See your first answer now.",
      detail: "Groq is connected for fast synthesis, while local retrieval keeps every response grounded in your documents.",
    },
  ];
  const current = steps[step];
  const Icon = current.icon;

  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-labelledby="tour-title" aria-modal="true" className="tour-modal" role="dialog">
        <div className="tour-topline">
          <span>Your 60-second win</span>
          <button aria-label="Close tour" onClick={closeTour} type="button"><X size={17} /></button>
        </div>
        <div className="tour-content">
          <span className="tour-icon"><Icon size={26} /></span>
          <p className="eyebrow">{current.eyebrow}</p>
          <h2 id="tour-title">{current.title}</h2>
          <p>{current.detail}</p>
        </div>
        <div className="tour-footer">
          <div className="tour-dots" aria-label={`Step ${step + 1} of ${steps.length}`}>
            {steps.map((item, index) => (
              <span className={index === step ? "active" : index < step ? "done" : ""} key={item.title} />
            ))}
          </div>
          <div className="button-row">
            {step > 0 ? (
              <button className="secondary-button" onClick={() => setTourStep(step - 1)} type="button">Back</button>
            ) : (
              <button className="secondary-button" onClick={closeTour} type="button">Skip</button>
            )}
            {step < steps.length - 1 ? (
              <button className="primary-button" onClick={() => setTourStep(step + 1)} type="button">
                Next <ArrowRight size={16} />
              </button>
            ) : (
              <button
                className="primary-button"
                onClick={() => {
                  closeTour();
                  void seedDemo();
                }}
                type="button"
              >
                Show me what matters <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
