/**
 * ticket.ts — Support ticket domain types.
 *
 * Phase 1: Stored in browser localStorage via LocalTicketRepository.
 * Phase 2: Backed by SharePoint list / Dataverse / ServiceNow / Jira etc.
 *          Only the repository implementation changes; these types stay stable.
 */

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

/** The category of problem the associate is reporting */
export type TicketIssueType =
  | "broken_link"              // Registration/joining link is broken
  | "missing_registration_link" // No link was ever provided
  | "no_confirmation_email"    // Registered but got no confirmation
  | "calendar_invite_not_received" // No calendar invite received
  | "other";                   // Catch-all

/** Human-readable labels for the dropdown */
export const TICKET_ISSUE_LABELS: Record<TicketIssueType, string> = {
  broken_link: "Broken Link",
  missing_registration_link: "Missing Registration Link",
  no_confirmation_email: "No Confirmation Email",
  calendar_invite_not_received: "Calendar Invite Not Received",
  other: "Other",
};

/** Lifecycle states of a support ticket */
export type TicketStatus = "Open" | "In Progress" | "Resolved" | "Closed";

// ---------------------------------------------------------------------------
// SupportTicket
// ---------------------------------------------------------------------------

export interface SupportTicket {
  /** UUID v4 — generated on creation */
  id: string;

  /** ISO 8601 timestamp of creation — e.g. "2026-05-14T09:30:00.000Z" */
  createdAt: string;

  /** Optional reference to the session this ticket concerns */
  sessionId?: string;

  /**
   * Denormalised session name cached at ticket creation time.
   * Allows displaying the ticket without a session lookup (offline safe).
   */
  sessionName?: string;

  issueType: TicketIssueType;

  /** Mandatory free-text description from the associate */
  description: string;

  /** Optional contact email for follow-up */
  userEmail?: string;

  /** Ticket lifecycle status; always "Open" on initial creation */
  status: TicketStatus;
}

// ---------------------------------------------------------------------------
// Input DTO
// ---------------------------------------------------------------------------

/**
 * Shape of data collected from the support form before persistence.
 * The repository fills in id, createdAt, and status automatically.
 */
export interface CreateTicketInput {
  sessionId?: string;
  sessionName?: string;
  issueType: TicketIssueType;
  description: string;
  userEmail?: string;
}
