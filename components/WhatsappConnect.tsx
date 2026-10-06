"use client";

import { useEffect, useRef, useState } from "react";
import { whatsappStatus } from "@/app/actions";

const QR_REFRESH_MS = 20_000;
const STATE_POLL_MS = 5_000;

/** Bağlantı durumunu izler; bağlı değilse okutulacak QR kodunu gösterir ve yeniler. */
export default function WhatsappConnect() {
  const [state, setState] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastQrAt = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      const needQr = Date.now() - lastQrAt.current >= QR_REFRESH_MS;
      const result = await whatsappStatus(needQr);
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setState(result.state);
      if (result.state === "open") {
        setQr(null);
      } else if (result.qr) {
        setQr(result.qr);
        lastQrAt.current = Date.now();
      }
    }

    tick();
    const id = setInterval(tick, STATE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (error) return <p className="text-sm text-red-600">Evolution API&apos;ye ulaşılamadı: {error}</p>;
  if (state === null) return <p className="text-sm text-zinc-500">Bağlantı durumu kontrol ediliyor…</p>;

  if (state === "open") {
    return <p className="text-sm font-medium text-emerald-700">WhatsApp bağlı.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-zinc-600">
        WhatsApp bağlı değil. Telefonda WhatsApp &gt; Ayarlar &gt; Bağlı Cihazlar &gt; Cihaz Bağla
        ile aşağıdaki kodu okutun. Kod kendiliğinden yenilenir.
      </p>
      {qr ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt="WhatsApp eşleştirme QR kodu" width={280} height={280} className="rounded-lg border border-zinc-200 bg-white p-2" />
      ) : (
        <p className="text-sm text-zinc-500">QR kodu hazırlanıyor…</p>
      )}
    </div>
  );
}
