# CalendarProject_v1 (DEV Prototype)

Associate-facing quarterly training calendar prototype built with Next.js App Router + TypeScript.

## Scope (Phase 1)

- Local dataset only (`public/data/sessions.json`)
- Session browse/search/filter/sort
- Session details page with registration behavior
- Support ticket form + localStorage ticket list
- Assistant-lite panel (rule-based dataset search)

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- Vitest (unit tests for parsing/normalization)

## Routes

- `/` — Home listing with search/filters + Assistant-lite
- `/sessions/[id]` — Session details + related sessions
- `/support` — Support ticket creation and ticket list

## Project Structure

```text
src/
  app/
    page.tsx
    sessions/[id]/page.tsx
    support/page.tsx
  components/
    assistant/AssistantLitePanel.tsx
    sessions/HomeClient.tsx
    sessions/SessionCard.tsx
    support/SupportClient.tsx
    ui/*
  lib/
    repository/*
    services/sessionData.ts
    services/ticketStorage.ts
    utils/dataUtils.ts
    utils/dataUtils.test.ts
  types/
    session.ts
    ticket.ts
public/
  data/sessions.json
```

## Setup

```powershell
cd "c:\Jag\Trainings\Projects\CalendarProject_v2\calendar-project-v1"
npm install
```

## Run (Dev)

```powershell
npm run dev
```

Open `http://localhost:3000`.

## Build (Production Check)

```powershell
npm run build
npm run start
```

## Tests

```powershell
npm run test
```

Watch mode:

```powershell
npm run test:watch
```

## How to change dataset

1. Edit `public/data/sessions.json`.
2. Keep each record aligned with `Session` in `src/types/session.ts`.
3. Required fields for robust behavior:
   - `id` (stable unique)
   - `programName`
   - `deliveryMode` (`Virtual` | `In-Person` | `Hybrid` | `Unknown`)
4. Optional fields are supported safely (no crash on missing values):
   - `objectives`, `facilitator`, `scheduleRaw`, `dateISO`, `geo`, `targetAudience`, `registrationLink`, etc.

## Registration behavior (Phase 1)

- If `registrationLink` exists and is valid: **Register** opens in a new tab.
- If missing/null: user is redirected to `/support` with session preselected.

## Support persistence

Support tickets are stored in browser localStorage under key:

- `calendarproject_v1_support_tickets`

This persists across refreshes in the same browser profile.

## Data-layer abstraction for future migration

The repository contract is defined in:

- `src/lib/repository/SessionRepository.ts`

Phase 1 implementation:

- `src/lib/repository/LocalSessionRepository.ts`

When SharePoint/Dataverse access is available, add a new repository implementation and swap the binding without changing page/component code.

## Known Phase 1 limitations

- No authentication
- No seat validation/waitlist/reminders/email invites
- No backend DB (local JSON + localStorage only)
- Assistant is rule-based search (not LLM)
