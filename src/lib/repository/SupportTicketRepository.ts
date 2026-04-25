/**
 * SupportTicketRepository.ts — Data access abstraction for support tickets.
 *
 * Phase 1: localStorage via LocalTicketRepository.
 * Phase 2: SharePoint list / Dataverse / ServiceNow REST.
 */

import type { SupportTicket, CreateTicketInput, TicketStatus } from "@/types";

export interface SupportTicketRepository {
  /** Persist a new ticket; fills in id, createdAt, status automatically */
  create(input: CreateTicketInput): Promise<SupportTicket>;

  /** Return all tickets, newest first */
  getAll(): Promise<SupportTicket[]>;

  /** Update lifecycle status; returns updated ticket or undefined if not found */
  updateStatus(id: string, status: TicketStatus): Promise<SupportTicket | undefined>;

  /** Hard-delete a ticket by id */
  delete(id: string): Promise<void>;
}
