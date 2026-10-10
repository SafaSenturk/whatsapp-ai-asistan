"use client";

import { useActionState, useEffect, useRef } from "react";

/** Hata mesajı gösteren, başarılı olunca kendini temizleyen form. */
export default function ActionForm({
  action,
  children,
  submit,
  className = "",
}: {
  action: (prev: string | null, form: FormData) => Promise<string | null>;
  children: React.ReactNode;
  submit: string;
  className?: string;
}) {
  const [error, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);
  useEffect(() => {
    if (!pending && submitted.current && !error) ref.current?.reset();
    if (pending) submitted.current = true;
  }, [pending, error]);
  return (
    <form ref={ref} action={formAction} className={`flex flex-wrap items-end gap-3 ${className}`}>
      {children}
      <button className="btn" disabled={pending}>
        {pending ? "Kaydediliyor…" : submit}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
