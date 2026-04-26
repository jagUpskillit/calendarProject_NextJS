import Link from "next/link";
import type { Session } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { DeliveryModeBadge } from "@/components/ui/DeliveryModeBadge";
import { formatDate } from "@/lib/utils/formatters";

interface SessionCardProps {
  session: Session;
}

export function SessionCard({ session }: SessionCardProps) {
  const hasLink = !!session.registrationLink;

  return (
    <article className="group flex flex-col overflow-hidden rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,249,255,0.98))] shadow-[0_18px_38px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_48px_rgba(40,118,181,0.16)]">

      <div className="h-1.5 w-full bg-[linear-gradient(90deg,#3a2aa1,#2876b5,#4eb8d7)]" />

      <div className="flex flex-1 flex-col gap-4 p-5">

        <div className="flex flex-wrap gap-1.5">
          <DeliveryModeBadge mode={session.deliveryMode} />
          {session.geo && <Badge variant="amber">{session.geo}</Badge>}
          {session.capability && <Badge variant="purple">{session.capability}</Badge>}
        </div>

        <h2 className="text-lg font-semibold leading-snug text-slate-900 transition-colors group-hover:text-[#3a2aa1]">
          {session.programName}
        </h2>

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm text-slate-600">
          {session.facilitator && (
            <>
              <dt className="font-medium text-slate-500">Facilitator</dt>
              <dd>{session.facilitator}</dd>
            </>
          )}
          <dt className="font-medium text-slate-500">Date</dt>
          <dd>
            {session.dateISO
              ? formatDate(session.dateISO)
              : session.scheduleRaw
              ? <span title={session.scheduleRaw} className="cursor-help underline decoration-dotted underline-offset-2">
                  {session.scheduleRaw.length > 50
                    ? session.scheduleRaw.slice(0, 50) + "…"
                    : session.scheduleRaw}
                </span>
              : "TBD"}
          </dd>
          {session.targetAudience && (
            <>
              <dt className="font-medium text-slate-500">Audience</dt>
              <dd>{session.targetAudience}</dd>
            </>
          )}
          {session.batchSize != null && (
            <>
              <dt className="font-medium text-slate-500">Capacity</dt>
              <dd>{session.batchSize} seats</dd>
            </>
          )}
        </dl>

        <div className="mt-auto flex items-center gap-1.5 text-xs">
          {hasLink ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              Registration link available
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
              No registration link yet
            </span>
          )}
        </div>
      </div>

      <div className="border-t border-slate-100 bg-white/70 px-5 py-3">
        <Link
          href={`/sessions/${session.id}`}
          className="inline-flex items-center gap-1 rounded-full bg-[linear-gradient(90deg,#3a2aa1,#2876b5)] px-4 py-2 text-sm font-medium text-white shadow-[0_12px_24px_rgba(58,42,161,0.18)] transition-transform transition-shadow hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(40,118,181,0.22)]"
        >
          View Details →
        </Link>
      </div>
    </article>
  );
}
