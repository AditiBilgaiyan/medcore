# MedCore HMS — Frontend

Next.js 15 frontend for **MedCore HMS**, a multi-tenant hospital management platform covering appointments, electronic medical records, prescriptions, laboratory, pharmacy, billing and a patient self-service portal for nine user roles.

The app runs end-to-end on its own: a built-in **mock API** (in the browser, persisted to IndexedDB) implements the REST contract from the PRD with realistic seeded data. Point it at the NestJS backend by flipping one environment variable.

## Quick start

```bash
pnpm install
cp .env.example .env.local      # mock API is on by default
pnpm dev                         # http://localhost:3000
```

Sign in with any demo account (password **`Demo@1234`**), or use the one-click list on the login page:

| Role | Email |
|---|---|
| Super Admin | superadmin@medcore.dev |
| Hospital Admin | admin@citycare.dev |
| Doctor | dr.mehta@citycare.dev |
| Nurse | nurse.fernandes@citycare.dev |
| Receptionist | reception@citycare.dev |
| Lab Technician | lab@citycare.dev (second tech for approvals: lab.senior@citycare.dev) |
| Pharmacist | pharmacy@citycare.dev |
| Accountant | accounts@citycare.dev |
| Patient | aarav.sharma@mail.dev |

A second tenant (Sunrise Clinic, admin@sunrise.dev) exists so you can check that tenants are isolated. Demo data lives only in your browser. Reset it under **Settings → Reset demo data**. It also reseeds itself automatically when it is more than 5 days old, so "today" always has appointments.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server (Turbopack) |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm lint` · `pnpm typecheck` · `pnpm format` | ESLint · `tsc --noEmit` · Prettier |
| `pnpm test` · `pnpm test:coverage` | Vitest unit, component and API-contract tests |
| `pnpm test:e2e` | Playwright end-to-end tests (builds and starts the app if it isn't running; first run `pnpm exec playwright install chromium`) |

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_USE_MOCK_API` | `true` | `false` sends requests to the real API |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001/api/v1` | NestJS REST base URL |
| `NEXT_PUBLIC_WS_URL` | `http://localhost:3001` | Socket.IO server for live notifications |

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui (Radix) · TanStack Query v5 · Zustand · React Hook Form + Zod · Recharts · Framer Motion · date-fns · Socket.IO client · DOMPurify · Vitest + Testing Library.

## Project structure

```
src/
  app/
    (auth)/            login, register, verify-email, forgot/reset password
    (dashboard)/       staff app: dashboard, patients, appointments, encounters (EMR),
                       prescriptions, wards, lab, pharmacy, billing, hospitals,
                       departments, staff, doctors, availability, analytics,
                       audit-logs, notifications, search, settings
    (portal)/portal/   patient self-service portal
  components/
    ui/                shadcn/ui primitives (don't modify)
    shared/            DataTable, StatCard, StatusBadge, guards, documents, PaymentDialog…
    modules/           feature components (dashboard, emr, appointments, lab, pharmacy, billing…)
    layout/            app shell: sidebar, top bar, ⌘K search, notifications, user menu
  hooks/               useAuth, useRealtime, useDebounce
  services/            TanStack Query hooks per domain + query-key factory
  store/               Zustand: auth, notifications, sidebar
  lib/
    api/client.ts      fetch wrapper: envelope unwrap, 401 → refresh → retry, CSRF header
    mock/              mock API: router, handlers per module, seed data, IndexedDB storage
    format.ts · clinical.ts · validation.ts · sanitize.ts
  constants/           routes, roles, permission matrix, navigation, config
  types/               domain models, enums, API request/response types
```

## Architecture notes

- **API contract**: every call goes through `lib/api/client.ts` and expects the PRD envelope (`{ success, data, message }`, `{ success, data, meta }` for lists, `{ success: false, error: { code, message } }` for errors). Components catch errors by `ApiError.code`, for example `SLOT_UNAVAILABLE`, `ALLERGY_CONFLICT` or `VERSION_CONFLICT`.
- **Auth**: the access token (15-minute TTL) is held in memory only (Zustand). The refresh token is an httpOnly cookie, and it is rotated on every refresh. If a rotated token is used again, the whole session family is revoked. On a 401 the client makes one shared refresh call and then retries the original request. State-changing requests send `X-CSRF-Token` taken from the `csrf_token` cookie.
- **RBAC**: `constants/permissions.ts` copies the backend's permission matrix. Route access is enforced by `AuthGuard`, using the most specific matching rule in `ROUTE_ACCESS`. Navigation and individual actions are hidden with `can()` / `<Can>`. The frontend checks are for usability only. The API remains the authority: every request is checked for both role and tenant.
- **Multi-tenancy**: every query is scoped to the caller's `hospitalId` on the server. A record from another tenant returns 404, not 403, so its ID can't be probed.
- **Server state**: TanStack Query with a domain-scoped query-key factory. Mutations invalidate whole domains. Errors raise a toast through a global `MutationCache` handler; forms that show errors inline opt out with `meta.silentError`.
- **Real time**: `useRealtime` subscribes to Socket.IO (`notification:new`), or to an in-browser event bus in mock mode. Each event updates the bell, shows a toast and invalidates the affected queries.
- **Payments**: the client never marks an invoice as paid. Checkout creates a gateway session; the invoice changes only when the server receives a webhook with a valid signature. In mock mode, the payment dialog plays the part of the gateway.
- **Printing / PDF**: prescriptions, lab reports and invoices are print-styled documents. With the real API, "Download PDF" opens `GET …/pdf` (rendered by Puppeteer on the backend). In mock mode it opens the browser's print dialog.

## Domain rules implemented

- Appointment lifecycle `PENDING → CONFIRMED → IN_PROGRESS → COMPLETED | CANCELLED | NO_SHOW`, with optimistic concurrency (`version`), slot conflict detection, a check that a patient can't be booked twice at the same time, and emergency bookings that bypass slot availability.
- Weekly doctor schedules with leave exceptions. Free slots are calculated from the schedule minus existing bookings.
- Append-only EMR: notes can't be edited or deleted, and only addenda can be added after a record is finalised. BMI is calculated automatically. Diagnoses use ICD-10 codes, and attachments are limited to 20 MB and to PDF and image types.
- Prescriptions check for allergy conflicts and require explicit confirmation to override.
- Lab workflow `ORDERED → SAMPLE_COLLECTED → PROCESSING → PENDING_APPROVAL → APPROVED/REJECTED`. Values are flagged against gender-specific reference ranges, including critical limits. A different technician must approve the results (four-eyes check).
- Pharmacy dispenses first-in-first-out by expiry. Expired stock is never dispensed and can be quarantined. Low-stock and expiry alerts are raised, and the nightly expiry scan can be run on demand.
- Billing collects charges from consultation, lab and pharmacy into one invoice per visit. Line-item totals always match the invoice total. Payments can be cash, Stripe card, or Razorpay UPI/netbanking. Insurance claims follow a TPA workflow.
- Every write is recorded in the audit log.

## Tests

`pnpm test` runs:

- **API contract tests** (`src/lib/mock/__tests__/api.test.ts`) covering the PRD's mandatory scenarios: tenant isolation, patient privacy, simultaneous bookings of the same slot (only one succeeds), refresh-token reuse, expired stock that can't be dispensed, and invoice totals matching line items. They also cover version conflicts, RBAC, self-approval and webhook signature checks.
- **Unit tests** for clinical helpers, formatters, validation and the permission/route matrix.
- **Component tests** for StatusBadge, DataTable and ConfirmDialog.

`pnpm test:e2e` runs Playwright against the built app:

- **Smoke**: every role signs in and opens each of its screens. The test fails on any console error, any failed data load, or an "access denied" screen. It also checks that route guards block roles from screens outside their permissions.
- **Journeys**: a patient pays a bill through the gateway flow; a patient requests an appointment; a doctor runs a full encounter (vitals with BMI, ICD-10 diagnosis, a penicillin-allergy override on a prescription, completing the visit).
- **Mobile**: key patient and staff screens at phone width, with no horizontal scrolling.

## Connecting the real backend

1. Set `NEXT_PUBLIC_USE_MOCK_API=false` and `NEXT_PUBLIC_API_URL`.
2. The API must allow credentialed CORS requests from the frontend origin and set the refresh cookie (`HttpOnly; Secure; SameSite=Strict`) on `POST /auth/login` and `POST /auth/refresh`.
3. Endpoints, payloads and error codes are defined by `src/types/api.ts` and the handlers in `src/lib/mock/handlers/`, which serve as the reference implementation.

## Deployment

- **Vercel**: import the repo, set the environment variables above, and deploy.
- **Docker**: `docker build --build-arg NEXT_PUBLIC_API_URL=https://api.example.com/api/v1 -t medcore-web .` then `docker run -p 3000:3000 medcore-web`. The image uses `output: "standalone"`.
- **CI**: `.github/workflows/frontend-ci.yml` runs lint, type-check, unit tests with coverage, a build, and then the Playwright suite on every pull request and every push to `main`.
