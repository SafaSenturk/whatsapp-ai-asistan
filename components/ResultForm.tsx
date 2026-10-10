"use client";

import { useActionState } from "react";

/** Sonuç mesajı gösteren basit form sarmalayıcı. */
export default function ResultForm({
  action,
  children,
  submit,
  danger,
}: {
  action: (prev: string | null, form: FormData) => Promise<string | null>;
  children: React.ReactNode;
  submit: string;
  danger?: boolean;
}) {
  const [message, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="space-y-3">
      {children}
      <div className="flex items-center gap-3">
        <button className={danger ? "btn bg-red-600 hover:bg-red-700" : "btn"} disabled={pending}>
          {pending ? "Bekleyin…" : submit}
        </button>
        {message && <p className="text-sm text-zinc-600">{message}</p>}
      </div>
    </form>
  );
}
