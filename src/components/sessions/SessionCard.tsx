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
    <article className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm
      hover:shadow-md hover:border-blue-300 transition-all duration-150 overflow-hidden">

      {/* Capability colour strip */}
      <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 to-indigo-400" />

      <div className="flex flex-col gap-3 p-5 flex-1">

        {/* Badges row */}
        <div className="flex flex-wrap gap-1.5">
          <DeliveryModeBadge mode={session.deliveryMode} />
          {session.geo && <Badge variant="amber">{session.geo}</Badge>}
          {session.capability && <Badge variant="purple">{session.capability}</Badge>}
        </div>

        {/* Title */}
        <h2 className="text-base font-semibold text-gray-900 leading-snug">
          {session.programName}
        </h2>

        {/* Meta grid */}
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm text-gray-600">
          {session.facilitator && (
            <>
              <dt className="font-medium text-gray-500">Facilitator</dt>
              <dd>{session.facilitator}</dd>
            </>
          )}
          <dt className="font-medium text-gray-500">Date</dt>
          <dd>
            {session.dateISO
              ? formatDate(session.dateISO)
              : session.scheduleRaw
              ? <span title={session.scheduleRaw} className="cursor-help underline decoration-dotted">
                  {session.scheduleRaw.length > 50
                    ? session.scheduleRaw.slice(0, 50) + "…"
                    : session.scheduleRaw}
                </span>
              : "TBD"}
          </dd>
          {session.targetAudience && (
            <>
              <dt className="font-medium text-gray-500">Audience</dt>
              <dd>{session.targetAudience}</dd>
            </>
          )}
          {session.batchSize != null && (
            <>
              <dt className="font-medium text-gray-500">Capacity</dt>
              <dd>{session.batchSize} seats</dd>
            </>
          )}
        </dl>

        {/* Registration status indicator */}
        <div className="flex items-center gap-1.5 text-xs">
          {hasLink ? (
            <span className="flex items-center gap-1 text-green-700">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
              Registration link available
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-700">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
              No registration link yet
            </span>
          )}
        </div>
      </div>

      {/* Footer action */}
      <div className="border-t border-gray-100 px-5 py-3 bg-gray-50">
        <Link
          href={`/sessions/${session.id}`}
          className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-4 py-1.5
            text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          View Details →
        </Link>
      </div>
    </article>
  );
}
