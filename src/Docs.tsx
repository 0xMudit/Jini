import { useEffect } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bot,
  CheckCircle2,
  Database,
  FileText,
  KeyRound,
  LockKeyhole,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  UserRoundCheck,
} from "lucide-react";
import "./Docs.css";

const sections = [
  { id: "quick-start", label: "Quick start" },
  { id: "accounts", label: "Accounts" },
  { id: "documents", label: "Documents" },
  { id: "groq", label: "Groq AI" },
  { id: "api", label: "API reference" },
  { id: "security", label: "Security" },
];

function Docs() {
  useEffect(() => {
    const previous = document.title;
    document.title = "Jini Docs — Private Document Intelligence";
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <div className="docs-shell">
      <header className="docs-topbar">
        <a className="docs-brand" href="/">
          <span><ShieldCheck size={18} /></span>
          <strong>Jini</strong>
          <small>Docs</small>
        </a>
        <nav aria-label="Documentation actions">
          <a href="/"><ArrowLeft size={15} /> Back to app</a>
          <a className="docs-launch" href="/">Open Jini <ArrowRight size={15} /></a>
        </nav>
      </header>

      <div className="docs-layout">
        <aside className="docs-sidebar">
          <p>Get started</p>
          {sections.map((section) => <a href={`#${section.id}`} key={section.id}>{section.label}</a>)}
          <div className="docs-sidebar-note">
            <Sparkles size={16} />
            <span><strong>Local-first</strong><small>Your files stay on this machine.</small></span>
          </div>
        </aside>

        <main className="docs-content">
          <section className="docs-hero">
            <span className="docs-kicker"><BookOpen size={14} /> Jini documentation</span>
            <h1>From scattered files to answers you can act on.</h1>
            <p>Everything you need to run Jini, manage accounts, index documents, and generate grounded answers with Groq.</p>
            <div className="docs-hero-actions">
              <a className="primary-button" href="#quick-start">Start in 2 minutes <ArrowRight size={16} /></a>
              <a className="secondary-button" href="#api">Explore the API</a>
            </div>
          </section>

          <section className="docs-section" id="quick-start">
            <div className="docs-section-heading"><span><Sparkles size={18} /></span><div><small>01</small><h2>Quick start</h2></div></div>
            <p>Install dependencies, start both services, then open the local web app.</p>
            <CodeBlock>{`npm install\nnpm run dev\n# Web: http://localhost:5173\n# API: http://localhost:8788`}</CodeBlock>
            <div className="docs-callout"><CheckCircle2 size={17} /><p>The guest button creates a session and loads a ready-to-query demo vault automatically.</p></div>
          </section>

          <section className="docs-section" id="accounts">
            <div className="docs-section-heading"><span><UserRoundCheck size={18} /></span><div><small>02</small><h2>Accounts and workspaces</h2></div></div>
            <p>Jini supports email sign-up, sign-in, a seeded test account, and one-click guest access. Each account only sees its own documents and reminders.</p>
            <div className="docs-grid">
              <article><KeyRound size={18} /><h3>Test user</h3><code>test@jini.local</code><code>JiniTest123!</code></article>
              <article><UserRoundCheck size={18} /><h3>Guest user</h3><code>guest@jini.local</code><p>Use “Try live demo” for passwordless guest entry.</p></article>
            </div>
            <p className="docs-muted">Passwords are hashed with scrypt. Sessions are stored in SQLite and delivered through HttpOnly, SameSite cookies.</p>
          </section>

          <section className="docs-section" id="documents">
            <div className="docs-section-heading"><span><FileText size={18} /></span><div><small>03</small><h2>Document workflow</h2></div></div>
            <div className="docs-flow">
              <article><span>1</span><Upload size={19} /><h3>Upload</h3><p>PDF, DOCX, XLSX, CSV, TXT, Markdown, or JSON up to 25 MB each.</p></article>
              <article><span>2</span><Search size={19} /><h3>Index</h3><p>Jini extracts text, dates, amounts, tags, categories, and searchable chunks.</p></article>
              <article><span>3</span><Bot size={19} /><h3>Ask</h3><p>Retrieval selects evidence before Groq writes the final cited answer.</p></article>
            </div>
          </section>

          <section className="docs-section" id="groq">
            <div className="docs-section-heading"><span><Bot size={18} /></span><div><small>04</small><h2>Groq AI</h2></div></div>
            <p>Add your Groq key to <code>.env</code>. Only the retrieved snippets needed for an answer are sent to the model.</p>
            <CodeBlock>{`GROQ_API_KEY=gsk_your_key_here\nGROQ_MODEL=llama-3.3-70b-versatile`}</CodeBlock>
            <div className="docs-callout"><Sparkles size={17} /><p>Without a key, Jini keeps working in local extractive mode with search, citations, reminders, and insights.</p></div>
          </section>

          <section className="docs-section" id="api">
            <div className="docs-section-heading"><span><Database size={18} /></span><div><small>05</small><h2>API reference</h2></div></div>
            <div className="docs-api-list">
              <ApiRow method="POST" path="/api/auth/signup" detail="Create an account and session" />
              <ApiRow method="POST" path="/api/auth/login" detail="Authenticate with email and password" />
              <ApiRow method="POST" path="/api/auth/guest" detail="Enter the seeded guest workspace" />
              <ApiRow method="GET" path="/api/documents" detail="List documents owned by the current user" />
              <ApiRow method="POST" path="/api/documents" detail="Upload and index documents" />
              <ApiRow method="POST" path="/api/query" detail="Run retrieval and synthesize an answer" />
              <ApiRow method="GET" path="/api/reminders" detail="List the user’s extracted deadlines" />
              <ApiRow method="GET" path="/api/insights" detail="Read workspace aggregates" />
            </div>
          </section>

          <section className="docs-section" id="security">
            <div className="docs-section-heading"><span><LockKeyhole size={18} /></span><div><small>06</small><h2>Security model</h2></div></div>
            <div className="docs-checklist">
              <p><CheckCircle2 size={16} /> API keys never return to the browser.</p>
              <p><CheckCircle2 size={16} /> Every vault query is scoped to the authenticated owner.</p>
              <p><CheckCircle2 size={16} /> Session tokens are hashed before SQLite storage.</p>
              <p><CheckCircle2 size={16} /> Uploaded files and extracted text remain under the local data directory.</p>
            </div>
          </section>

          <footer className="docs-footer"><span>Built for private, evidence-first work.</span><a href="/">Open Jini <ArrowRight size={14} /></a></footer>
        </main>
      </div>
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return <pre className="docs-code"><code>{children}</code></pre>;
}

function ApiRow({ detail, method, path }: { detail: string; method: string; path: string }) {
  return <article><span>{method}</span><code>{path}</code><p>{detail}</p></article>;
}

export default Docs;
