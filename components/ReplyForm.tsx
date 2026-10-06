"use client";

import { useActionState, useEffect, useRef } from "react";
import { sendAgentMessage } from "@/app/actions";

export default function ReplyForm({ contactId }: { contactId: string }) {
  const [error, action, pending] = useActionState(sendAgentMessage, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !error) formRef.current?.reset();
  }, [pending, error]);

  return (
    <form ref={formRef} action={action} className="space-y-2">
      <input type="hidden" name="contact_id" value={contactId} />
      <div className="flex gap-2">
        <input
          name="text"
          required
          autoComplete="off"
          placeholder="Mesaj yazın…"
          aria-label="Mesaj"
          className="input"
        />
        <button className="btn shrink-0" disabled={pending}>
          {pending ? "Gönderiliyor…" : "Gönder"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
