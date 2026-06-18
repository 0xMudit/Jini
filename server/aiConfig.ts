const DEFAULT_MODEL = "llama-3.3-70b-versatile";

let sessionApiKey: string | null = null;
let sessionModel: string | null = null;

export function getGroqConfig() {
  const apiKey = sessionApiKey ?? process.env.GROQ_API_KEY ?? null;
  const model = sessionModel ?? process.env.GROQ_MODEL ?? DEFAULT_MODEL;
  const source = sessionApiKey
    ? "session"
    : process.env.GROQ_API_KEY
      ? "environment"
      : "none";

  return {
    apiKey,
    model,
    configured: Boolean(apiKey),
    source,
  };
}

export function getPublicAISettings() {
  const config = getGroqConfig();
  return {
    configured: config.configured,
    model: config.model,
    source: config.source,
    provider: "Groq",
  };
}

export function setSessionGroqConfig(apiKey: string, model: string) {
  sessionApiKey = apiKey.trim();
  sessionModel = model.trim() || DEFAULT_MODEL;
  return getPublicAISettings();
}

export function clearSessionGroqConfig() {
  sessionApiKey = null;
  sessionModel = null;
  return getPublicAISettings();
}
