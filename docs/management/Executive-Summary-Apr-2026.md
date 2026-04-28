# Quarterly Calendar Explorer (QCE) — Executive Summary

**Date:** 28-Apr-2026  
**Project:** `calendarProject_NextJS`  
**Current Stage:** Pilot-ready (feature complete for internal demo)

## 1) What this solution does
Quarterly Calendar Explorer is a web application for Cognizant learning operations teams to:
- Import quarterly training schedules from Excel/CSV.
- Normalize and deduplicate session data automatically.
- Search, filter, and browse sessions quickly.
- Use AI chat to answer schedule-related questions.
- View an Insights dashboard for business trends and KPI-style analysis.

## 2) What has been delivered
### Core data and import pipeline
- Admin import flow for Excel/CSV.
- Parsing + normalization for mixed source formats.
- Duplicate merge and stable ID handling to avoid duplicate cards/keys.
- Capability heading capture from Be.Cognizant XLSX (merged/yellow section headers) and propagation to session-level capability.
- Imported-data-first mode (sample fallback removed from active user flow).

### Masters and governance utilities
- Full CRUD for capability, program, facilitator, geo, and holiday masters.
- 2-column masters UX for compact entities; Program/Holiday kept as full-width sections.
- Capability master auto-backfill during Be.Cognizant import with case-insensitive de-duplication.

### Session discovery experience
- Search + multi-filter + sorting on sessions.
- Clean empty states when no imported data or no filter matches.
- Session detail drilldown.

### AI assistant capabilities
- Floating AI chat assistant integrated into main experience.
- Unread indicator for assistant replies when panel is closed.
- Deterministic response fallback + optional OpenAI-backed response path.

### Insights and analytics
- Dedicated `/insights` page.
- KPI cards, summary narrative, breakdowns, trend views.
- Interactive filtering and export (`CSV`, `JSON`) from filtered insight context.
- Current filters live: geo, capability, delivery mode, facilitator.
- Pending in next enhancement pass: date-range filter, ratings/tag filters.

### UI modernization
- Cognizant-inspired visual refresh (color system, section framing, cards, header/footer, assistant styling).
- Consistent branding layer while preserving current information architecture.

## 3) Business value achieved so far
- Reduces manual effort in consolidating quarterly training calendars.
- Improves discoverability of sessions across geographies/capabilities/facilitators.
- Enables faster management conversations through AI summaries and insight views.
- Provides a strong foundation for enterprise rollout once identity/data/security integration is approved.

## 4) Current technical posture
- Frontend framework: Next.js (App Router) + React + TypeScript.
- Current persistence mode for pilot: browser local storage (for imported bundle and related metadata).
- Production readiness items pending: enterprise authentication, governed data source integration, managed hosting, and secrets/compliance setup.

## 5) Decisions and support needed from management
1. Approve enterprise rollout path using Microsoft stack (`Entra ID`, `Graph`, `SharePoint`, `Azure hosting`, `Azure OpenAI`).
2. Nominate IT owner(s) for identity, SharePoint permissions, and security review.
3. Confirm production hosting target and timeline.
4. Approve access provisioning listed in technical appendix.

## 6) Proposed next phase (after access approvals)
- **Phase A:** Entra ID SSO integration and role model.
- **Phase B:** Replace local import with SharePoint folder ingestion via Microsoft Graph.
- **Phase C:** Move operational data (metadata/config/history) to SharePoint Lists (or approved enterprise datastore).
- **Phase D:** Harden security, logging, and deployment (Key Vault, managed identity, audit).

---

## One-minute management ask
We have a strong pilot-ready product. To move from demo to enterprise production, we need management support for Microsoft identity/data/hosting access and security governance approvals. Once these dependencies are unlocked, the team can execute production integration in the next implementation cycle.
