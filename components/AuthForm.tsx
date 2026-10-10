"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup } from "@/app/actions";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [error, action, pending] = useActionState(mode === "login" ? login : signup, null);
  const isSignup = mode === "signup";

  return (
    <form action={action} className="card w-full max-w-sm space-y-4">
      <div>
        <Link href="/" className="text-sm font-semibold text-emerald-700">
          👛 Cüzdan
        </Link>
        <h1 className="mt-2 text-lg font-semibold">{isSignup ? "Ücretsiz hesap aç" : "Giriş yap"}</h1>
        <p className="text-sm text-zinc-500">
          {isSignup ? "Kredi kartı gerekmez. 1 dakikada başla." : "Tekrar hoş geldin."}
        </p>
      </div>
      {isSignup && (
        <div>
          <label htmlFor="name" className="label">
            Adın
          </label>
          <input id="name" name="name" autoComplete="given-name" className="input" />
        </div>
      )}
      <div>
        <label htmlFor="email" className="label">
          E-posta
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" className="input" />
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
          minLength={isSignup ? 8 : undefined}
          autoComplete={isSignup ? "new-password" : "current-password"}
          className="input"
        />
      </div>
      {isSignup && (
        <label className="flex items-start gap-2 text-sm text-zinc-600">
          <input type="checkbox" name="terms" required className="mt-1" />
          <span>
            <Link href="/legal" className="underline">
              Kullanım koşullarını ve KVKK aydınlatma metnini
            </Link>{" "}
            okudum, kabul ediyorum.
          </span>
        </label>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn w-full" disabled={pending}>
        {pending ? "Bekleyin…" : isSignup ? "Hesap oluştur" : "Giriş yap"}
      </button>
      <p className="text-center text-sm text-zinc-500">
        {isSignup ? (
          <>
            Hesabın var mı? <Link href="/login" className="text-emerald-700 underline">Giriş yap</Link>
          </>
        ) : (
          <>
            Hesabın yok mu? <Link href="/signup" className="text-emerald-700 underline">Ücretsiz kayıt ol</Link>
          </>
        )}
      </p>
    </form>
  );
}
