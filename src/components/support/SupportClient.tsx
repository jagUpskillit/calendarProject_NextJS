"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Session, TicketIssueType, SupportTicket } from "@/types";
import { TICKET_ISSUE_LABELS } from "@/types";
import { createTicket, deleteTicket, getAllTickets } from "@/lib/services/ticketStorage";
import { getSessionRepository } from "@/lib/repository";

const ISSUE_TYPES: TicketIssueType[] = [
  "broken_link",
  "missing_registration_link",
  "no_confirmation_email",
  "calendar_invite_not_received",
  "other",
];

export function SupportClient() {
  const searchParams = useSearchParams();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState<string>(searchParams.get("sessionId") ?? "");
  const [issueType, setIssueType] = useState<TicketIssueType>(
    (searchParams.get("issueType") as TicketIssueType) || "broken_link"
  );
  const [description, setDescription] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getSessionRepository().getAll();
        setSessions(Array.isArray(data) ? data : []);
      } catch {
        setSessions([]);
      }
    })();
    setTickets(getAllTickets());
  }, []);

  useEffect(() => {
    const incomingIssue = searchParams.get("issueType") as TicketIssueType | null;
    const incomingSession = searchParams.get("sessionId");
    if (incomingIssue && ISSUE_TYPES.includes(incomingIssue)) setIssueType(incomingIssue);
    if (incomingSession) setSessionId(incomingSession);
  }, [searchParams]);

  const selectedSessionName = useMemo(
    () => sessions.find((s) => s.id === sessionId)?.programName,
    [sessions, sessionId]
  );

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setCreatedId(null);

    if (!description.trim()) {
      setError("Description is required.");
      return;
    }

    const created = createTicket({
      sessionId: sessionId || undefined,
      sessionName: selectedSessionName,
      issueType,
      description,
      userEmail: userEmail || undefined,
    });

    setTickets(getAllTickets());
    setCreatedId(created.id);
    setDescription("");
  }

  function onDelete(ticketId: string) {
    setTickets(deleteTicket(ticketId));
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold text-gray-900">Support</h1>
        <p className="mt-1 text-sm text-gray-600">
          Raise a ticket for broken links, missing invites, or registration issues.
        </p>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Raise Support Ticket</h2>

        {createdId && (
          <p className="mt-3 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            Ticket created successfully: <strong>{createdId}</strong>
          </p>
        )}

        {error && (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}

        <form onSubmit={onSubmit} className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Issue Type</label>
            <select
              value={issueType}
              onChange={(e) => setIssueType(e.target.value as TicketIssueType)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {ISSUE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {TICKET_ISSUE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Session (optional)</label>
            <select
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Not tied to a specific session</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.programName}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              required
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Please describe the issue and what happened."
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Email (optional)</label>
            <input
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="name@company.com"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Create Ticket
            </button>
            <Link
              href="/"
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Back to sessions
            </Link>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Existing Tickets</h2>
        {tickets.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No tickets yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {tickets.map((ticket) => (
              <article key={ticket.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{ticket.id}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(ticket.createdAt).toLocaleString()} · {TICKET_ISSUE_LABELS[ticket.issueType]}
                    </p>
                  </div>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                    {ticket.status}
                  </span>
                </div>

                {ticket.sessionName && (
                  <p className="mt-2 text-sm text-gray-700">
                    Session: <span className="font-medium">{ticket.sessionName}</span>
                  </p>
                )}

                <p className="mt-2 text-sm text-gray-800">{ticket.description}</p>

                {ticket.userEmail && (
                  <p className="mt-1 text-xs text-gray-500">Contact: {ticket.userEmail}</p>
                )}

                <div className="mt-3">
                  <button
                    onClick={() => onDelete(ticket.id)}
                    className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
