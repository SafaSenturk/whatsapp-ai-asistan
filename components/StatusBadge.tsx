import { STATUS_LABELS, type ContactStatus } from "@/lib/db";

const COLORS: Record<ContactStatus, string> = {
  new: "bg-sky-100 text-sky-800",
  active: "bg-zinc-100 text-zinc-700",
  handoff: "bg-amber-100 text-amber-800",
  won: "bg-emerald-100 text-emerald-800",
  lost: "bg-red-100 text-red-700",
};

export default function StatusBadge({ status }: { status: ContactStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function formatTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  });
}
