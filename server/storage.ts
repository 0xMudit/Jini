import { existsSync, mkdirSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import type { Reminder, VaultDocument, VaultStore } from "./types";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(serverDir, "..");
export const dataDir = path.join(projectRoot, "data");
export const uploadsDir = path.join(dataDir, "uploads");

const databasePath = path.join(dataDir, "jini.sqlite");
const legacyStorePath = path.join(dataDir, "vault-store.json");

interface DocumentRow {
  id: string;
  owner_id: string;
  uploaded_at: string;
  stored_name: string;
  payload: string;
}

interface ReminderRow {
  id: string;
  owner_id: string;
  document_id: string;
  due_date: string;
  status: Reminder["status"];
  payload: string;
}

interface CountRow {
  count: number;
}

mkdirSync(uploadsDir, { recursive: true });

const database = new DatabaseSync(databasePath);
let initialized = false;

export async function ensureDataDirs() {
  mkdirSync(uploadsDir, { recursive: true });
  await initializeVaultDatabase();
}

export async function readStore(): Promise<VaultStore> {
  await ensureDataDirs();
  return {
    documents: listAllDocuments(),
    reminders: listAllReminders(),
  };
}

export async function writeStore(store: VaultStore) {
  await ensureDataDirs();
  runTransaction(() => {
    database.prepare("DELETE FROM vault_reminders").run();
    database.prepare("DELETE FROM vault_documents").run();
    insertDocuments(store.documents);
    insertReminders(store.reminders);
  });
}

export async function listDocuments(ownerId: string) {
  await ensureDataDirs();
  const rows = database
    .prepare("SELECT payload FROM vault_documents WHERE owner_id = ? ORDER BY uploaded_at DESC")
    .all(ownerId) as unknown as Array<Pick<DocumentRow, "payload">>;
  return rows.map((row) => parseDocument(row.payload));
}

export async function getDocument(documentId: string, ownerId: string) {
  await ensureDataDirs();
  const row = database
    .prepare("SELECT payload FROM vault_documents WHERE id = ? AND owner_id = ?")
    .get(documentId, ownerId) as unknown as Pick<DocumentRow, "payload"> | undefined;
  return row ? parseDocument(row.payload) : null;
}

export async function addDocuments(documents: VaultDocument[], reminders: Reminder[]) {
  await ensureDataDirs();
  runTransaction(() => {
    insertDocuments(documents);
    insertReminders(reminders);
  });
  return readStore();
}

export async function replaceDemoDocuments(ownerId: string, documents: VaultDocument[], reminders: Reminder[]) {
  await ensureDataDirs();
  const demoRows = database
    .prepare("SELECT id FROM vault_documents WHERE owner_id = ? AND stored_name LIKE 'demo:%'")
    .all(ownerId) as unknown as Array<Pick<DocumentRow, "id">>;
  const demoIds = demoRows.map((row) => row.id);

  runTransaction(() => {
    for (const documentId of demoIds) {
      database.prepare("DELETE FROM vault_reminders WHERE document_id = ? AND owner_id = ?").run(documentId, ownerId);
      database.prepare("DELETE FROM vault_documents WHERE id = ? AND owner_id = ?").run(documentId, ownerId);
    }
    insertDocuments(documents);
    insertReminders(reminders);
  });

  return readStore();
}

export async function deleteDocument(documentId: string, ownerId: string) {
  await ensureDataDirs();
  const row = database
    .prepare("SELECT stored_name, payload FROM vault_documents WHERE id = ? AND owner_id = ?")
    .get(documentId, ownerId) as unknown as Pick<DocumentRow, "stored_name" | "payload"> | undefined;

  if (!row) return false;

  runTransaction(() => {
    database.prepare("DELETE FROM vault_reminders WHERE document_id = ? AND owner_id = ?").run(documentId, ownerId);
    database.prepare("DELETE FROM vault_documents WHERE id = ? AND owner_id = ?").run(documentId, ownerId);
  });

  if (!row.stored_name.startsWith("demo:")) {
    await rm(path.join(uploadsDir, row.stored_name), { force: true });
  }
  return true;
}

export async function listReminders(ownerId: string) {
  await ensureDataDirs();
  const rows = database
    .prepare("SELECT payload FROM vault_reminders WHERE owner_id = ? ORDER BY due_date ASC")
    .all(ownerId) as unknown as Array<Pick<ReminderRow, "payload">>;
  return rows.map((row) => parseReminder(row.payload));
}

export async function updateReminderStatus(reminderId: string, ownerId: string, status: "open" | "done") {
  await ensureDataDirs();
  const row = database
    .prepare("SELECT payload FROM vault_reminders WHERE id = ? AND owner_id = ?")
    .get(reminderId, ownerId) as unknown as Pick<ReminderRow, "payload"> | undefined;

  if (!row) {
    return null;
  }

  const reminder = { ...parseReminder(row.payload), status };
  database
    .prepare("UPDATE vault_reminders SET status = ?, payload = ? WHERE id = ? AND owner_id = ?")
    .run(status, serialize(reminder), reminderId, ownerId);
  return reminder;
}

async function initializeVaultDatabase() {
  if (initialized) return;

  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS vault_documents (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      uploaded_at TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      payload TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vault_reminders (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      due_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('open', 'done')),
      payload TEXT NOT NULL,
      FOREIGN KEY (document_id) REFERENCES vault_documents(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS vault_documents_owner_uploaded_idx
      ON vault_documents(owner_id, uploaded_at DESC);

    CREATE INDEX IF NOT EXISTS vault_documents_owner_stored_idx
      ON vault_documents(owner_id, stored_name);

    CREATE INDEX IF NOT EXISTS vault_reminders_owner_due_idx
      ON vault_reminders(owner_id, due_date ASC);

    CREATE INDEX IF NOT EXISTS vault_reminders_document_idx
      ON vault_reminders(document_id);
  `);

  initialized = true;
  await migrateLegacyStore();
}

async function migrateLegacyStore() {
  if (!existsSync(legacyStorePath)) return;

  const documentCount = database
    .prepare("SELECT COUNT(*) AS count FROM vault_documents")
    .get() as unknown as CountRow;
  const reminderCount = database
    .prepare("SELECT COUNT(*) AS count FROM vault_reminders")
    .get() as unknown as CountRow;

  if (documentCount.count > 0 || reminderCount.count > 0) return;

  let legacyStore: VaultStore;
  try {
    legacyStore = JSON.parse(await readFile(legacyStorePath, "utf-8")) as VaultStore;
  } catch {
    return;
  }

  const documents = (legacyStore.documents ?? []).map((document) => ({
    ...document,
    ownerId: document.ownerId || "seed-guest",
  }));
  const reminders = (legacyStore.reminders ?? []).map((reminder) => ({
    ...reminder,
    ownerId: reminder.ownerId || "seed-guest",
  }));

  runTransaction(() => {
    insertDocuments(documents);
    insertReminders(reminders);
  });
}

function insertDocuments(documents: VaultDocument[]) {
  const statement = database.prepare(`
    INSERT INTO vault_documents (id, owner_id, uploaded_at, stored_name, payload)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      owner_id = excluded.owner_id,
      uploaded_at = excluded.uploaded_at,
      stored_name = excluded.stored_name,
      payload = excluded.payload
  `);

  for (const document of documents) {
    statement.run(document.id, document.ownerId, document.uploadedAt, document.storedName, serialize(document));
  }
}

function insertReminders(reminders: Reminder[]) {
  const statement = database.prepare(`
    INSERT INTO vault_reminders (id, owner_id, document_id, due_date, status, payload)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      owner_id = excluded.owner_id,
      document_id = excluded.document_id,
      due_date = excluded.due_date,
      status = excluded.status,
      payload = excluded.payload
  `);

  for (const reminder of reminders) {
    statement.run(
      reminder.id,
      reminder.ownerId,
      reminder.documentId,
      reminder.dueDate,
      reminder.status,
      serialize(reminder),
    );
  }
}

function listAllDocuments() {
  const rows = database
    .prepare("SELECT payload FROM vault_documents ORDER BY uploaded_at DESC")
    .all() as unknown as Array<Pick<DocumentRow, "payload">>;
  return rows.map((row) => parseDocument(row.payload));
}

function listAllReminders() {
  const rows = database
    .prepare("SELECT payload FROM vault_reminders ORDER BY due_date ASC")
    .all() as unknown as Array<Pick<ReminderRow, "payload">>;
  return rows.map((row) => parseReminder(row.payload));
}

function parseDocument(payload: string) {
  return JSON.parse(payload) as VaultDocument;
}

function parseReminder(payload: string) {
  return JSON.parse(payload) as Reminder;
}

function serialize(value: unknown) {
  return JSON.stringify(value);
}

function runTransaction(work: () => void) {
  database.exec("BEGIN IMMEDIATE");
  try {
    work();
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
