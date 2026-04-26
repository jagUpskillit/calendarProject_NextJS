"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Session } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { DeliveryModeBadge } from "@/components/ui/DeliveryModeBadge";
import { getSessionRepository } from "@/lib/repository";
import { formatDate } from "@/lib/utils/formatters";

export function SessionDetailsClient({ id }: { id: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [related, setRelated] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const repo = getSessionRepository();
      const found = await repo.getById(id);
      if (!found) {
        setSession(null);
        setLoading(false);
        return;
      }
      setSession(found);
      setRelated(await repo.getRelated(found.id, 4));
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm">Loading session…</div>;
  }

  if (!session) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-2xl">🧭</p>
        <h1 className="mt-2 text-xl font-semibold text-gray-900">Session not found</h1>
        <p className="mt-1 text-sm text-gray-500">The requested session may be missing from the current imported data.</p>
        <Link href="/" className="mt-4 inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Go to session list
        </Link>
      </div>
    );
  }

  const supportLink = `/support?issueType=missing_registration_link&sessionId=${encodeURIComponent(session.id)}`;

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <DeliveryModeBadge mode={session.deliveryMode} />
              {session.geo && <Badge variant="amber">{session.geo}</Badge>}
              {session.capability && <Badge variant="purple">{session.capability}</Badge>}
              {session.targetAudience && <Badge variant="blue">{session.targetAudience}</Badge>}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{session.programName}</h1>
            {session.objectives && <p className="text-sm text-gray-600 max-w-3xl">{session.objectives}</p>}
          </div>

          <div className="flex items-center gap-2">
            {session.registrationLink ? (
              <a href={session.registrationLink} target="_blank" rel="noreferrer noopener" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                Register ↗
              </a>
            ) : (
              <Link href={supportLink} className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700">
                Raise Support Ticket
              </Link>
            )}
            <Link href="/" className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Back to list
            </Link>
          </div>
        </div>

        {!session.registrationLink && (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Registration link is not currently available for this session. Please raise a support ticket.
          </p>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Session Details</h2>
          <dl className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-gray-500">Facilitator</dt>
            <dd className="text-gray-900">{session.facilitator ?? "TBD"}</dd>
            <dt className="text-gray-500">Date</dt>
            <dd className="text-gray-900">{formatDate(session.dateISO)}</dd>
            <dt className="text-gray-500">Schedule</dt>
            <dd className="text-gray-900">{session.scheduleRaw ?? "TBD"}</dd>
            <dt className="text-gray-500">Format & Duration</dt>
            <dd className="text-gray-900">{session.formatDuration ?? "N/A"}</dd>
            <dt className="text-gray-500">Location</dt>
            <dd className="text-gray-900">{session.location ?? "TBD"}</dd>
            <dt className="text-gray-500">Capacity</dt>
            <dd className="text-gray-900">{session.batchSize != null ? `${session.batchSize} seats` : "Not specified"}</dd>
            <dt className="text-gray-500">Target Audience</dt>
            <dd className="text-gray-900">{session.targetAudience ?? "All"}</dd>
            <dt className="text-gray-500">Capability</dt>
            <dd className="text-gray-900">{session.capability ?? "N/A"}</dd>
          </dl>
        </article>

        <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Additional Info</h2>
          <div className="space-y-3 text-sm text-gray-700">
            <p><span className="font-medium text-gray-900">Joining rules: </span>Join 5–10 minutes early. Please ensure laptop/network readiness for virtual sessions.</p>
            <p><span className="font-medium text-gray-900">Prerequisites: </span>{session.notes ?? "No explicit prerequisites listed."}</p>
            <p><span className="font-medium text-gray-900">Rating: </span>{session.rating != null ? `${session.rating.toFixed(1)} / 5` : "Not available"}</p>
            <p><span className="font-medium text-gray-900">Tags: </span>{(session.tags ?? []).length > 0 ? (session.tags ?? []).join(", ") : "None"}</p>
          </div>
        </article>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Related Sessions</h2>
        {related.length === 0 ? (
          <p className="text-sm text-gray-500">No related sessions found.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {related.map((item) => (
              <Link key={item.id} href={`/sessions/${item.id}`} className="rounded-lg border border-gray-200 p-3 hover:border-blue-300 hover:bg-blue-50/40">
                <p className="font-medium text-gray-900">{item.programName}</p>
                <p className="text-xs text-gray-500 mt-1">{item.facilitator ?? "TBD"} · {item.geo ?? "Global"} · {formatDate(item.dateISO)}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
