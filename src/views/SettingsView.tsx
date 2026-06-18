import { useState } from "react";
import {
  Bot, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, ShieldCheck,
} from "lucide-react";
import type { BusyState, AISettings } from "../types";
import { SectionHeading } from "../components/SectionHeading";

export function SettingsView({
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
          <span className="field-help">Stored in server memory only and cleared when the API server stops.</span>

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
          <div><CheckCircle2 size={17} /><span><strong>Local document store</strong><small>Files and extracted text stay under this project's data directory.</small></span></div>
          <div><CheckCircle2 size={17} /><span><strong>No key exposed in the UI</strong><small>The browser never receives a saved API key back from the server.</small></span></div>
          <div><CheckCircle2 size={17} /><span><strong>Evidence-first answers</strong><small>Only retrieved citation text is sent for AI synthesis.</small></span></div>
          <div><CheckCircle2 size={17} /><span><strong>Useful without AI</strong><small>Local search and extractive answers remain available.</small></span></div>
        </div>
      </aside>
    </div>
  );
}
