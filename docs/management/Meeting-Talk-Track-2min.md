# QCE Meeting Talk Track (2 Minutes)

**Date:** 28-Apr-2026  
**Project:** Quarterly Calendar Explorer (QCE)

## 1) Opening (15–20 sec)
Good [morning/afternoon]. We have completed a major upgrade of Quarterly Calendar Explorer and it is now pilot-ready. The product is stable for demo and internal adoption, and today we need management support to move it into enterprise production mode.

## 2) What is delivered (35–45 sec)
We now have:
- End-to-end Excel/CSV import pipeline with normalization and deduplication.
- Capability heading capture from Be.Cognizant sheets, with capability assignment to imported sessions.
- Master utilities with CRUD for capability/program/facilitator/geo/holiday and safer bulk master import/export controls.
- Session discovery with search, filters, sorting, and detail view.
- AI chat assistant for schedule questions, with unread indicators and improved UX.
- Dedicated Insights dashboard with KPI-style summaries, trends, breakdowns, filters, and CSV/JSON export.
- Cognizant-inspired UI refresh for a more enterprise-ready user experience.

Current pilot mode uses browser-local storage, which is fine for demos but not for production rollout.

## 3) Business value (20–25 sec)
This solution reduces manual consolidation effort, improves discoverability of learning sessions, and gives management quicker visibility into training trends and gaps through the Insights and AI layers.

## 4) Support needed from management (40–50 sec)
To go live in enterprise mode, we need approval and owner assignment for six dependencies:
1. **Entra ID SSO** for enterprise authentication.
2. **Azure hosting target** approval for the Next.js app (App Service or Static Web Apps).
3. **Microsoft Graph + SharePoint file access** to read Excel files from approved folders.
4. **SharePoint site integration access** to publish/launch from portal pages.
5. **SharePoint List permissions** for operational metadata storage.
6. **Azure OpenAI governed access** for production AI integration (with Key Vault/security controls).

## 5) Ask / close (15 sec)
Our ask today is simple: please confirm these dependencies, assign owners, and approve timelines. Once these are unblocked, we can execute enterprise integration in the next delivery cycle.

---

## Optional 30-second fallback summary
QCE is feature-ready for pilot and already delivering value in data ingestion, discovery, and AI insights. To move to enterprise production, we need management-backed enablement for Entra SSO, SharePoint/Graph permissions, approved Azure hosting, SharePoint Lists, and Azure OpenAI governance.

---

## Likely Questions + Suggested Answers

### Q1) Why can’t we go live immediately?
Because pilot data currently lives in browser-local storage. Production requires enterprise identity, governed data access, managed hosting, and security controls.

### Q2) Why not use Copilot Studio for everything?
Copilot Studio can support bot orchestration use cases, but this app’s direct web integration path is better served by Azure hosting + Graph + Azure OpenAI with Entra-based governance.

### Q3) What is the main risk if approvals are delayed?
The app remains pilot/demo-only and cannot be safely scaled for organization-wide use.

### Q4) What do you need from management today?
Decision on rollout path, named owners for each dependency, and target dates for access provisioning.
