"use client";

import { useActionState } from "react";
import { connectWebhook } from "@/app/actions";

export default function WebhookButton() {
  const [message, action, pending] = useActionState(async () => connectWebhook(), null as string | null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <button className="btn-ghost" disabled={pending}>Webhook&apos;u Evolution&apos;a kaydet</button>
      {message && <p className="text-sm text-zinc-600">{message}</p>}
    </form>
  );
}
