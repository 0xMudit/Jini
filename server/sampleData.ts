import { createDocumentFromText } from "./ingest";

const samples = [
  {
    title: "Bike Insurance Policy",
    originalName: "bike-insurance-policy.pdf",
    text: `
      Two Wheeler Insurance Policy
      Insured vehicle: Bajaj Pulsar 150
      Policy number: TW-4829-2026
      Premium paid: INR 2,842
      Policy issue date: 15 May 2026
      Policy expiry date: 14 May 2027
      IDV: INR 68,000
      Nominee: Riya Sharma
      Coverage includes own damage and third party liability.
    `,
  },
  {
    title: "Laptop Invoice and Warranty",
    originalName: "laptop-invoice-warranty.pdf",
    text: `
      Retail Invoice
      Product: Lenovo ThinkPad E14 Gen 5
      Serial number: LTP-IND-884201
      Invoice date: 02 February 2026
      Total amount paid: ₹72,499
      Warranty period: 3 years from invoice date
      Warranty valid till 01 February 2029
      Payment mode: HDFC credit card.
    `,
  },
  {
    title: "Rent Agreement",
    originalName: "rent-agreement.docx",
    text: `
      Residential Rent Agreement
      Landlord: Meera Iyer
      Tenant: Arjun Menon
      Property: Indiranagar, Bengaluru
      Agreement start date: 01 April 2026
      Agreement end date: 31 March 2027
      Monthly rent: INR 32,000
      Security deposit: INR 96,000
      Notice period: 2 months
      Maintenance payment due by the 5th day of every month.
    `,
  },
  {
    title: "May Bank Statement",
    originalName: "bank-statement-may-2026.xlsx",
    text: `
      HDFC Bank Account Statement
      Statement period: 01 May 2026 to 31 May 2026
      03 May 2026 UPI Grocery Store debit INR 4,850
      05 May 2026 Rent payment debit INR 32,000
      09 May 2026 Netflix subscription auto debit INR 649
      12 May 2026 Laptop EMI debit INR 6,240
      17 May 2026 Medical lab payment debit INR 5,850
      30 May 2026 Salary credit INR 1,48,000
    `,
  },
  {
    title: "Form 16 FY 2025-26",
    originalName: "form-16-fy-2025-26.pdf",
    text: `
      Form 16
      Employer: Contoso Systems India Pvt Ltd
      Employee: Arjun Menon
      PAN: ABCPM1234F
      Assessment Year: 2026-27
      Gross salary: INR 18,20,000
      Tax deducted at source: INR 1,92,400
      Deductions under section 80C: INR 1,50,000
      Tax filing document for income tax return.
    `,
  },
];

export function createSampleDocuments(ownerId: string) {
  const uploadedAtBase = new Date();
  return samples.map((sample, index) =>
    createDocumentFromText({
      ...sample,
      ownerId,
      storedName: `demo:${sample.originalName}`,
      mimeType: "text/plain",
      size: sample.text.length,
      uploadedAt: new Date(uploadedAtBase.getTime() - index * 86400000).toISOString(),
    }),
  );
}
