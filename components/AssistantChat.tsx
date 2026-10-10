"use client";

import { useRef, useState, useTransition } from "react";
import { askAssistant } from "@/app/actions";

type Line = { role: "user" | "assistant"; text: string };

const EXAMPLES = [
  "kahve 85",
  "dün taksi 320",
  "yaşama at",
  "bu ay markete ne kadar harcadım?",
  "hedeflerime ne kadar kaldı?",
  "ay sonunda ne kalır?",
  "önerilerin var mı?",
];

/** Fotoğrafı tarayıcıda küçültür; sunucuya giden veri 1 MB'ın altında kalır. */
async function shrink(file: File): Promise<{ base64: string; mimeType: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
  return { base64: dataUrl.split(",")[1], mimeType: "image/jpeg" };
}

export default function AssistantChat({ initial }: { initial: Line[] }) {
  const [lines, setLines] = useState<Line[]>(initial);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function send(message: string, file?: File) {
    if (pending || (!message.trim() && !file)) return;
    setLines((l) => [...l, { role: "user", text: file ? `📷 ${file.name}${message ? ` — ${message}` : ""}` : message }]);
    setText("");
    setError(null);
    startTransition(async () => {
      const image = file ? await shrink(file) : undefined;
      const result = await askAssistant({ text: message, image });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setLines((l) => [...l, { role: "assistant", text: result.reply }]);
    });
  }

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex min-h-80 flex-col gap-2">
        {lines.length === 0 && (
          <div className="text-sm text-zinc-500">
            <p>WhatsApp&apos;ta yazdığın gibi yaz; aynı asistan burada da çalışır. Örnekler:</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {EXAMPLES.map((e) => (
                <button key={e} type="button" onClick={() => send(e)} className="rounded-full border border-zinc-200 px-3 py-1 hover:bg-zinc-50">
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}
        {lines.map((l, i) => (
          <div key={i} className={`flex ${l.role === "user" ? "justify-end" : "justify-start"}`}>
            <p className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${l.role === "user" ? "bg-emerald-100" : "bg-zinc-100"}`}>
              {l.text}
            </p>
          </div>
        ))}
        {pending && <p className="text-sm text-zinc-500">Cüzdan düşünüyor…</p>}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        className="flex gap-2"
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) send(text, f);
            e.target.value = "";
          }}
        />
        <button type="button" className="btn-ghost shrink-0" onClick={() => fileRef.current?.click()} disabled={pending} title="Fiş fotoğrafı yükle">
          📷
        </button>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Örn. migros 1240" aria-label="Mesaj" className="input" />
        <button className="btn shrink-0" disabled={pending}>Gönder</button>
      </form>
    </div>
  );
}
