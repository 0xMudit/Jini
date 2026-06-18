import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Request, Response } from "express";
import { nanoid } from "nanoid";
import { dataDir } from "./storage";

export type UserRole = "hr" | "guest" | "member";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

interface UserRow extends PublicUser {
  password_hash: string;
  created_at: string;
}

const SESSION_COOKIE = "jini_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

mkdirSync(dataDir, { recursive: true });
const database = new DatabaseSync(path.join(dataDir, "jini.sqlite"));

export function initializeAuthDatabase() {
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('hr', 'guest', 'member')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
  `);

  seedUser("seed-test", "Test User", "test@jini.local", process.env.TEST_USER_PASSWORD ?? "JiniTest123!", "member");
  seedUser("seed-hr", "Test User", "hr@jini.local", process.env.HR_TEST_PASSWORD ?? "JiniHR123!", "hr");
  seedUser("seed-guest", "Guest User", "guest@jini.local", process.env.GUEST_TEST_PASSWORD ?? "JiniGuest123!", "guest");
  database.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(new Date().toISOString());
}

export function createUser(name: string, email: string, password: string): PublicUser {
  const user: PublicUser = {
    id: nanoid(),
    name: name.trim(),
    email: normalizeEmail(email),
    role: "member",
  };
  database
    .prepare("INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(user.id, user.name, user.email, hashPassword(password), user.role, new Date().toISOString());
  return user;
}

export function authenticateCredentials(email: string, password: string): PublicUser | null {
  const row = database
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(normalizeEmail(email)) as unknown as UserRow | undefined;
  if (!row || !verifyPassword(password, row.password_hash)) return null;
  return publicUser(row);
}

export function getGuestUser(): PublicUser {
  const row = database.prepare("SELECT * FROM users WHERE id = 'seed-guest'").get() as unknown as UserRow;
  return publicUser(row);
}

export function getAuthenticatedUser(request: Request): PublicUser | null {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const row = database
    .prepare(`
      SELECT users.* FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ? AND sessions.expires_at > ?
    `)
    .get(hashToken(token), new Date().toISOString()) as unknown as UserRow | undefined;
  return row ? publicUser(row) : null;
}

export function startSession(userId: string, response: Response) {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000);
  database
    .prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .run(hashToken(token), userId, expiresAt.toISOString(), now.toISOString());
  response.setHeader("Set-Cookie", serializeSessionCookie(token, SESSION_MAX_AGE_SECONDS));
}

export function endSession(request: Request, response: Response) {
  const token = readCookie(request, SESSION_COOKIE);
  if (token) database.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
  response.setHeader("Set-Cookie", serializeSessionCookie("", 0));
}

function seedUser(id: string, name: string, email: string, password: string, role: UserRole) {
  database
    .prepare(`
      INSERT INTO users (id, name, email, password_hash, role, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET name = excluded.name
    `)
    .run(id, name, normalizeEmail(email), hashPassword(password), role, new Date().toISOString());
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, encoded: string) {
  const [salt, storedHex] = encoded.split(":");
  if (!salt || !storedHex) return false;
  const stored = Buffer.from(storedHex, "hex");
  const candidate = scryptSync(password, salt, stored.length);
  return stored.length === candidate.length && timingSafeEqual(stored, candidate);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function publicUser(row: UserRow): PublicUser {
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

function readCookie(request: Request, name: string) {
  const cookies = request.headers.cookie?.split(";") ?? [];
  for (const cookie of cookies) {
    const [key, ...value] = cookie.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

function serializeSessionCookie(value: string, maxAge: number) {
  const secure = process.env.COOKIE_SECURE === "true" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}
