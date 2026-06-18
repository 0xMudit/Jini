import type { VaultDocument } from "./types";
import { formatCurrency } from "./textUtils";

export function buildInsights(documents: VaultDocument[]) {
  const categoryCounts = documents.reduce<Record<string, number>>((acc, document) => {
    acc[document.category] = (acc[document.category] ?? 0) + 1;
    return acc;
  }, {});

  const highValuePayments = documents
    .flatMap((document) =>
      document.amounts.map((amount) => ({
        documentId: document.id,
        documentTitle: document.title,
        amount: amount.amount,
        amountLabel: formatCurrency(amount.amount),
        sourceText: amount.sourceText,
      })),
    )
    .filter((item) => item.amount >= 5000)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  const subscriptions = documents
    .flatMap((document) =>
      document.amounts.map((amount) => ({
        documentId: document.id,
        documentTitle: document.title,
        amount: amount.amount,
        amountLabel: formatCurrency(amount.amount),
        sourceText: amount.sourceText,
      })),
    )
    .filter((item) => /subscription|recurring|auto debit|standing instruction|netflix|spotify|prime|saas/i.test(item.sourceText))
    .slice(0, 10);

  const upcomingDates = documents
    .flatMap((document) =>
      document.dates.map((date) => ({
        documentId: document.id,
        documentTitle: document.title,
        label: date.label,
        isoDate: date.isoDate,
        sourceText: date.sourceText,
      })),
    )
    .filter((item) => new Date(item.isoDate) >= new Date())
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate))
    .slice(0, 8);

  const taxChecklist = [
    {
      label: "PAN / Aadhaar",
      present: documents.some((document) => document.category === "Identity"),
    },
    {
      label: "Form 16 or salary slips",
      present: documents.some((document) => /form 16|salary slip|payslip/i.test(`${document.title} ${document.extractedText}`)),
    },
    {
      label: "Bank statements",
      present: documents.some((document) => document.category === "Banking"),
    },
    {
      label: "Investment and insurance proofs",
      present: documents.some((document) => /insurance|premium|investment|elss|ppf|nps/i.test(`${document.title} ${document.extractedText}`)),
    },
    {
      label: "Rent receipts or agreement",
      present: documents.some((document) => document.category === "Housing"),
    },
  ];

  return {
    totals: {
      documents: documents.length,
      chunks: documents.reduce((sum, document) => sum + document.chunks.length, 0),
      reminders: upcomingDates.length,
      extractedAmounts: documents.reduce((sum, document) => sum + document.amounts.length, 0),
    },
    categoryCounts,
    highValuePayments,
    subscriptions,
    upcomingDates,
    taxChecklist,
  };
}
