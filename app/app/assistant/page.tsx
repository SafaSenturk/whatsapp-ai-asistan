import AssistantChat from "@/components/AssistantChat";
import { requireUser } from "@/lib/auth";
import { recentTurns } from "@/lib/engine";
import { missingEnv } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  const user = await requireUser();
  const history = await recentTurns(user.id, "web");
  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Asistan</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Harcama ekle, soru sor, fiş fotoğrafı yükle. WhatsApp&apos;taki asistanla aynıdır.
        </p>
      </div>
      {missingEnv("ai").length > 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <code>GEMINI_API_KEY</code> tanımlı değil; asistan cevap veremez.
        </p>
      )}
      <AssistantChat initial={history.map((t) => ({ role: t.role, text: t.text }))} />
    </div>
  );
}
