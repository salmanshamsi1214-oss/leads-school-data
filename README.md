# LEADS School System — Zeenat Campus

A production-ready, attendance-first school management system for
**LEADS School System — Zeenat Campus, Dera Ghazi Khan**
(Kangan Road, Near Jalbani Petrol Pump · 0332-6241440 · 0330-9082020).

## Tech stack

- **Vite + React 19 + TypeScript** frontend
- **Tailwind CSS v4** + **shadcn/ui** + **Lucide icons**
- **Recharts** for dashboard analytics
- **Convex** as the backend and database (real database, auth, and
  server-enforced permissions; replaces the Supabase request in the original
  brief — this environment runs on Convex, which provides the same guarantees)
- **Convex Auth** (email OTP + guest) for authentication
- **Framer Motion** for UI motion
- PWA: `public/manifest.webmanifest` + `public/sw.js` (static shell only)

## Modules implemented

| Module | What it does |
| --- | --- |
| Dashboard | Today's present/absent/late/leave counts, present rate, 14-day trend, per-class present rates, today's absent/late list, today's teacher attendance, and this month's fee collection summary |
| Mark Attendance | Date + class + section picker, per-student Present/Absent/Late/Leave toggles, "mark all present", atomic bulk save with duplicate prevention |
| Students | Add / edit / archive / re-activate, search + class/section/status filters, profile with monthly attendance summary, CSV export |
| Classes | Class CRUD with section chips (Nursery → Matric), student counts, delete guard when students are enrolled |
| Teachers | Staff register (subject, designation, class-teacher assignment, qualification, phone, CNIC, salary) with add / edit / archive; daily teacher attendance roll with bulk save |
| Fee Management | Monthly fee structures per class, automatic monthly due list with expected/collected/outstanding summary, payment collection (cash / bank / EasyPaisa / JazzCash) with receipt numbers, collections register + CSV export |
| Reports | Daily summary (print + CSV), class monthly report, student history, absent/late list — all with CSV export |
| Auth & roles | Email-OTP + guest sign-in; the **first account becomes the school admin**. Roles: admin, principal, vice principal, accountant, teacher, receptionist, librarian (+ parent/student reserved). Admin manages roles on the Staff & Roles page |
| Staff & Roles | Admin-only page listing every account; assign/change school roles |

## Role-based access

Permissions are enforced **on the server** (`src/convex/permissions.ts`), so
the UI gate is only the visible layer:

- **Read access** to school data: all staff roles (incl. teachers)
- **Student / class management**: admin, principal, vice principal, receptionist
- **Fee management**: admin, principal, vice principal, accountant
- **Teacher records**: admin, principal, vice principal
- **Teacher attendance marking**: office staff (all staff except teachers)
- **Account roles**: admin only
- Accounts with the plain `user` role (or none assigned) see the restricted
  screen until an admin promotes them on **Staff & Roles**.

## Data model (Convex)

- `classes` — name, sections (`["A","B",…]`), display order
- `students` — name, fatherName, rollNumber, classId, section, status
  (`active`/`left`), admissionDate, phone
- `attendance` — one record per student per date (upserted), status
  (`present`/`absent`/`late`/`leave`), markedBy
- `teachers` — name, subject, designation, classId (class teacher), phone,
  CNIC, email, qualification, joiningDate, salary, status
- `teacherAttendance` — one record per teacher per date, like student attendance
- `feeStructures` — classId, label, amount, period (`monthly`/`annual`/`admission`)
- `feePayments` — studentId, period (`YYYY-MM`), amount, method, date,
  receiptNo (`RC-YYYYMM-####`), receivedBy

## Setup

```bash
bun install
bun convex dev --once   # codegen + push functions (non-interactive)
bun dev                 # run the dev server
```

### Environment variables

Convex credentials (`VITE_CONVEX_URL`, `CONVEX_DEPLOYMENT`) are provided
automatically by the Freebuff platform. Auth uses server-side env vars
(`JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL`) that are already configured.
No secrets are hardcoded in the frontend and no service-role keys exist in
the browser bundle.

## Deploying (GitHub → Vercel/Netlify → Convex)

1. Push the repo to GitHub.
2. Create a Convex deployment (`npx convex deploy`) and set `VITE_CONVEX_URL`
   (and `CONVEX_DEPLOYMENT` if needed) in your host's environment.
3. Build with `bun run build` and deploy the `dist/` output.
4. The PWA manifest and service worker are served from `public/` and work
   over the production HTTPS domain.

## Known limitations

- Parent and student portal roles are reserved in the role system but do not
  yet have their own views; the school modules are staff-facing.
- The service worker caches only the static app shell — data is always
  fetched fresh from Convex (no offline data claims).
- Guest ("anonymous") accounts are intended for trying the demo; a real
  deployment should use email sign-in so accounts can be identified.
