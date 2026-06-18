import { FileText, Loader2, Search, Trash2, Upload, X } from "lucide-react";
import type { BusyState, DocumentCategory, VaultDocument, SearchResult } from "../types";
import { categories } from "../types";
import { EmptyState } from "../components/EmptyState";
import { formatDate, formatFileSize, formatINR } from "../lib/api";

export function LibraryView({
  busy,
  documents,
  dragActive,
  removeDocument,
  results,
  searchQuery,
  selectedCategory,
  selectedDocument,
  setDragActive,
  setSearchQuery,
  setSelectedCategory,
  setSelectedDocumentId,
  uploadFiles,
}: {
  busy: BusyState;
  documents: VaultDocument[];
  dragActive: boolean;
  removeDocument: (documentId: string) => Promise<void>;
  results: SearchResult[];
  searchQuery: string;
  selectedCategory: DocumentCategory | "All";
  selectedDocument: VaultDocument | null;
  setDragActive: (active: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: DocumentCategory | "All") => void;
  setSelectedDocumentId: (documentId: string) => void;
  uploadFiles: (files: FileList | File[]) => Promise<void>;
}) {
  const visibleDocuments = searchQuery.trim()
    ? Array.from(
        new Map(
          results
            .map((result) => documents.find((document) => document.id === result.documentId))
            .filter((document): document is VaultDocument => Boolean(document))
            .map((document) => [document.id, document]),
        ).values(),
      )
    : selectedCategory === "All"
      ? documents
      : documents.filter((document) => document.category === selectedCategory);

  return (
    <div className="library-stack">
      <section
        className={dragActive ? "upload-strip active" : "upload-strip"}
        onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
        onDragLeave={(event) => { event.preventDefault(); setDragActive(false); }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); void uploadFiles(event.dataTransfer.files); }}
      >
        <Upload size={19} />
        <span>
          <strong>Drop documents anywhere in this area</strong>
          <small>PDF, DOCX, XLSX, CSV, TXT, MD, or JSON · up to 25 MB each</small>
        </span>
        <label className="secondary-button" htmlFor="library-upload">
          {busy === "upload" ? <Loader2 className="spin" size={16} /> : <Upload size={16} />}
          Choose files
        </label>
        <input
          accept=".pdf,.docx,.xlsx,.csv,.txt,.md,.json"
          id="library-upload"
          multiple
          onChange={(event) => {
            if (event.target.files) void uploadFiles(event.target.files);
            event.currentTarget.value = "";
          }}
          type="file"
        />
      </section>

      <div className="library-toolbar">
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label="Search document contents"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search titles, categories, or document text..."
            value={searchQuery}
          />
          {searchQuery ? (
            <button aria-label="Clear search" onClick={() => setSearchQuery("")} type="button"><X size={15} /></button>
          ) : null}
        </div>
        <select
          aria-label="Filter documents by category"
          onChange={(event) => setSelectedCategory(event.target.value as DocumentCategory | "All")}
          value={selectedCategory}
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat === "All" ? "All categories" : cat}</option>
          ))}
        </select>
        <span className="result-count">{visibleDocuments.length} document{visibleDocuments.length === 1 ? "" : "s"}</span>
      </div>

      <div className="library-layout">
        <section className="surface document-list-panel">
          <div className="document-list">
            {visibleDocuments.map((document) => (
              <button
                className={selectedDocument?.id === document.id ? "document-row active" : "document-row"}
                key={document.id}
                onClick={() => setSelectedDocumentId(document.id)}
                type="button"
              >
                <span className="file-icon"><FileText size={17} /></span>
                <span>
                  <strong>{document.title}</strong>
                  <small>{document.originalName} · {formatFileSize(document.size)}</small>
                </span>
                <em>{document.category}</em>
              </button>
            ))}
            {!visibleDocuments.length ? (
              <EmptyState
                detail={searchQuery ? "Try a broader search or another category." : "Add a document or load the demo workspace."}
                icon={FileText}
                title={searchQuery ? "No matching documents" : "Your library is empty"}
              />
            ) : null}
          </div>
        </section>

        <section className="surface document-detail">
          {selectedDocument ? (
            <>
              <div className="detail-heading">
                <span className="large-file-icon"><FileText size={22} /></span>
                <div>
                  <span className="category-label">{selectedDocument.category}</span>
                  <h2>{selectedDocument.title}</h2>
                  <p>{selectedDocument.originalName} · Indexed {formatDate(selectedDocument.uploadedAt)}</p>
                </div>
                <button
                  aria-label={`Delete ${selectedDocument.title}`}
                  className="danger-icon"
                  onClick={() => void removeDocument(selectedDocument.id)}
                  title="Delete document"
                  type="button"
                >
                  <Trash2 size={17} />
                </button>
              </div>

              <div className="detail-stats">
                <span><strong>{selectedDocument.dates.length}</strong><small>dates found</small></span>
                <span><strong>{selectedDocument.amounts.length}</strong><small>amounts found</small></span>
                <span><strong>{selectedDocument.tags.length}</strong><small>tags applied</small></span>
              </div>

              <div className="detail-section">
                <h3>Document summary</h3>
                <p className="summary">{selectedDocument.summary}</p>
              </div>

              <div className="tag-row">
                {selectedDocument.tags.map((tag) => <span key={tag}>{tag}</span>)}
              </div>

              <div className="detail-columns">
                <div className="detail-section">
                  <h3>Important dates</h3>
                  <div className="fact-list">
                    {selectedDocument.dates.slice(0, 5).map((date) => (
                      <div key={date.id}>
                        <span>
                          <strong>{date.label}</strong>
                          <small>{date.sourceText}</small>
                        </span>
                        <em>{formatDate(date.isoDate)}</em>
                      </div>
                    ))}
                    {!selectedDocument.dates.length ? <p className="muted-copy">No dates detected.</p> : null}
                  </div>
                </div>
                <div className="detail-section">
                  <h3>Detected amounts</h3>
                  <div className="fact-list">
                    {selectedDocument.amounts.slice(0, 5).map((amount) => (
                      <div key={amount.id}>
                        <span>
                          <strong>{formatINR(amount.amount)}</strong>
                          <small>{amount.sourceText}</small>
                        </span>
                      </div>
                    ))}
                    {!selectedDocument.amounts.length ? <p className="muted-copy">No amounts detected.</p> : null}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <EmptyState detail="Choose a document to inspect its extracted details." icon={FileText} title="No document selected" />
          )}
        </section>
      </div>
    </div>
  );
}
