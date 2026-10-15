# FitZone Gym Membership Management

React + TypeScript + Tailwind frontend, Google Apps Script backend, and a Google
Sheets database. One installation per gym, sold as a one-time product. No
subscription service, external database, or paid messaging API is introduced.

**New gym installation:** follow [the simple installation guide](INSTALLATION.md).
Paste only [FitZone_Complete.gs](backend/generated/FitZone_Complete.gs) into one
Apps Script editor file. The three original backend files remain the maintained
source; the combined installation is generated and tested automatically.

Development is consolidated on **main**. Production Apps Script, Google Sheets,
GitHub Pages assets and Vercel deployments have not been changed. Real Google
runtime acceptance remains outstanding. Start with the [release report](docs/RELEASE_REPORT.md)
and [ordered manual acceptance checklist](docs/FINAL_ACCEPTANCE.md).

## Run locally

Use Node.js 24 and npm:

```powershell
npm ci
Copy-Item .env.example .env.local
# Edit .env.local: set the disposable staging VITE_APPS_SCRIPT_URL and branding.
npm run dev
```

Open `http://localhost:5173/` (or the local URL Vite prints). A fresh visitor sees
Member Lookup. Missing configuration produces a contact-the-gym message when
lookup is attempted; customers never see an API setup form. There is no local
backend server: actual owner/member requests need your separately prepared test
Apps Script deployment. Browser tests intercept a synthetic endpoint instead.

## Owner features

- Owner ID/password login, server-side session checks, absolute 30-minute expiry,
  revocation on logout and credential rotation, bounded failed-login throttling.
- Sessions stay only in page memory. Reload requires login. Passwords, hashes
  and bearer credentials are never written to browser storage or URLs. Legacy
  saved credentials are erased when owner session handling runs.
- Add, edit, renew and confirm deletion. All four plans: **1 Month, 3 Months,
  6 Months, 1 Year**. Validation protects dates, measurements and Sheet writes.
- Four statistics and filters: All/Total, Active, Expiring Soon, Expired.
  Expiring Soon means active with 0–7 calendar days remaining, inclusive.
- Search ID/name/phone, ascending expiry order, pagination, readable errors and
  empty states, and explicit Refresh with last-refresh time. Refresh reads direct
  Sheet changes; realtime synchronization is not implemented.
- Stale dashboard edits/renewals/deletes detect a previously changed row and ask
  the owner to Refresh. Direct human edits during a write still need coordination.
- Owner-only WhatsApp links validate Indian mobile numbers and prepare a
  personalized renewal message. The owner must press Send manually in WhatsApp.
  There is no automatic sender. Missing/invalid numbers show a correction message.
- Responsive member cards and labeled forms; keyboard-managed modal focus,
  Escape/close, delete confirmation, loading states and 44px action targets.

## Public lookup and privacy

Members enter a simple numeric ID. `1` and legacy `001` remain compatible. Public
JSON returns only `id`, pseudonym `name` (`Member #1`), `membershipType`, `endDate`,
`status` and `daysRemaining`. Names, phones (even masked ones), age, weight, start
dates, owner data and row-version fingerprints are excluded.

IDs remain predictable. Someone can still enumerate IDs and discover whether a
membership exists, its plan, expiry and status; this is **not identity verification**
or strong access control. A pseudonym and strict allowlist are the smallest privacy
reduction compatible with ID-only lookup. Sensitive installations should disable
public lookup or adopt a separate verified lookup design before release. No public
rate limiter, member authentication, or anonymity guarantee is claimed.

## Backend and Sheet compatibility

For new gyms, paste only `backend/generated/FitZone_Complete.gs` into one Apps
Script file, with V8 and Asia/Kolkata. Existing installations using the original
`backend/Code.gs`, `backend/Auth.gs` and `backend/Bcrypt.gs` remain supported.
Never install both forms in the same project. Source is separate from the deployed
Google version. Do not upload local untracked backend drafts or old frontend assets.

| Column | Meaning |
| --- | --- |
| A | Member ID |
| B | Name |
| C | Phone, plain text |
| D | Age |
| E | Weight |
| F | Membership Plan |
| G | Start Date |
| H | End Date |
| I | Notified |

Required private properties: `OWNER_ID`, `OWNER_PASSWORD_HASH`, `SPREADSHEET_ID`,
`MEMBER_SHEET_NAME`. Keep the existing `MEMBER_ID_HIGH_WATER_MARK`. In the
disposable staging installation it **must be at least 3**, because ID 3 was
already issued/deleted; retain any higher trusted value. Never lower/reset it.
New IDs are unpadded; failed writes/deletions may leave gaps. CRUD reserves IDs
and flushes writes under ScriptLock. Invalid/duplicate Sheet records fail safely.

Dates use real calendar arithmetic in Asia/Kolkata, clamped at month end/leap
boundaries. The end date is inclusive: one month from 31 January 2026 ends on
28 February, active through that day. Renewal starts strictly after current expiry,
uses the explicit entered start, preserves paid time and returns the new expiry.
Contact-only edits retain custom expiry and I; term changes/renewal reset I.
The nine-column model retains only the current stored term; status remains based
on expiry, including before a future renewal start. It is not a payment/history system.

Phone cells are strings. Explicit existing Sheet zero-padding can be retained;
digits already lost to numeric conversion cannot be invented. Names and positive
age/weight are validated server-side, and formula-like name input is rejected.

See [private authentication setup](backend/OWNER_AUTH_SETUP.md),
[membership compatibility](docs/MEMBERSHIP_CORRECTNESS.md), and
[real Google session verification](docs/SERVER_SESSION_VERIFICATION.md).

## Expiry email notifications

`checkMembershipExpiries()` is off unless `EXPIRY_EMAIL_ENABLED=true`. It requires
a valid private `ADMIN_EMAIL`; optional `GYM_NAME`/`GYM_LOCATION` customize email
branding. No trigger is installed automatically. Keep delivery disabled during
the current acceptance pass.

Active memberships expiring in 0–7 days qualify; expired memberships do not.
Per-member/term fingerprints and attempt/completion records live in Script
Properties at `EXPIRY_NOTICE_<ID>`, without adding Sheet columns. Notification
runs share ScriptLock with CRUD. I is set only after Gmail submission and a sent
journal entry; contact-only edits cannot cause repeats. Failed submissions back
off for an hour, at most three attempts while eligible. Pending/ambiguous attempts
require checking Sent mail before explicit reconciliation.

**Safe editor dry run: `previewSyntheticExpiryNotifications()`** uses only
synthetic examples and touches neither Sheets, Properties nor Gmail.
`checkMembershipExpiries(true)` is a separate read-only preview of the configured
Sheet. Exactly-once delivery cannot be guaranteed across Gmail/Properties/Sheets;
see [the retry and reconciliation policy](docs/NOTIFICATIONS.md).

## Per-gym branding and Vercel preparation

Use `.env.local` locally, or public build-time environment settings later. The
allowlisted keys are documented in `.env.example`: gym name/tagline/description,
trainer, address/map, logo, gallery, contacts and `VITE_APPS_SCRIPT_URL`. Defaults
and bundled gallery photos live in `src/config/gymConfig.ts`. Set the backend's
optional `GYM_NAME`/`GYM_LOCATION` properties to matching email branding.

Every `VITE_*` value is public. **Never put owner passwords, bcrypt hashes,
session credentials or private Google configuration in frontend environment
variables.** The endpoint must be Google's HTTPS `/macros/s/.../exec` URL without
query credentials. A built endpoint takes precedence over the legacy public-only
browser endpoint preference. URL validation rejects arbitrary credential destinations.

The Vite base is `/`; the application uses state navigation at the root URL.
For a later, explicitly authorized Vercel staging deployment:

| Setting | Value |
| --- | --- |
| Framework | Vite |
| Root Directory | repository root (`.`) |
| Node.js | 24.x |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Environment | disposable staging `VITE_APPS_SCRIPT_URL` plus public branding |

Rebuild after changing public configuration. No Vercel deployment was performed.
Legacy `docs/index.html`, `docs/assets/` and `gh-pages` remain unchanged and do
not represent this source. The old `npm run deploy` command publishes to GitHub
Pages; do not run it during staging preparation.

References: [Vite environment variables](https://vite.dev/guide/env-and-mode),
[Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite),
[official WhatsApp click-to-chat](https://faq.whatsapp.com/5913398998672934).

## Verification

```powershell
npm ci
npm run generate:backend
npm test
npm run typecheck
npm run lint
npm run build
npx playwright install chromium
npm run test:browser
```

Unit/integration tests run the actual Apps Script source in a VM with synthetic
Sheets/Gmail/Properties/Lock services. Browser tests run Chromium against local
Vite and that mocked backend, blocking nonlocal requests except an intercepted
synthetic endpoint. They cover 320/375/390/768/1024/1440px, all dialogs and keyboard
focus, CRUD/refresh/stale edits, public privacy, logout and server session expiry.
They never follow WhatsApp links or send actual messages.

`npm test` runs the suite once for the maintained source and again for the generated
installation. Six explicit source-file-order tests still check the original files.
`npm run check:backend` verifies that the ready-to-paste file matches its inputs;
`npm run generate:backend` rebuilds it, and `npm run build` does so automatically.
CI also exercises browser workflows against the generated backend.

CI runs locked installation, tests, typecheck, lint, build and Chromium tests on
pull requests and main pushes, without Google secrets or deployment steps.
Sanitized screenshots are generated under ignored `test-results/browser/`.
Actual Google OAuth, ContentService redirects/CORS, real concurrent execution,
Gmail quotas, bcrypt latency and trigger delivery remain manual runtime checks.
The release report records exact current results and remaining development-only
dependency advisories. Vendored bcrypt retains its upstream license/integrity check.
