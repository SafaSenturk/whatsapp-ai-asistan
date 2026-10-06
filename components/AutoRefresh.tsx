"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Sayfadaki sunucu verisini belirli aralıklarla yeniler (yeni mesajlar için). */
export default function AutoRefresh({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
