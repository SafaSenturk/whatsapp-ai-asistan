"use client";

import { useActionState } from "react";
import { connectWebhook, saveSettings } from "@/app/actions";
import type { BotSettings } from "@/lib/db";

export default function SettingsForm({ settings }: { settings: BotSettings }) {
  const [message, action, pending] = useActionState(saveSettings, null);

  return (
    <form action={action} className="card space-y-4">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={settings.enabled}
          className="size-4 accent-emerald-600"
        />
        Bot açık (kapalıyken mesajlar yalnızca kaydedilir, cevap verilmez)
      </label>

      <div>
        <label htmlFor="business_name" className="label">
          İşletme adı
        </label>
        <input
          id="business_name"
          name="business_name"
          defaultValue={settings.business_name}
          className="input"
        />
      </div>

      <div>
        <label htmlFor="business_info" className="label">
          İşletme bilgileri
        </label>
        <textarea
          id="business_info"
          name="business_info"
          rows={12}
          defaultValue={settings.business_info}
          placeholder="Ne satıyorsunuz, fiyatlar, çalışma saatleri, adres, kargo ve iade koşulları, sık sorulan sorular…"
          className="input"
        />
        <p className="mt-1 text-xs text-zinc-500">
          Bot yalnızca burada yazanlara dayanarak cevap verir; burada olmayan soruları size devreder.
        </p>
      </div>

      <div>
        <label htmlFor="tone" className="label">
          Üslup
        </label>
        <input id="tone" name="tone" defaultValue={settings.tone} className="input" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="handoff_keywords" className="label">
            İnsana devir kelimeleri (virgülle)
          </label>
          <input
            id="handoff_keywords"
            name="handoff_keywords"
            defaultValue={settings.handoff_keywords}
            className="input"
          />
        </div>
        <div>
          <label htmlFor="model" className="label">
            Gemini modeli
          </label>
          <input id="model" name="model" defaultValue={settings.model} className="input" />
        </div>
      </div>

      <div>
        <label htmlFor="handoff_message" className="label">
          Devir mesajı
        </label>
        <input
          id="handoff_message"
          name="handoff_message"
          defaultValue={settings.handoff_message}
          className="input"
        />
      </div>

      <div className="flex items-center gap-3">
        <button className="btn" disabled={pending}>
          {pending ? "Kaydediliyor…" : "Kaydet"}
        </button>
        {message && <span className="text-sm text-zinc-600">{message}</span>}
      </div>
    </form>
  );
}

export function WebhookButton() {
  const [message, action, pending] = useActionState(connectWebhook, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <button className="btn-ghost" disabled={pending}>
        {pending ? "Bağlanıyor…" : "Webhook'u Evolution'a kaydet"}
      </button>
      {message && <span className="text-sm text-zinc-600">{message}</span>}
    </form>
  );
}
