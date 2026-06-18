import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen, ChevronRight, Loader2, LockKeyhole,
  LogOut, Menu, PlayCircle, RefreshCw, Settings, ShieldCheck, Sparkles, Upload, X,
} from "lucide-react";
import type { AuthUser, AISettings, BusyState, ChatMessage, DocumentCategory, Health, Insights, Notice, Reminder, SearchResult, VaultDocument, View, QueryResponse } from "./types";
import { navItems, viewCopy, starterQuestions } from "./types";
import { request, RequestError, getErrorMessage, getGreeting } from "./lib/api";
import { ProductTour } from "./components/ProductTour";
import { AuthScreen } from "./views/AuthScreen";
import { HomeView } from "./views/HomeView";
import { AssistantView } from "./views/AssistantView";
import { LibraryView } from "./views/LibraryView";
import { TimelineView } from "./views/TimelineView";
import { SettingsView } from "./views/SettingsView";
import "./Jini.css";

function Jini() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState("");
  const [activeView, setActiveView] = useState<View>("home");
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [aiSettings, setAISettings] = useState<AISettings>({
    configured: false, model: "llama-3.3-70b-versatile", source: "none", provider: "Groq",
  });
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory | "All">("All");
  const [question, setQuestion] = useState("");
  const [queryResponse, setQueryResponse] = useState<QueryResponse | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyState>("refresh");
  const [dragActive, setDragActive] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(
    () => window.localStorage.getItem("jini-tour-complete") !== "true",
  );
  const [tourStep, setTourStep] = useState(0);

  const selectedDocument = useMemo(
    () => documents.find((document) => document.id === selectedDocumentId) ?? documents[0] ?? null,
    [documents, selectedDocumentId],
  );

  const openReminders = useMemo(
    () => reminders.filter((reminder) => reminder.status === "open"),
    [reminders],
  );

  const hasDemoData = useMemo(
    () => documents.some((document) => document.storedName.startsWith("demo:")),
    [documents],
  );

  const hasPrivateDocuments = useMemo(
    () => documents.some((document) => !document.storedName.startsWith("demo:")),
    [documents],
  );

  const refreshAll = useCallback(async () => {
    setBusy((current) => current ?? "refresh");
    try {
      const [nextDocuments, nextReminders, nextInsights, nextHealth, nextAISettings] =
        await Promise.all([
          request<VaultDocument[]>("/api/documents"),
          request<Reminder[]>("/api/reminders"),
          request<Insights>("/api/insights"),
          request<Health>("/api/health"),
          request<AISettings>("/api/settings/ai"),
        ]);
      setDocuments(nextDocuments);
      setReminders(nextReminders);
      setInsights(nextInsights);
      setHealth(nextHealth);
      setAISettings(nextAISettings);
    } catch (error) {
      if (error instanceof RequestError && error.status === 401) {
        setCurrentUser(null);
        return;
      }
      setNotice({ tone: "error", message: getErrorMessage(error, "Unable to load Jini") });
    } finally {
      setBusy((current) => (current === "refresh" ? null : current));
    }
  }, []);

  const runSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const params = new URLSearchParams({ q: searchQuery, category: selectedCategory });
      setSearchResults(await request<SearchResult[]>(`/api/search?${params.toString()}`));
    } catch (error) {
      setNotice({ tone: "error", message: getErrorMessage(error, "Search failed") });
    }
  }, [searchQuery, selectedCategory]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    request<{ user: AuthUser }>("/api/auth/me", undefined, controller.signal)
      .then(async ({ user }) => {
        if (!active) return;
        setCurrentUser(user);
        await refreshAll();
      })
      .catch((error: unknown) => {
        if (active && (!(error instanceof RequestError) || error.status !== 401)) {
          setAuthError(getErrorMessage(error, "Could not connect to Jini"));
        }
      })
      .finally(() => {
        if (active) {
          setAuthChecked(true);
          setBusy(null);
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [refreshAll]);

  useEffect(() => {
    const timer = window.setTimeout(() => void runSearch(), 260);
    return () => window.clearTimeout(timer);
  }, [runSearch]);

  function navigate(view: View) {
    setActiveView(view);
    setMenuOpen(false);
  }

  async function authenticate(path: string, body?: object, loadDemo = false) {
    setBusy("auth");
    setAuthError("");
    try {
      const { user } = await request<{ user: AuthUser }>(path, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      setCurrentUser(user);
      if (loadDemo) await request("/api/demo/seed", { method: "POST" });
      await refreshAll();
    } catch (error) {
      setAuthError(getErrorMessage(error, "Authentication failed"));
    } finally {
      setBusy(null);
      setAuthChecked(true);
    }
  }

  async function signOut() {
    try {
      await request("/api/auth/logout", { method: "POST" });
    } finally {
      setCurrentUser(null);
      setDocuments([]);
      setReminders([]);
      setInsights(null);
      setQueryResponse(null);
      setChatMessages([]);
      setNotice(null);
      setActiveView("home");
    }
  }

  async function askQuestion(nextQuestion = question) {
    const trimmedQuestion = nextQuestion.trim();
    if (!trimmedQuestion || busy === "query") return;

    const history = chatMessages.slice(-8).map((message) => ({
      role: message.role,
      content: message.content.slice(0, 1600),
    }));
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmedQuestion,
    };

    setChatMessages((current) => [...current, userMessage]);
    setQuestion("");
    setActiveView("assistant");
    setBusy("query");
    setNotice(null);
    try {
      const response = await request<QueryResponse>("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmedQuestion, category: selectedCategory, history }),
      });
      setQueryResponse(response);
      setChatMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: response.answer,
          mode: response.mode,
          citations: response.citations,
          suggestedActions: response.suggestedActions,
        },
      ]);
    } catch (error) {
      setNotice({ tone: "error", message: getErrorMessage(error, "Jini could not answer") });
    } finally {
      setBusy(null);
    }
  }

  async function uploadFiles(files: FileList | File[]) {
    const fileList = Array.from(files);
    if (!fileList.length) return;
    const formData = new FormData();
    fileList.forEach((file) => formData.append("documents", file));
    setBusy("upload");
    setNotice(null);
    try {
      await request("/api/documents", { method: "POST", body: formData });
      setNotice({
        tone: "success",
        message: `${fileList.length} document${fileList.length === 1 ? "" : "s"} indexed and ready`,
      });
      setActiveView("library");
      await refreshAll();
    } catch (error) {
      setNotice({ tone: "error", message: getErrorMessage(error, "Upload failed") });
    } finally {
      setBusy(null);
      setDragActive(false);
    }
  }

  async function seedDemo() {
    setBusy("seed");
    setNotice(null);
    try {
      await request("/api/demo/seed", { method: "POST" });
      await refreshAll();
      setNotice({ tone: "success", message: "Guest workspace is ready. Try the question below." });
      await askQuestion(starterQuestions[0]);
    } catch (error) {
      setNotice({ tone: "error", message: getErrorMessage(error, "Could not load guest workspace") });
      setBusy(null);
    }
  }

  async function toggleReminder(reminder: Reminder) {
    try {
      await request<Reminder>(`/api/reminders/${reminder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: reminder.status === "open" ? "done" : "open" }),
      });
      await refreshAll();
    } catch (error) {
      setNotice({ tone: "error", message: getErrorMessage(error, "Reminder update failed") });
    }
  }

  async function removeDocument(documentId: string) {
    const document = documents.find((item) => item.id === documentId);
    if (!document || !window.confirm(`Delete "${document.title}" from this vault?`)) return;
    try {
      await request(`/api/documents/${documentId}`, { method: "DELETE" });
      setSelectedDocumentId(null);
      setNotice({ tone: "success", message: "Document removed" });
      await refreshAll();
    } catch (error) {
      setNotice({ tone: "error", message: getErrorMessage(error, "Delete failed") });
    }
  }

  async function saveAISettings(apiKey: string, model: string) {
    setBusy("settings");
    setNotice(null);
    try {
      const nextSettings = await request<AISettings>("/api/settings/ai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, model }),
      });
      setAISettings(nextSettings);
      setHealth((current) => (current ? { ...current, groq: true } : current));
      setNotice({ tone: "success", message: "Groq connected for this server session" });
    } catch (error) {
      setNotice({ tone: "error", message: getErrorMessage(error, "Could not save AI settings") });
    } finally {
      setBusy(null);
    }
  }

  async function clearAISettings() {
    setBusy("settings");
    try {
      const nextSettings = await request<AISettings>("/api/settings/ai", { method: "DELETE" });
      setAISettings(nextSettings);
      setHealth((current) => current ? { ...current, groq: nextSettings.configured } : current);
      setNotice({
        tone: "neutral",
        message: nextSettings.configured
          ? "Session key cleared. Environment configuration is still active."
          : "Session key cleared. Local extractive answers remain available.",
      });
    } catch (error) {
      setNotice({ tone: "error", message: getErrorMessage(error, "Could not clear AI settings") });
    } finally {
      setBusy(null);
    }
  }

  function openTour() {
    setTourStep(0);
    setTourOpen(true);
  }

  function closeTour() {
    window.localStorage.setItem("jini-tour-complete", "true");
    setTourOpen(false);
  }

  const onboardingSteps = [
    {
      label: "Explore a realistic vault",
      detail: "Use safe demo documents to see the full workflow.",
      done: hasDemoData,
      action: () => void seedDemo(),
      actionLabel: hasDemoData ? "Demo ready" : "Load demo",
    },
    {
      label: "Ask your first question",
      detail: "Get a grounded answer with the source attached.",
      done: Boolean(queryResponse),
      action: () => { navigate("assistant"); void askQuestion(); },
      actionLabel: queryResponse ? "Answer ready" : "Ask now",
    },
    {
      label: "Connect optional AI",
      detail: "Local retrieval works without a key. Connect for synthesized answers.",
      done: aiSettings.configured,
      action: () => navigate("settings"),
      actionLabel: aiSettings.configured ? "Connected" : "Open settings",
    },
  ];

  const currentView = activeView === "home"
    ? { ...viewCopy.home, title: getGreeting() }
    : viewCopy[activeView];

  if (!authChecked) {
    return (
      <div className="auth-shell auth-loading">
        <span className="auth-brand-mark"><ShieldCheck size={26} /></span>
        <Loader2 className="spin" size={22} />
        <p>Opening Jini...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <AuthScreen
        busy={busy === "auth"}
        error={authError}
        onGuest={() => authenticate("/api/auth/guest", undefined, true)}
        onTestUser={() => authenticate("/api/auth/login", { email: "test@jini.local", password: "JiniTest123!" }, true)}
        onSignIn={(email, password) => authenticate("/api/auth/login", { email, password })}
        onSignUp={(name, email, password) => authenticate("/api/auth/signup", { name, email, password })}
      />
    );
  }

  return (
    <div className="jini-shell">
      <aside className={menuOpen ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <div className="brand-mark" aria-hidden="true"><ShieldCheck size={20} /></div>
          <div className="brand-copy">
            <strong>Jini</strong>
            <span>Private Document Intelligence</span>
          </div>
          <button aria-label="Close navigation" className="icon-button mobile-close" onClick={() => setMenuOpen(false)} type="button"><X size={18} /></button>
        </div>

        <div className="workspace-pill">
          <span className="workspace-avatar">{currentUser.name.charAt(0).toUpperCase()}</span>
          <span>
            <strong>{currentUser.name}</strong>
            <small>{currentUser.role === "hr" ? "Test user workspace" : currentUser.email}</small>
          </span>
          <ChevronRight size={16} />
        </div>

        <nav className="nav-list" aria-label="Primary navigation">
          <span className="nav-label">Workspace</span>
          {navItems.map((item) => (
            <button
              className={activeView === item.id ? "nav-item active" : "nav-item"}
              key={item.id}
              onClick={() => navigate(item.id)}
              type="button"
            >
              <Sparkles size={17} />
              <span>{item.label}</span>
              {item.id === "timeline" && openReminders.length ? <small>{openReminders.length}</small> : null}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="nav-item" onClick={openTour} type="button"><PlayCircle size={17} /><span>Product tour</span></button>
          <button className={activeView === "settings" ? "nav-item active" : "nav-item"} onClick={() => navigate("settings")} type="button">
            <Settings size={17} /><span>Settings</span>
            <span aria-label={aiSettings.configured ? "AI connected" : "AI not connected"} className={aiSettings.configured ? "connection-dot connected" : "connection-dot"} />
          </button>
          <button className="nav-item" onClick={() => void signOut()} type="button"><LogOut size={17} /><span>Sign out</span></button>
          <a className="nav-item nav-link" href="/docs"><BookOpen size={17} /><span>Documentation</span></a>
          <div className="privacy-note"><LockKeyhole size={15} /><span>Documents stay on this machine</span></div>
        </div>
      </aside>

      {menuOpen ? (
        <button aria-label="Close navigation overlay" className="sidebar-scrim" onClick={() => setMenuOpen(false)} type="button" />
      ) : null}

      <main className="workspace">
        <header className="topbar">
          <div className="topbar-title">
            <button aria-label="Open navigation" className="icon-button menu-button" onClick={() => setMenuOpen(true)} type="button"><Menu size={18} /></button>
            <div>
              <p className="eyebrow">{currentView.eyebrow}</p>
              <h1>{currentView.title}</h1>
            </div>
          </div>
          <div className="topbar-actions">
            <span className="mode-badge">
              <span className={health?.groq ? "connection-dot connected" : "connection-dot"} />
              {health?.groq ? "Groq connected" : "Local mode"}
            </span>
            <button className="icon-button" onClick={() => void refreshAll()} title="Refresh workspace" type="button">
              {busy === "refresh" ? <Loader2 className="spin" size={17} /> : <RefreshCw size={17} />}
            </button>
            <label className="primary-button" htmlFor="global-upload">
              {busy === "upload" ? <Loader2 className="spin" size={17} /> : <Upload size={17} />}
              <span>Add documents</span>
            </label>
            <input accept=".pdf,.docx,.xlsx,.csv,.txt,.md,.json" id="global-upload" multiple onChange={(event) => { if (event.target.files) void uploadFiles(event.target.files); event.currentTarget.value = ""; }} type="file" />
          </div>
        </header>

        {notice ? (
          <div className={`notice ${notice.tone}`} role="status">
            {notice.tone === "success" ? <ShieldCheck size={17} /> : <X size={17} />}
            <span>{notice.message}</span>
            <button aria-label="Dismiss message" onClick={() => setNotice(null)} type="button"><X size={15} /></button>
          </div>
        ) : null}

        {activeView === "home" ? (
          <HomeView
            busy={busy}
            documents={documents}
            hasPrivateDocuments={hasPrivateDocuments}
            insights={insights}
            navigate={navigate}
            onboardingSteps={onboardingSteps}
            reminders={openReminders}
            seedDemo={seedDemo}
          />
        ) : null}

        {activeView === "assistant" ? (
          <AssistantView
            askQuestion={askQuestion}
            busy={busy}
            chatMessages={chatMessages}
            documents={documents}
            question={question}
            selectedCategory={selectedCategory}
            setQuestion={setQuestion}
            setSelectedCategory={setSelectedCategory}
          />
        ) : null}

        {activeView === "library" ? (
          <LibraryView
            busy={busy}
            documents={documents}
            dragActive={dragActive}
            removeDocument={removeDocument}
            results={searchResults}
            searchQuery={searchQuery}
            selectedCategory={selectedCategory}
            selectedDocument={selectedDocument}
            setDragActive={setDragActive}
            setSearchQuery={setSearchQuery}
            setSelectedCategory={setSelectedCategory}
            setSelectedDocumentId={setSelectedDocumentId}
            uploadFiles={uploadFiles}
          />
        ) : null}

        {activeView === "timeline" ? (
          <TimelineView reminders={reminders} toggleReminder={toggleReminder} />
        ) : null}

        {activeView === "settings" ? (
          <SettingsView
            aiSettings={aiSettings}
            busy={busy}
            clearAISettings={clearAISettings}
            saveAISettings={saveAISettings}
          />
        ) : null}
      </main>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navItems.map((item) => (
          <button className={activeView === item.id ? "active" : ""} key={item.id} onClick={() => navigate(item.id)} type="button">
            <Sparkles size={19} />
            <span>{item.label === "Ask Jini" ? "Ask" : item.label}</span>
          </button>
        ))}
      </nav>

      {tourOpen ? <ProductTour closeTour={closeTour} seedDemo={seedDemo} setTourStep={setTourStep} step={tourStep} /> : null}
    </div>
  );
}

export default Jini;
