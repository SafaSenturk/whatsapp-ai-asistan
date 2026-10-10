"use client";

import { useState } from "react";

export default function CopyBox({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-2">
      <button
        type="button"
        className="btn"
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? "Kopyalandı ✓" : label}
      </button>
      <details>
        <summary className="cursor-pointer text-sm text-zinc-500">Kodu göster</summary>
        <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-zinc-900 p-3 text-xs text-zinc-100">{text}</pre>
      </details>
    </div>
  );
}
