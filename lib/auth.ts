import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUser, type User } from "./db";

export const SESSION_COOKIE = "cuzdan_session";
const SESSION_DAYS = 30;

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const hash = await scryptAsync(password, Buffer.from(saltHex, "hex"), 64);
  return safeEqual(hash.toString("hex"), hashHex);
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function sign(payload: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET tanımlı değil");
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function createSessionValue(userId: string, now = Date.now()): string {
  const payload = `${userId}.${now + SESSION_DAYS * 86_400_000}`;
  return `${payload}.${sign(payload)}`;
}

/** Çerez geçerliyse kullanıcı kimliğini döndürür. */
export function readSession(value: string | undefined, now = Date.now()): string | null {
  if (!value || !process.env.SESSION_SECRET) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [userId, exp, sig] = parts;
  if (!safeEqual(sig, sign(`${userId}.${exp}`))) return null;
  if (!(Number(exp) > now)) return null;
  return userId;
}

export async function startSession(userId: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionValue(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

/** Her korumalı sayfa ve server action'ın başında çağrılır. */
export async function requireUser(): Promise<User> {
  const store = await cookies();
  const id = readSession(store.get(SESSION_COOKIE)?.value);
  const user = id ? await getUser(id) : null;
  if (!user) redirect("/login");
  return user;
}

export function isAdmin(user: Pick<User, "email">): boolean {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(user.email.toLowerCase());
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (!isAdmin(user)) redirect("/app");
  return user;
}
