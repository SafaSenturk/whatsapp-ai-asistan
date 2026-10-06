"use client";

import { useActionState } from "react";
import { login } from "@/app/actions";

export default function LoginPage() {
  const [error, action, pending] = useActionState(login, null);

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form action={action} className="card w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-lg font-semibold">WhatsApp Bot Paneli</h1>
          <p className="text-sm text-zinc-500">Devam etmek için panel şifresini girin.</p>
        </div>
        <div>
          <label htmlFor="password" className="label">
            Şifre
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoFocus
            autoComplete="current-password"
            className="input"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn w-full" disabled={pending}>
          {pending ? "Giriş yapılıyor…" : "Giriş yap"}
        </button>
      </form>
    </main>
  );
}
