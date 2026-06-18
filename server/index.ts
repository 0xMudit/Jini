import "dotenv/config";
import compression from "compression";
import cors from "cors";
import express from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import { rm } from "node:fs/promises";
import path from "node:path";
import { pino } from "pino";
import { z } from "zod";
import {
  clearSessionGroqConfig,
  getPublicAISettings,
  setSessionGroqConfig,
} from "./aiConfig";
import {
  authenticateCredentials,
  createUser,
  endSession,
  getAuthenticatedUser,
  getGuestUser,
  initializeAuthDatabase,
  startSession,
  type PublicUser,
} from "./auth";
import { extractTextFromFile } from "./extractors";
import { createDocumentFromText } from "./ingest";
import { buildInsights } from "./insights";
import { answerWithGroq } from "./llm";
import { createExtractiveAnswer, searchDocuments } from "./rag";
import { createSampleDocuments } from "./sampleData";
import { createRateLimiter, securityHeaders } from "./security";
import {
  addDocuments,
  deleteDocument,
  ensureDataDirs,
  getDocument,
  listDocuments,
  listReminders,
  projectRoot,
  replaceDemoDocuments,
  updateReminderStatus,
  uploadsDir,
} from "./storage";

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});

await ensureDataDirs();
initializeAuthDatabase();

const app = express();
const port = Number(process.env.PORT ?? 8788);
const allowedUploadExtensions = new Set([".pdf", ".docx", ".xlsx", ".csv", ".txt", ".md", ".json"]);
const upload = multer({
  dest: uploadsDir,
  fileFilter(_request, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    if (allowedUploadExtensions.has(extension)) {
      callback(null, true);
      return;
    }
    callback(new Error("Unsupported file type. Upload PDF, DOCX, XLSX, CSV, TXT, Markdown, or JSON."));
  },
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 12,
  },
});

if (process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}

app.disable("x-powered-by");
app.use(compression());
app.use(securityHeaders);
app.use((request, response, next) => {
  const requestId = request.header("x-request-id") || nanoid(10);
  response.locals.requestId = requestId;
  response.setHeader("X-Request-Id", requestId);
  const start = Date.now();
  response.on("finish", () => {
    logger.info(
      {
        method: request.method,
        path: request.path,
        status: response.statusCode,
        duration: Date.now() - start,
        requestId,
      },
      "Request completed",
    );
  });
  next();
});
app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      const isLocalOrigin =
        !origin ||
        /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(origin) ||
        allowedOrigins.includes(origin);
      callback(null, isLocalOrigin);
    },
  }),
);
app.use("/api/auth", createRateLimiter({ name: "auth", windowMs: 15 * 60 * 1000, max: 60 }));
app.use("/api", createRateLimiter({ name: "api", windowMs: 60 * 1000, max: 240 }));
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_request, response) => {
  const aiSettings = getPublicAISettings();
  response.json({
    ok: true,
    service: "Jini",
    version: "0.1.0",
    uptime: process.uptime(),
    groq: aiSettings.configured,
    aiProvider: aiSettings.configured ? "Groq" : null,
    mode: aiSettings.configured ? "hybrid" : "local",
  });
});

app.post("/api/auth/signup", (request, response, next) => {
  try {
    const body = z
      .object({
        name: z.string().trim().min(2, "Enter your name").max(80),
        email: z.email("Enter a valid email address"),
        password: z.string().min(8, "Password must be at least 8 characters").max(128),
      })
      .parse(request.body);
    const user = createUser(body.name, body.email, body.password);
    startSession(user.id, response);
    response.status(201).json({ user });
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      response.status(409).json({ error: "An account with this email already exists" });
      return;
    }
    next(error);
  }
});

app.post("/api/auth/login", (request, response, next) => {
  try {
    const body = z
      .object({ email: z.email("Enter a valid email address"), password: z.string().min(1) })
      .parse(request.body);
    const user = authenticateCredentials(body.email, body.password);
    if (!user) {
      response.status(401).json({ error: "Incorrect email or password" });
      return;
    }
    startSession(user.id, response);
    response.json({ user });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/guest", (_request, response) => {
  const user = getGuestUser();
  startSession(user.id, response);
  response.json({ user });
});

app.get("/api/auth/me", (request, response) => {
  const user = getAuthenticatedUser(request);
  if (!user) {
    response.status(401).json({ error: "Authentication required" });
    return;
  }
  response.json({ user });
});

app.post("/api/auth/logout", (request, response) => {
  endSession(request, response);
  response.status(204).end();
});

app.use("/api", (request, response, next) => {
  const user = getAuthenticatedUser(request);
  if (!user) {
    response.status(401).json({ error: "Authentication required" });
    return;
  }
  response.locals.user = user;
  next();
});

app.get("/api/settings/ai", (_request, response) => {
  response.json(getPublicAISettings());
});

app.put("/api/settings/ai", (request, response, next) => {
  try {
    const body = z
      .object({
        apiKey: z.string().trim().min(20, "Enter a valid Groq API key"),
        model: z.string().trim().min(2).default("llama-3.3-70b-versatile"),
      })
      .parse(request.body);

    response.json(setSessionGroqConfig(body.apiKey, body.model));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/settings/ai", (_request, response) => {
  response.json(clearSessionGroqConfig());
});

app.get("/api/documents", async (_request, response, next) => {
  try {
    const documents = await listDocuments(currentUser(response).id);
    response.json(documents.map((document) => ({ ...document, extractedText: undefined, chunks: undefined })));
  } catch (error) {
    next(error);
  }
});

app.get("/api/documents/:id", async (request, response, next) => {
  try {
    const document = await getDocument(request.params.id, currentUser(response).id);
    if (!document) {
      response.status(404).json({ error: "Document not found" });
      return;
    }
    response.json(document);
  } catch (error) {
    next(error);
  }
});

app.post("/api/documents", upload.array("documents"), async (request, response, next) => {
  const files = (request.files ?? []) as Express.Multer.File[];
  try {
    if (!files.length) {
      response.status(400).json({ error: "Choose at least one supported document to upload." });
      return;
    }

    const ingested = [];

    for (const file of files) {
      const text = await extractTextFromFile(file.path, file.mimetype, file.originalname);
      ingested.push(
        createDocumentFromText({
          title: readableTitle(file.originalname),
          ownerId: currentUser(response).id,
          originalName: file.originalname,
          storedName: path.basename(file.path),
          mimeType: file.mimetype,
          size: file.size,
          text,
        }),
      );
    }

    await addDocuments(
      ingested.map(({ document }) => document),
      ingested.flatMap(({ reminders }) => reminders),
    );

    response.status(201).json({
      documents: ingested.map(({ document }) => ({ ...document, extractedText: undefined, chunks: undefined })),
      reminders: ingested.flatMap(({ reminders }) => reminders),
    });
  } catch (error) {
    await cleanupUploadedFiles(files);
    next(error);
  }
});

app.delete("/api/documents/:id", async (request, response, next) => {
  try {
    const deleted = await deleteDocument(request.params.id, currentUser(response).id);
    response.status(deleted ? 204 : 404).end();
  } catch (error) {
    next(error);
  }
});

app.post("/api/query", async (request, response, next) => {
  try {
    const body = z
      .object({
        question: z.string().min(2),
        category: z.string().optional(),
        history: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string().trim().min(1).max(1600),
            }),
          )
          .max(8)
          .optional(),
      })
      .parse(request.body);

    const documents = await listDocuments(currentUser(response).id);
    const scoredChunks = searchDocuments(documents, body.question, body.category);
    const extractive = createExtractiveAnswer(body.question, scoredChunks);
    const llmAnswer = await answerWithGroq(body.question, extractive.citations, body.history ?? []);

    response.json({
      ...extractive,
      mode: llmAnswer ? "llm" : extractive.mode,
      answer: llmAnswer ?? extractive.answer,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/search", async (request, response, next) => {
  try {
    const query = String(request.query.q ?? "");
    const category = String(request.query.category ?? "All");
    const documents = await listDocuments(currentUser(response).id);
    const results = searchDocuments(documents, query, category).map((result) => ({
      documentId: result.document.id,
      documentTitle: result.document.title,
      category: result.document.category,
      snippet: result.text.slice(0, 360),
      score: Number(result.score.toFixed(3)),
    }));

    response.json(results);
  } catch (error) {
    next(error);
  }
});

app.get("/api/reminders", async (_request, response, next) => {
  try {
    response.json(await listReminders(currentUser(response).id));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/reminders/:id", async (request, response, next) => {
  try {
    const body = z.object({ status: z.enum(["open", "done"]) }).parse(request.body);
    const reminder = await updateReminderStatus(request.params.id, currentUser(response).id, body.status);
    if (!reminder) {
      response.status(404).json({ error: "Reminder not found" });
      return;
    }
    response.json(reminder);
  } catch (error) {
    next(error);
  }
});

app.get("/api/insights", async (_request, response, next) => {
  try {
    response.json(buildInsights(await listDocuments(currentUser(response).id)));
  } catch (error) {
    next(error);
  }
});

app.post("/api/demo/seed", async (_request, response, next) => {
  try {
    const ownerId = currentUser(response).id;
    const samples = createSampleDocuments(ownerId);
    const store = await replaceDemoDocuments(
      ownerId,
      samples.map(({ document }) => document),
      samples.flatMap(({ reminders }) => reminders),
    );

    response.status(201).json({
      documents: store.documents
        .filter((document) => document.ownerId === ownerId)
        .map((document) => ({ ...document, extractedText: undefined, chunks: undefined })),
      reminders: store.reminders.filter((reminder) => reminder.ownerId === ownerId),
    });
  } catch (error) {
    next(error);
  }
});

app.use(express.static(path.join(projectRoot, "dist")));

app.get(/^(?!\/api).*/, (_request, response) => {
  response.sendFile(path.join(projectRoot, "dist", "index.html"));
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const requestId = String(response.locals.requestId || nanoid(8));

  if (error instanceof z.ZodError) {
    response.status(400).json({
      error: error.issues[0]?.message ?? "Invalid request",
      requestId,
    });
    return;
  }

  if (error instanceof multer.MulterError) {
    response.status(400).json({ error: readableMulterError(error), requestId });
    return;
  }

  if (error instanceof Error && error.message.startsWith("Unsupported file type")) {
    response.status(400).json({ error: error.message, requestId });
    return;
  }

  logger.error({ err: error, requestId }, "Unhandled server error");
  response.status(500).json({ error: "Unexpected server error", requestId });
});

const server = app.listen(port, () => {
  logger.info({ port }, "Jini API started");
});

function shutdown(signal: string) {
  logger.info({ signal }, "Shutdown signal received");
  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled promise rejection");
});

process.on("uncaughtException", (error) => {
  logger.error({ err: error }, "Uncaught exception");
  shutdown("uncaughtException");
});

function readableTitle(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function currentUser(response: express.Response) {
  return response.locals.user as PublicUser;
}

async function cleanupUploadedFiles(files: Express.Multer.File[]) {
  await Promise.all(files.map((file) => rm(file.path, { force: true })));
}

function readableMulterError(error: multer.MulterError) {
  if (error.code === "LIMIT_FILE_SIZE") return "Each document must be 25 MB or smaller.";
  if (error.code === "LIMIT_FILE_COUNT") return "Upload up to 12 documents at a time.";
  return error.message || "Upload failed.";
}
