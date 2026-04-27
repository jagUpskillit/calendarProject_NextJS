# Quarterly Calendar Explorer (QCE) — Technical Appendix

**Date:** 27-Apr-2026  
**Project:** `calendarProject_NextJS`  
**Audience:** Management, IT Platform, Security, M365 Admin, Azure Admin

## 1) Solution snapshot
QCE is a Next.js web application that currently supports:
- Excel/CSV import and normalization of training session data.
- Deduplicated session catalog with search/filter/sort.
- AI assistant and insights dashboard with exportable reports.

Current pilot mode stores imported data in browser local storage. Enterprise mode requires Microsoft identity + SharePoint integration + managed hosting + governed AI.

## 2) Architecture (current vs target)

### Current (pilot)
- **Client/UI:** Next.js App Router, React, TypeScript
- **Data source:** Manual file upload (Excel/CSV)
- **Storage:** Browser local storage
- **AI path:** API route + optional OpenAI key from environment

### Target (enterprise)
- **Auth:** Microsoft Entra ID SSO
- **Data ingest:** SharePoint document library/folder via Microsoft Graph
- **Operational store:** SharePoint Lists (or approved enterprise datastore)
- **Hosting:** Azure App Service or Azure Static Web Apps (enterprise-approved)
- **Secrets/identity:** Managed identity + Azure Key Vault
- **AI:** Azure OpenAI (recommended governed enterprise pattern)

## 3) Required support and access (corrected + implementation-ready)

## 3.1 Entra ID for SSO (Windows/Azure AD sign-in)
**Need from IT/Identity Team:**
- Entra app registration for QCE web app.
- Redirect URI setup for environments (dev/test/prod).
- Token configuration and app roles/groups (if role-based access required).
- Client ID / tenant metadata shared with dev team.

**Why:** Enables enterprise sign-in and access control.

---

## 3.2 Hosting and publishing approvals
**Need from Cloud/Platform Team:**
- Approved hosting target (`Azure App Service` or `Azure Static Web Apps`).
- CI/CD path and environment provisioning (dev/test/prod).
- Network and security baselines (TLS, WAF, headers, diagnostics).

**Correction to earlier ask:**
- `Copilot Studio` is **not** the platform to host/publish a Next.js web app.

---

## 3.3 SharePoint file access via Microsoft Graph
**Need from M365/SharePoint Admin + Security:**
- Access to target SharePoint site/document library/folder storing Excel files.
- Graph API permission model (prefer least-privilege):
  - `Sites.Selected` (recommended) + explicit site grant
  - and required file read scopes for document retrieval.
- Consent/admin approval workflow completed.

**Why:** Enables automated pull/read of Excel schedule files from SharePoint.

---

## 3.4 SharePoint site integration permissions
**Need from SharePoint Site Owners:**
- Permission to surface/publish the app link/embed in target SharePoint pages.
- Site-level access for service identity and app integration tasks.

**Why:** Makes the application available in the intended employee portal experience.

---

## 3.5 SharePoint List permissions (operational datastore)
**Need from M365/SharePoint Admin:**
- Permission to create/manage SharePoint Lists for operational records such as:
  - import run metadata
  - processing history / audit trail
  - assistant/insight usage metadata (if approved)
  - configurable masters and support entities

**Why:** Provides an M365-native persistent store for app metadata.

---

## 3.6 AI platform access (recommended: Azure OpenAI)
**Need from AI/Cloud/Security Team:**
- Provision Azure OpenAI resource and approved model deployment.
- Access strategy for app (managed identity preferred, secret fallback via Key Vault).
- Content filtering, logging, and usage policy alignment.

**Correction to earlier ask:**
- For API-key/model access in this app, request **Azure OpenAI** resource access.
- `Copilot Studio` is optional for agent orchestration scenarios, but not required for this direct app integration pattern.

## 4) Minimum security/governance controls required
- Entra ID authentication and least-privilege authorization.
- Secrets in Key Vault (no plain secrets in repo/client).
- Audit logs for import and key data operations.
- Data classification confirmation (training schedule + metadata).
- Environment separation (dev/test/prod) and release approvals.

## 5) Ownership matrix (proposed)
- **Business Owner:** Learning Operations / Program Office
- **Product/Engineering:** QCE Delivery Team
- **Identity:** Entra ID Admin Team
- **M365 Data:** SharePoint Admin/Site Owners
- **Cloud Platform:** Azure Hosting Team
- **Security:** InfoSec + Compliance Reviewers
- **AI Governance:** Enterprise AI/Responsible AI Team

## 6) Dependencies to unblock in order
1. Entra app registration and SSO metadata.
2. SharePoint site/folder access and Graph permissions + consent.
3. Hosting environment provisioning.
4. Azure OpenAI + Key Vault access pattern.
5. Security sign-off and production release gate.

## 7) Risks if dependencies are delayed
- App remains in pilot/local-storage mode.
- No automated SharePoint ingestion.
- No enterprise SSO rollout.
- AI usage may be blocked by governance controls.

## 8) Suggested ask in meeting (short form)
"The application is feature-ready for pilot. To move into enterprise production, we need Entra SSO registration, Graph/SharePoint access grants, approved Azure hosting, SharePoint List permissions, and Azure OpenAI governed access. We request named owners and target timelines for each dependency."
