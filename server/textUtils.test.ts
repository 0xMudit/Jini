import { describe, it, expect } from "vitest";
import {
  tokenize,
  normalizeWhitespace,
  splitIntoChunks,
  inferCategory,
  inferTags,
  summarizeText,
  extractDates,
  extractAmounts,
  formatCurrency,
} from "./textUtils";

describe("tokenize", () => {
  it("splits text into lowercase tokens", () => {
    expect(tokenize("Hello World")).toEqual(["hello", "world"]);
  });

  it("removes stop words", () => {
    expect(tokenize("the quick brown fox")).toEqual(["quick", "brown", "fox"]);
  });

  it("filters short tokens", () => {
    expect(tokenize("a b c d")).toEqual([]);
  });

  it("handles empty input", () => {
    expect(tokenize("")).toEqual([]);
  });
});

describe("normalizeWhitespace", () => {
  it("collapses multiple spaces", () => {
    expect(normalizeWhitespace("hello   world")).toBe("hello world");
  });

  it("trims edges", () => {
    expect(normalizeWhitespace("  hi  ")).toBe("hi");
  });
});

describe("splitIntoChunks", () => {
  it("creates chunks from text", () => {
    const docId = "test-doc";
    const text = "A. ".repeat(500);
    const chunks = splitIntoChunks(text, docId);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].documentId).toBe(docId);
    expect(chunks[0].ordinal).toBe(0);
    expect(chunks[0].text.length).toBeGreaterThan(60);
  });

  it("handles short text", () => {
    const chunks = splitIntoChunks("Short text", "doc-1");
    expect(chunks.length).toBe(0);
  });
});

describe("inferCategory", () => {
  it("identifies tax documents", () => {
    expect(inferCategory("This is my income tax return for FY 2025-26", "file.pdf")).toBe("Tax");
  });

  it("identifies warranty documents", () => {
    expect(inferCategory("Product warranty and invoice details", "file.pdf")).toBe("Warranty");
  });

  it("returns General for unknown", () => {
    expect(inferCategory("Random note about weather", "file.txt")).toBe("General");
  });
});

describe("inferTags", () => {
  it("includes the category as a tag", () => {
    const tags = inferTags("Some document content", "Tax");
    expect(tags).toContain("Tax");
  });

  it("detects expiry tag", () => {
    const tags = inferTags("This has an expiry date next year", "General");
    expect(tags).toContain("expiry");
  });
});

describe("summarizeText", () => {
  it("returns fallback for empty text", () => {
    expect(summarizeText("")).toBe("No readable text was extracted from this file.");
  });

  it("returns sentences from longer text", () => {
    const result = summarizeText("First sentence. Second sentence. Third sentence. Fourth sentence.");
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toContain("No readable text");
  });
});

describe("extractDates", () => {
  it("extracts dates from text", () => {
    const dates = extractDates("The policy expires on 15 May 2027");
    expect(dates.length).toBeGreaterThan(0);
    expect(dates[0].isoDate).toBe("2027-05-15");
  });

  it("extracts dates in yyyy-MM-dd format", () => {
    const dates = extractDates("Valid till 2027-05-15");
    expect(dates.some((d) => d.isoDate === "2027-05-15")).toBe(true);
  });

  it("returns empty for text without dates", () => {
    const dates = extractDates("No dates here at all");
    expect(dates.length).toBe(0);
  });
});

describe("extractAmounts", () => {
  it("extracts INR amounts", () => {
    const amounts = extractAmounts("Total paid: INR 72,499");
    expect(amounts.length).toBeGreaterThan(0);
    expect(amounts[0].amount).toBe(72499);
    expect(amounts[0].currency).toBe("INR");
  });

  it("extracts amounts with ₹ symbol", () => {
    const amounts = extractAmounts("Premium paid: ₹2,842");
    expect(amounts.some((a) => a.amount === 2842)).toBe(true);
  });

  it("ignores amounts below 100", () => {
    const amounts = extractAmounts("Price: INR 50");
    expect(amounts.length).toBe(0);
  });

  it("returns empty for text without amounts", () => {
    const amounts = extractAmounts("No money mentioned here");
    expect(amounts.length).toBe(0);
  });
});

describe("formatCurrency", () => {
  it("formats INR values", () => {
    expect(formatCurrency(72000)).toContain("72");
  });
});
