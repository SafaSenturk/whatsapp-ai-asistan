"use client";

import { useState, useTransition } from "react";
import { testBot } from "@/app/actions";
import type { Turn } from "@/lib/ai";

type Line = Turn & { note?: string };

export default function TestChat() {
  const [lines, setLines] = useState<Line[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function send(e: React.FormEvent) {
    e.preventDefault();
    const message = text.trim();
    if (!message || pending) return;

    const next: Line[] = [...lines, { role: "customer", text: message }];
    setLines(next);
    setText("");
    setError(null);

    startTransition(async () => {
      const result = await testBot(next.map(({ role, text }) => ({ role, text })));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setLines([
        ...next,
        {
          role: "business",
          text: result.text || "(boş cevap)",
          note: result.handoff ? "Bot bu konuşmayı insana devrederdi." : undefined,
        },
      ]);
    });
  }

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex min-h-64 flex-col gap-2">
        {lines.length === 0 && (
          <p className="text-sm text-zinc-500">
            Müşteri gibi bir mesaj yazın; bot kayıtlı ayarlarla cevap verir. Buradaki mesajlar
            WhatsApp&apos;a gönderilmez ve kaydedilmez.
          </p>
        )}
        {lines.map((l, i) => (
          <div key={i} className={`flex ${l.role === "customer" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                l.role === "customer" ? "bg-zinc-100" : "bg-emerald-100"
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{l.text}</p>
              {l.note && <p className="mt-1 text-xs text-amber-700">{l.note}</p>}
            </div>
          </div>
        ))}
        {pending && <p className="text-sm text-zinc-500">Bot yazıyor…</p>}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <form onSubmit={send} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Örn. Merhaba, fiyatlarınız nedir?"
          aria-label="Test mesajı"
          className="input"
        />
        <button className="btn shrink-0" disabled={pending}>
          Gönder
        </button>
        <button
          type="button"
          className="btn-ghost shrink-0"
          onClick={() => {
            setLines([]);
            setError(null);
          }}
        >
          Temizle
        </button>
      </form>
    </div>
  );
}
