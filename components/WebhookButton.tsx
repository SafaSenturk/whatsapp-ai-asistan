"use client";

import { useActionState } from "react";
import { connectTelegram, connectWebhook } from "@/app/actions";

export default function WebhookButton({ target }: { target: "whatsapp" | "telegram" }) {
  const [message, action, pending] = useActionState(
    async () => (target === "telegram" ? connectTelegram() : connectWebhook()),
    null as string | null,
  );
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <button className="btn-ghost" disabled={pending}>
        {target === "telegram" ? "Telegram webhook'unu kaydet" : "Webhook'u Evolution'a kaydet"}
      </button>
      {message && <p className="text-sm text-zinc-600">{message}</p>}
    </form>
  );
}
