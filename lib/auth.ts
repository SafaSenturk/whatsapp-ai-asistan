import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const SESSION_COOKIE = "panel_session";

export function sessionToken(): string | null {
  const password = process.env.PANEL_PASSWORD;
  const secret = process.env.SESSION_SECRET;
  if (!password || !secret) return null;
  return createHmac("sha256", secret).update(password).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function isValidSession(value: string | undefined): boolean {
  const token = sessionToken();
  return Boolean(token && value && safeEqual(value, token));
}

/** Her server action ve korumalı sayfanın başında çağrılır. */
export async function requireAuth() {
  const store = await cookies();
  if (!isValidSession(store.get(SESSION_COOKIE)?.value)) redirect("/login");
}
