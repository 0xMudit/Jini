import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Archive,
  ArrowRight,
  Bell,
  Bot,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  Database,
  Eye,
  EyeOff,
  FileText,
  Files,
  Home,
  KeyRound,
  Layers3,
  Loader2,
  LogIn,
  LogOut,
  LockKeyhole,
  Menu,
  MessageSquareText,
  PlayCircle,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  WalletCards,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import "./Jini.css";

type DocumentCategory =
  | "Identity"
  | "Insurance"
  | "Banking"
  | "Employment"
  | "Housing"
  | "Medical"
  | "Warranty"
  | "Tax"
  | "Education"
  | "Loan"
  | "Subscriptions"
  | "General";

type View = "home" | "assistant" | "library" | "timeline" | "settings";
type BusyState = "auth" | "refresh" | "upload" | "query" | "seed" | "settings" | null;

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "hr" | "guest" | "member";
}

interface ExtractedDate {
  id: string;
  label: string;
  isoDate: string;
  sourceText: string;
  confidence: number;
}

interface ExtractedAmount {
  id: string;
  amount: number;
  currency: "INR" | "UNKNOWN";
  sourceText: string;
}

interface VaultDocument {
  id: string;
  title: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  category: DocumentCategory;
  tags: string[];
  summary: string;
  dates: ExtractedDate[];
  amounts: ExtractedAmount[];
}

interface Reminder {
  id: string;
  documentId: string;
  documentTitle: string;
  title: string;
  dueDate: string;
  sourceText: string;
  category: string;
  status: "open" | "done";
  createdAt: string;
}

interface SearchResult {
  documentId: string;
  documentTitle: string;
  category: DocumentCategory;
  snippet: string;
  score: number;
}

interface QueryResponse {
  answer: string;
  mode: "llm" | "extractive";
  citations: Array<{
    documentId: string;
    documentTitle: string;
    category: DocumentCategory;
    chunkId: string;
    snippet: string;
    score: number;
  }>;
  suggestedActions: string[];
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode?: QueryResponse["mode"];
  citations?: QueryResponse["citations"];
  suggestedActions?: string[];
}

interface Insights {
  totals: {
    documents: number;
    chunks: number;
    reminders: number;
    extractedAmounts: number;
  };
  categoryCounts: Record<string, number>;
  highValuePayments: Array<{
    documentId: string;
    documentTitle: string;
    amount: number;
    amountLabel: string;
    sourceText: string;
  }>;
  subscriptions: Array<{
    documentId: string;
    documentTitle: string;
    amount: number;
    amountLabel: string;
    sourceText: string;
  }>;
  upcomingDates: Array<{
    documentId: string;
    documentTitle: string;
    label: string;
    isoDate: string;
    sourceText: string;
  }>;
  taxChecklist: Array<{
    label: string;
    present: boolean;
  }>;
}

interface Health {
  ok: boolean;
  service: string;
  groq: boolean;
}

interface AISettings {
  configured: boolean;
  model: string;
  source: "session" | "environment" | "none";
  provider: string;
}

interface Notice {
  tone: "success" | "error" | "neutral";
  message: string;
}

const categories: Array<DocumentCategory | "All"> = [
  "All",
  "Identity",
  "Insurance",
  "Banking",
  "Employment",
  "Housing",
  "Medical",
  "Warranty",
  "Tax",
  "Education",
  "Loan",
  "Subscriptions",
  "General",
];

const navItems: Array<{ id: View; label: string; icon: LucideIcon }> = [
  { id: "home", label: "Home", icon: Home },
  { id: "assistant", label: "Ask Jini", icon: Sparkles },
  { id: "library", label: "Library", icon: Files },
  { id: "timeline", label: "Timeline", icon: CalendarDays },
];

const starterQuestions = [
  "When does my bike insurance expire?",
  "What is my laptop warranty period?",
  "Summarize my rent agreement.",
  "Show payments above INR 5,000.",
  "Which subscriptions am I paying for?",
  "What is missing for tax filing?",
];

const viewCopy: Record<View, { eyebrow: string; title: string }> = {
  home: { eyebrow: "Private document intelligence", title: "Good evening" },
  assistant: { eyebrow: "Grounded answers with citations", title: "Ask Jini" },
  library: { eyebrow: "Your searchable document system", title: "Library" },
  timeline: { eyebrow: "Renewals, deadlines, and important dates", title: "Timeline" },
  settings: { eyebrow: "Connections and privacy", title: "Settings" },
};

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
    configured: false,
    model: "llama-3.3-70b-versatile",
    source: "none",
    provider: "Groq",
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
      const params = new URLSearchParams({
        q: searchQuery,
        category: selectedCategory,
      });
      setSearchResults(await request<SearchResult[]>(`/api/search?${params.toString()}`));
    } catch (error) {
      setNotice({ tone: "error", message: getErrorMessage(error, "Search failed") });
    }
  }, [searchQuery, selectedCategory]);

  useEffect(() => {
    let active = true;
    void request<{ user: AuthUser }>("/api/auth/me")
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
    };
  }, [refreshAll]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void runSearch();
    }, 260);
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
      setNotice({
        tone: "success",
        message: "Groq connected for this server session",
      });
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
      setHealth((current) =>
        current ? { ...current, groq: nextSettings.configured } : current,
      );
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
      action: () => {
        navigate("assistant");
        void askQuestion();
      },
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

  const currentView =
    activeView === "home"
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
          <div className="brand-mark" aria-hidden="true">
            <ShieldCheck size={20} />
          </div>
          <div className="brand-copy">
            <strong>Jini</strong>
            <span>Private Document Intelligence</span>
          </div>
          <button
            aria-label="Close navigation"
            className="icon-button mobile-close"
            onClick={() => setMenuOpen(false)}
            type="button"
          >
            <X size={18} />
          </button>
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
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={activeView === item.id ? "nav-item active" : "nav-item"}
                key={item.id}
                onClick={() => navigate(item.id)}
                type="button"
              >
                <Icon size={17} />
                <span>{item.label}</span>
                {item.id === "timeline" && openReminders.length ? (
                  <small>{openReminders.length}</small>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button className="nav-item" onClick={openTour} type="button">
            <PlayCircle size={17} />
            <span>Product tour</span>
          </button>
          <button
            className={activeView === "settings" ? "nav-item active" : "nav-item"}
            onClick={() => navigate("settings")}
            type="button"
          >
            <Settings size={17} />
            <span>Settings</span>
            <span
              aria-label={aiSettings.configured ? "AI connected" : "AI not connected"}
              className={aiSettings.configured ? "connection-dot connected" : "connection-dot"}
            />
          </button>
          <button className="nav-item" onClick={() => void signOut()} type="button">
            <LogOut size={17} />
            <span>Sign out</span>
          </button>
          <a className="nav-item nav-link" href="/docs">
            <BookOpen size={17} />
            <span>Documentation</span>
          </a>
          <div className="privacy-note">
            <LockKeyhole size={15} />
            <span>Documents stay on this machine</span>
          </div>
        </div>
      </aside>

      {menuOpen ? (
        <button
          aria-label="Close navigation overlay"
          className="sidebar-scrim"
          onClick={() => setMenuOpen(false)}
          type="button"
        />
      ) : null}

      <main className="workspace">
        <header className="topbar">
          <div className="topbar-title">
            <button
              aria-label="Open navigation"
              className="icon-button menu-button"
              onClick={() => setMenuOpen(true)}
              type="button"
            >
              <Menu size={18} />
            </button>
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
            <button
              className="icon-button"
              onClick={() => void refreshAll()}
              title="Refresh workspace"
              type="button"
            >
              {busy === "refresh" ? <Loader2 className="spin" size={17} /> : <RefreshCw size={17} />}
            </button>
            <label className="primary-button" htmlFor="global-upload">
              {busy === "upload" ? <Loader2 className="spin" size={17} /> : <Upload size={17} />}
              <span>Add documents</span>
            </label>
            <input
              accept=".pdf,.docx,.xlsx,.csv,.txt,.md,.json"
              id="global-upload"
              multiple
              onChange={(event) => {
                if (event.target.files) void uploadFiles(event.target.files);
                event.currentTarget.value = "";
              }}
              type="file"
            />
          </div>
        </header>

        {notice ? (
          <div className={`notice ${notice.tone}`} role="status">
            {notice.tone === "success" ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
            <span>{notice.message}</span>
            <button aria-label="Dismiss message" onClick={() => setNotice(null)} type="button">
              <X size={15} />
            </button>
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
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              className={activeView === item.id ? "active" : ""}
              key={item.id}
              onClick={() => navigate(item.id)}
              type="button"
            >
              <Icon size={19} />
              <span>{item.label === "Ask Jini" ? "Ask" : item.label}</span>
            </button>
          );
        })}
      </nav>

      {tourOpen ? (
        <ProductTour
          closeTour={closeTour}
          seedDemo={seedDemo}
          setTourStep={setTourStep}
          step={tourStep}
        />
      ) : null}
    </div>
  );
}

function AuthScreen({
  busy,
  error,
  onGuest,
  onTestUser,
  onSignIn,
  onSignUp,
}: {
  busy: boolean;
  error: string;
  onGuest: () => Promise<void>;
  onTestUser: () => Promise<void>;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (name: string, email: string, password: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="auth-shell">
      <section className="auth-intro">
        <div className="auth-brand">
          <span className="auth-brand-mark"><ShieldCheck size={24} /></span>
          <span><strong>Jini</strong><small>Private Document Intelligence</small></span>
        </div>
        <div className="auth-copy">
          <p className="eyebrow">Your private knowledge workspace</p>
          <h1>Documents in. Clear answers out.</h1>
          <p>Search policies, statements, agreements, and personal records with grounded Groq-powered answers.</p>
        </div>
        <div className="auth-trust">
          <span><LockKeyhole size={16} /> Local, isolated workspaces</span>
          <span><Sparkles size={16} /> Fast Groq inference</span>
          <span><Database size={16} /> SQLite account security</span>
        </div>
      </section>

      <main className="auth-panel">
        <section className="auth-card">
          <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
            <button className={mode === "signin" ? "active" : ""} onClick={() => setMode("signin")} type="button">Sign in</button>
            <button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")} type="button">Create account</button>
          </div>

          <div className="auth-card-heading">
            <h2>{mode === "signin" ? "Welcome back" : "Create your workspace"}</h2>
            <p>{mode === "signin" ? "Sign in to continue to your private vault." : "Your documents will be isolated from every other account."}</p>
          </div>

          {error ? <div className="auth-error" role="alert"><AlertCircle size={16} /><span>{error}</span></div> : null}

          <form
            className="auth-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (mode === "signin") void onSignIn(email, password);
              else void onSignUp(name, email, password);
            }}
          >
            {mode === "signup" ? (
              <label>
                <span>Full name</span>
                <input autoComplete="name" minLength={2} onChange={(event) => setName(event.target.value)} placeholder="Your name" required value={name} />
              </label>
            ) : null}
            <label>
              <span>Email address</span>
              <input autoComplete="email" onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" required type="email" value={email} />
            </label>
            <label>
              <span>Password</span>
              <div className="auth-password-field">
                <input autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={mode === "signup" ? 8 : undefined} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" required type={showPassword ? "text" : "password"} value={password} />
                <button aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((current) => !current)} type="button">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
            <button className="primary-button auth-submit" disabled={busy} type="submit">
              {busy ? <Loader2 className="spin" size={17} /> : mode === "signin" ? <LogIn size={17} /> : <UserPlus size={17} />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div className="auth-divider"><span>or use a ready workspace</span></div>
          <div className="auth-demo-actions">
            <button className="secondary-button" disabled={busy} onClick={() => void onTestUser()} type="button">Test user</button>
            <button className="secondary-button" disabled={busy} onClick={() => void onGuest()} type="button">Try live demo</button>
          </div>
          <p className="auth-test-hint">Test user login: <code>test@jini.local</code> / <code>JiniTest123!</code></p>
          <a className="auth-docs-link" href="/docs"><BookOpen size={14} /> Read the docs</a>
        </section>
      </main>
    </div>
  );
}

function HomeView({
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
          <p>
            Find policies, deadlines, payments, warranties, and tax records without
            opening files one by one.
          </p>
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
            <div className="progress-ring">
              {completedSteps}/3
            </div>
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
              <EmptyState
                detail="Important dates appear here after documents are indexed."
                icon={CalendarDays}
                title="Nothing urgent"
              />
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
                <span className="file-icon">
                  <FileText size={17} />
                </span>
                <span>
                  <strong>{document.title}</strong>
                  <small>{document.category} · {formatDate(document.uploadedAt)}</small>
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
            {!documents.length ? (
              <EmptyState
                detail="Load the guest workspace or add a file to begin."
                icon={Files}
                title="No documents yet"
              />
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

function AssistantView({
  askQuestion,
  busy,
  chatMessages,
  documents,
  question,
  selectedCategory,
  setQuestion,
  setSelectedCategory,
}: {
  askQuestion: (question?: string) => Promise<void>;
  busy: BusyState;
  chatMessages: ChatMessage[];
  documents: VaultDocument[];
  question: string;
  selectedCategory: DocumentCategory | "All";
  setQuestion: (question: string) => void;
  setSelectedCategory: (category: DocumentCategory | "All") => void;
}) {
  const threadRef = useRef<HTMLDivElement | null>(null);
  const hasConversation = chatMessages.length > 0;
  const documentCountLabel = `${documents.length} indexed document${documents.length === 1 ? "" : "s"}`;
  const categoryLabel = selectedCategory === "All" ? "All documents" : selectedCategory;

  useEffect(() => {
    threadRef.current?.scrollTo({
      top: threadRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [busy, chatMessages.length]);

  return (
    <div className="assistant-layout">
      <section className="assistant-main surface">
        <div className="assistant-intro">
          <span className="assistant-mark"><Sparkles size={20} /></span>
          <div className="assistant-title-copy">
            <p className="assistant-kicker">Jini assistant</p>
            <h2>Chat with Jini</h2>
            <p>Ask follow-up questions. Jini uses Groq with your indexed document evidence and citations.</p>
          </div>
        </div>

        <div className="assistant-context-bar" aria-label="Assistant context">
          <span><Database size={14} />{documentCountLabel}</span>
          <span><BookOpen size={14} />{categoryLabel}</span>
          <span><ShieldCheck size={14} />Citations on</span>
        </div>

        <div className="answer-area" aria-live="polite">
          <div className="chat-thread" ref={threadRef}>
            {!hasConversation && busy !== "query" ? (
              <div className="chat-empty-state">
                <MessageSquareText size={24} />
                <strong>What can I help you find?</strong>
                <span>
                  {documents.length
                    ? "Start with a prompt or type your own question below."
                    : "Load demo documents or add your own to begin."}
                </span>
                <div className="starter-grid">
                  {starterQuestions.map((starterQuestion) => (
                    <button key={starterQuestion} onClick={() => void askQuestion(starterQuestion)} type="button">
                      <span>{starterQuestion}</span>
                      <ArrowRight size={15} />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {chatMessages.map((message) => (
              <article className={`chat-message ${message.role}`} key={message.id}>
                <span className="chat-avatar" aria-hidden="true">
                  {message.role === "assistant" ? <Bot size={16} /> : "Y"}
                </span>
                <div className="chat-stack">
                  <div className="chat-label">
                    {message.role === "assistant" ? <Bot size={14} /> : <MessageSquareText size={14} />}
                    <span>{message.role === "assistant" ? "Jini" : "You"}</span>
                  </div>
                  <div className="chat-bubble">
                    <div className="chat-copy">{message.content}</div>
                  </div>
                  {message.role === "assistant" && message.citations?.length ? (
                    <div className="message-citations">
                      <span>Cited sources</span>
                      {message.citations.slice(0, 3).map((citation, index) => (
                        <small key={citation.chunkId}>
                          [{index + 1}] {citation.documentTitle}
                        </small>
                      ))}
                    </div>
                  ) : null}
                  {message.role === "assistant" && message.suggestedActions?.length ? (
                    <div className="reply-tools">
                      <span>Try next</span>
                      <div>
                        {message.suggestedActions.map((action) => (
                          <button
                            disabled={busy === "query"}
                            key={action}
                            onClick={() => void askQuestion(action)}
                            type="button"
                          >
                            {action}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}

            {busy === "query" ? (
              <article className="chat-message assistant">
                <span className="chat-avatar" aria-hidden="true">
                  <Bot size={16} />
                </span>
                <div className="chat-stack">
                  <div className="chat-label">
                    <Bot size={14} />
                    <span>Jini</span>
                  </div>
                  <div className="chat-bubble thinking-bubble">
                    <Loader2 className="spin" size={18} />
                    <span>
                      <strong>Jini is searching your vault</strong>
                      <small>Ranking evidence and sending the grounded context to Groq...</small>
                    </span>
                  </div>
                </div>
              </article>
            ) : null}
          </div>
        </div>

        <div className="prompt-composer">
          <textarea
            aria-label="Ask a question about your documents"
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void askQuestion();
              }
            }}
            placeholder="Ask about a deadline, payment, policy, agreement, or document..."
            rows={3}
            value={question}
          />
          <div className="composer-footer">
            <div className="composer-left">
              <select
                aria-label="Limit answer to a category"
                onChange={(event) =>
                  setSelectedCategory(event.target.value as DocumentCategory | "All")
                }
                value={selectedCategory}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>{category === "All" ? "All documents" : category}</option>
                ))}
              </select>
              <span>Shift + Enter for a new line</span>
            </div>
            <button
              className="primary-button"
              disabled={busy === "query" || !question.trim()}
              onClick={() => void askQuestion()}
              type="button"
            >
              {busy === "query" ? <Loader2 className="spin" size={17} /> : <Sparkles size={17} />}
              Ask Jini
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function LibraryView({
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
        onDragEnter={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragActive(false);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void uploadFiles(event.dataTransfer.files);
        }}
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
            <button aria-label="Clear search" onClick={() => setSearchQuery("")} type="button">
              <X size={15} />
            </button>
          ) : null}
        </div>
        <select
          aria-label="Filter documents by category"
          onChange={(event) => setSelectedCategory(event.target.value as DocumentCategory | "All")}
          value={selectedCategory}
        >
          {categories.map((category) => (
            <option key={category} value={category}>{category === "All" ? "All categories" : category}</option>
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
                icon={Files}
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

function TimelineView({
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

function SettingsView({
  aiSettings,
  busy,
  clearAISettings,
  saveAISettings,
}: {
  aiSettings: AISettings;
  busy: BusyState;
  clearAISettings: () => Promise<void>;
  saveAISettings: (apiKey: string, model: string) => Promise<void>;
}) {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(aiSettings.model);
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="settings-layout">
      <section className="surface settings-main">
        <SectionHeading
          icon={KeyRound}
          subtitle="Optional: local retrieval works without an API key"
          title="AI connection"
        />

        <div className={aiSettings.configured ? "connection-status connected" : "connection-status"}>
          <span className="status-icon">{aiSettings.configured ? <CheckCircle2 size={20} /> : <Bot size={20} />}</span>
          <span>
            <strong>{aiSettings.configured ? "Groq is connected" : "Using local extractive mode"}</strong>
            <small>
              {aiSettings.configured
                ? `Source: ${aiSettings.source === "environment" ? ".env file" : "this server session"} · Model: ${aiSettings.model}`
                : "Search, citations, reminders, and document extraction still work."}
            </small>
          </span>
        </div>

        <form
          className="settings-form"
          onSubmit={(event) => {
            event.preventDefault();
            void saveAISettings(apiKey, model);
          }}
        >
          <label htmlFor="groq-key">Groq API key</label>
          <div className="secret-field">
            <KeyRound size={17} />
            <input
              autoComplete="off"
              id="groq-key"
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="gsk_..."
              type={showKey ? "text" : "password"}
              value={apiKey}
            />
            <button
              aria-label={showKey ? "Hide API key" : "Show API key"}
              onClick={() => setShowKey((current) => !current)}
              title={showKey ? "Hide API key" : "Show API key"}
              type="button"
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <span className="field-help">
            Stored in server memory only and cleared when the API server stops.
          </span>

          <label htmlFor="groq-model">Model</label>
          <input
            id="groq-model"
            onChange={(event) => setModel(event.target.value)}
            placeholder="llama-3.3-70b-versatile"
            value={model}
          />

          <div className="settings-actions">
            <button
              className="primary-button"
              disabled={busy === "settings" || apiKey.trim().length < 20}
              type="submit"
            >
              {busy === "settings" ? <Loader2 className="spin" size={17} /> : <KeyRound size={17} />}
              Connect Groq
            </button>
            {aiSettings.source === "session" ? (
              <button className="secondary-button" onClick={() => void clearAISettings()} type="button">
                Disconnect session key
              </button>
            ) : null}
          </div>
        </form>

        <div className="persistent-setup">
          <div>
            <strong>Persistent local setup</strong>
            <p>Add these values to <code>.env</code> in the project root, then restart the app.</p>
          </div>
          <pre>GROQ_API_KEY=your_key_here{"\n"}GROQ_MODEL={model || "llama-3.3-70b-versatile"}</pre>
        </div>
      </section>

      <aside className="surface privacy-panel">
        <SectionHeading icon={ShieldCheck} subtitle="Designed for local use" title="Privacy model" />
        <div className="privacy-list">
          <div><CheckCircle2 size={17} /><span><strong>Local document store</strong><small>Files and extracted text stay under this project&apos;s data directory.</small></span></div>
          <div><CheckCircle2 size={17} /><span><strong>No key exposed in the UI</strong><small>The browser never receives a saved API key back from the server.</small></span></div>
          <div><CheckCircle2 size={17} /><span><strong>Evidence-first answers</strong><small>Only retrieved citation text is sent for AI synthesis.</small></span></div>
          <div><CheckCircle2 size={17} /><span><strong>Useful without AI</strong><small>Local search and extractive answers remain available.</small></span></div>
        </div>
      </aside>
    </div>
  );
}

function ProductTour({
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
  const steps = [
    {
      icon: ShieldCheck,
      eyebrow: "Welcome to Jini",
      title: "Your paperwork just became searchable.",
      detail: "In under a minute, you’ll see Jini find a real deadline, answer a question, and show the exact source.",
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
              <button className="secondary-button" onClick={() => setTourStep(step - 1)} type="button">
                Back
              </button>
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

function ReminderRow({
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

function SectionHeading({
  action,
  icon: Icon,
  onAction,
  subtitle,
  title,
}: {
  action?: string;
  icon: LucideIcon;
  onAction?: () => void;
  subtitle: string;
  title: string;
}) {
  return (
    <div className="section-heading">
      <span className="section-icon"><Icon size={17} /></span>
      <span>
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
      {action && onAction ? (
        <button onClick={onAction} type="button">{action}<ChevronRight size={14} /></button>
      ) : null}
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <article className="metric">
      <span><Icon size={18} /></span>
      <div><strong>{value}</strong><small>{label}</small></div>
    </article>
  );
}

function EmptyState({
  detail,
  icon: Icon,
  title,
}: {
  detail: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className="empty-state">
      <Icon size={22} />
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

class RequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "RequestError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, credentials: "include" });
  if (!response.ok) {
    const body = await response.text();
    let message = body || `Request failed: ${response.status}`;
    try {
      const parsed = JSON.parse(body) as { error?: string };
      message = parsed.error || message;
    } catch {
      // Keep the plain-text response as the error message.
    }
    throw new RequestError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatDate(value: string) {
  try {
    return format(parseISO(value), "dd MMM yyyy");
  } catch {
    return value.slice(0, 10);
  }
}

function relativeDate(value: string) {
  try {
    return formatDistanceToNow(parseISO(value), { addSuffix: true });
  } catch {
    return "";
  }
}

function formatINR(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default Jini;
