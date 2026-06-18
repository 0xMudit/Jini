import { describe, it, expect } from "vitest";
import { searchDocuments, createExtractiveAnswer } from "./rag";
import type { VaultDocument } from "./types";

function makeDoc(overrides: Partial<VaultDocument> = {}): VaultDocument {
  return {
    id: "doc-1",
    ownerId: "user-1",
    title: "Test Document",
    originalName: "test.pdf",
    storedName: "test.pdf",
    mimeType: "application/pdf",
    size: 1000,
    uploadedAt: "2026-01-01T00:00:00.000Z",
    category: "General",
    tags: ["test"],
    summary: "A test document",
    extractedText: "This is a test document with some content for searching.",
    dates: [],
    amounts: [],
    chunks: [
      { id: "chunk-1", documentId: "doc-1", ordinal: 0, text: "This is a test chunk about insurance policy", tokenCount: 6 },
      { id: "chunk-2", documentId: "doc-1", ordinal: 1, text: "Bank statement shows transactions", tokenCount: 5 },
    ],
    ...overrides,
  };
}

describe("searchDocuments", () => {
  it("returns scored chunks for a matching query", () => {
    const docs = [makeDoc()];
    const results = searchDocuments(docs, "insurance");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].score).toBeGreaterThan(0);
  });

  it("returns empty for non-matching query", () => {
    const docs = [makeDoc()];
    const results = searchDocuments(docs, "xyznonexistent");
    expect(results.length).toBe(0);
  });

  it("filters by category", () => {
    const docs = [
      makeDoc({ id: "doc-1", category: "Insurance", chunks: [{ id: "c1", documentId: "doc-1", ordinal: 0, text: "Insurance policy details", tokenCount: 3 }] }),
      makeDoc({ id: "doc-2", category: "Tax", chunks: [{ id: "c2", documentId: "doc-2", ordinal: 0, text: "Tax filing documents", tokenCount: 3 }] }),
    ];
    const results = searchDocuments(docs, "document", "Insurance");
    expect(results.every((r) => r.document.category === "Insurance")).toBe(true);
  });

  it("returns at most 8 results", () => {
    const docs = [makeDoc({
      chunks: Array.from({ length: 20 }, (_, i) => ({
        id: `chunk-${i}`, documentId: "doc-1", ordinal: i, text: `Chunk number ${i} with searchable content`, tokenCount: 5,
      })),
    })];
    const results = searchDocuments(docs, "searchable");
    expect(results.length).toBeLessThanOrEqual(8);
  });
});

describe("createExtractiveAnswer", () => {
  it("returns conversational answer for greetings", () => {
    const result = createExtractiveAnswer("Hello", []);
    expect(result.answer).toContain("Hi");
    expect(result.mode).toBe("extractive");
  });

  it("returns no-evidence message when no chunks match", () => {
    const result = createExtractiveAnswer("What is my tax liability?", []);
    expect(result.answer).toContain("I don");
    expect(result.citations.length).toBe(0);
  });

  it("returns evidence when chunks are provided", () => {
    const chunks = [
      {
        document: makeDoc({ title: "Tax Document" }),
        chunkId: "chunk-1",
        text: "Tax liability for FY 2025-26 is INR 1,92,400",
        score: 5.0,
      },
    ];
    const result = createExtractiveAnswer("What is my tax?", chunks);
    expect(result.answer).toContain("Tax Document");
    expect(result.citations.length).toBeGreaterThan(0);
  });
});
