# FitZone development completion report — 15 October 2026

## 1. Development completion

Phases 01–05 were implemented in order, with authentication and membership
consolidated before the notification/WhatsApp/frontend completion pass. React,
TypeScript, Tailwind, Apps Script, the nine-column Sheet, one gym per installation,
and the one-time-sale model are preserved. No external database or paid messaging
service was added. This is development completion, not Google runtime acceptance.

- CRUD, legacy IDs, persistent non-reused unpadded IDs, locked writes, four plans,
  strict/calendar-safe Kolkata dates and paid-time-safe explicit renewal were
  verified. Backend validation now also rejects invalid measurements and
  formula-like names. Staging counter floor: **at least 3; never lower/reset**.
- Direct Sheet edits are visible on Refresh. Contact edits preserve expiry and I.
  Current owner forms send a row fingerprint and reject stale edits/renewals/deletes
  before writing; human edits during the actual write remain outside ScriptLock.
- Four dashboard statistics/filters, inclusive 0–7-day expiry window, ascending
  expiry ordering and ID/name/formatted-phone search are implemented.
- Notifications use ScriptLock, a private per-member/term journal, post-submission
  completion, bounded failed-submission retries and explicit ambiguous-attempt
  reconciliation. No main Sheet columns were added. A synthetic-only dry run
  neither opens a Sheet nor accesses Properties/Gmail.
- Owner-only WhatsApp links use actual member/gym/expiry data and validated Indian
  mobiles; invalid numbers show a correction message. Send remains manual.
- Mobile header/navigation, member cards, named/tappable actions, labeled forms,
  date/number inputs, modal focus management, delete confirmation, loading/empty/
  error/success states, Refresh timestamp and logout were completed.
- Public lookup now returns a pseudonym and six allowlisted membership fields.
  Owner tokens stay in memory; legacy browser credentials are erased and ignored.
- Branding and the public Apps Script URL are configured at build time. The Vite
  root base is '/', and the customer setup page was removed. Dependencies received
  compatible security fixes; Chromium checks are included in main/PR CI.

### Exact changed files

Relative to the starting membership head db7e400 (including the phase-one commit
and final completion pass). The four original untracked files are excluded and
remain byte-for-byte unchanged. Auth.gs, Bcrypt.gs and published docs assets are
unchanged from that starting implementation.

- [.env.example](../.env.example)
- [.github/workflows/authentication-checks.yml](../.github/workflows/authentication-checks.yml)
- [.gitignore](../.gitignore)
- [PROJECT_EXPLANATION.md](../PROJECT_EXPLANATION.md)
- [README.md](../README.md)
- [backend/Code.gs](../backend/Code.gs)
- [backend/OWNER_AUTH_SETUP.md](../backend/OWNER_AUTH_SETUP.md)
- [docs/AUTH_STAGING_VALIDATION.md](../docs/AUTH_STAGING_VALIDATION.md)
- [docs/FINAL_ACCEPTANCE.md](../docs/FINAL_ACCEPTANCE.md)
- [docs/MEMBERSHIP_CORRECTNESS.md](../docs/MEMBERSHIP_CORRECTNESS.md)
- [docs/NOTIFICATIONS.md](../docs/NOTIFICATIONS.md)
- [docs/RELEASE_REPORT.md](../docs/RELEASE_REPORT.md)
- [docs/SERVER_SESSION_VERIFICATION.md](../docs/SERVER_SESSION_VERIFICATION.md)
- [index.html](../index.html)
- [package-lock.json](../package-lock.json)
- [package.json](../package.json)
- [src/App.tsx](../src/App.tsx)
- [src/api/gymApi.ts](../src/api/gymApi.ts)
- [src/components/MemberDialog.tsx](../src/components/MemberDialog.tsx)
- [src/components/WhatsAppReminder.tsx](../src/components/WhatsAppReminder.tsx)
- [src/config/gymConfig.ts](../src/config/gymConfig.ts)
- [src/index.css](../src/index.css)
- [src/pages/Adminpanel.tsx](../src/pages/Adminpanel.tsx)
- [src/pages/MemberLookup.tsx](../src/pages/MemberLookup.tsx)
- `src/pages/Setup.tsx` — removed
- [src/types/member.ts](../src/types/member.ts)
- [src/utils/membership.ts](../src/utils/membership.ts)
- [src/utils/whatsapp.ts](../src/utils/whatsapp.ts)
- [src/vite-env.d.ts](../src/vite-env.d.ts)
- [tests/api-auth.test.mjs](../tests/api-auth.test.mjs)
- [tests/backend-auth.test.mjs](../tests/backend-auth.test.mjs)
- [tests/browser/app.test.mjs](../tests/browser/app.test.mjs)
- [tests/frontend-config.test.mjs](../tests/frontend-config.test.mjs)
- [tests/helpers/apps-script.mjs](../tests/helpers/apps-script.mjs)
- [tests/login-form.test.mjs](../tests/login-form.test.mjs)
- [tests/member-validation.test.mjs](../tests/member-validation.test.mjs)
- [tests/membership-ui.test.mjs](../tests/membership-ui.test.mjs)
- [tests/membership.test.mjs](../tests/membership.test.mjs)
- [tests/notifications.test.mjs](../tests/notifications.test.mjs)
- [tests/sheet-selection.test.mjs](../tests/sheet-selection.test.mjs)
- [tests/whatsapp.test.mjs](../tests/whatsapp.test.mjs)
- [vite.config.ts](../vite.config.ts)

## 2. GitHub consolidation and backups

- PR [#1](https://github.com/YellankiKaushik/Gym-Membership/pull/1) merged at
  **90a5c3858766f81c525df585a75b48bd7ed785de**.
- PR #2 was confirmed to depend on PR #1, retargeted from fix/owner-authentication
  to main, reconciled without conflicts, checked locally and by GitHub CI, then
  [merged](https://github.com/YellankiKaushik/Gym-Membership/pull/2) at
  **a1590ba8f7a6895a719150610ec0ccc7c32d9d9d**. Verified PR #2 head at merge:
  a498365019d07b5af0f1ecde3646412876289741.
- The owner explicitly waived the historical real-Google-staging merge gate for
  **development integration after automated checks**, with deployments unchanged.
  No Google runtime results were fabricated. GitHub connector write operations
  returned 403; the existing authenticated Git login completed the merges.
- Ongoing work uses main, with no new integration/feature branch. The final
  completion SHA and final GitHub CI result are recorded in the accompanying
  completion message; use 'git rev-parse origin/main' to verify the current head.
- Recoverable tag: **backup/pre-consolidation-20261015** at db7e400. The local
  ignored .release-backups/pre-consolidation.bundle was verified and contains full
  history; .release-backups/local-files holds copies of all original untracked
  files. No force-push or unrelated overwrite was performed.
- Merged feature branches are removed after final publication. The existing
  gh-pages deployment branch is retained to avoid changing production hosting.

## 3. Automated results

| Verification | Result |
| --- | --- |
| Authentication PR baseline: npm test | 73 passed, 0 failed |
| Membership PR baseline: npm test | 105 passed, 0 failed |
| Reconciled PR #2: npm test | 107 passed, 0 failed |
| Both baseline/reconciled typecheck, lint, build | Passed |
| Final npm ci | Passed; 292 packages installed, 293 audited |
| Final npm test | **135 passed, 0 failed, 0 skipped** |
| Final npm run typecheck | Passed |
| Final npm run lint | Passed |
| Final npm run build | Passed, Vite 7.3.7; output dist/ |
| Final npm run test:browser | **9 passed, 0 failed, 0 skipped** |
| npm audit --omit=dev --json | **0 runtime dependency vulnerabilities** |
| Full dependency audit after compatible fixes | **9 development-only advisories: 7 high, 2 moderate** |
| git diff --check | Passed |
| Original four untracked files / auth vendor / published assets | Byte comparisons unchanged |

Actual verification commands: npm ci; npm test; npm run typecheck; npm run lint;
npm run build; npm run test:browser; npm audit --json;
npm audit --omit=dev --json; git diff --check; git bundle verify
.release-backups/pre-consolidation.bundle. Targeted suites were also run while
implementing notifications, WhatsApp and configuration. Compatible dependency
repairs used npm audit fix --ignore-scripts; no forced major upgrade was used.
Local Chromium binaries were already installed; CI installs Chromium explicitly.

Browser checks cover **320, 375, 390, 768, 1024 and 1440px** with no horizontal
overflow, 44px buttons, all dialogs, focus wrapping/Escape, four plan options,
CRUD/confirmation, stale edits, Sheets Refresh, prepared WhatsApp links, privacy,
unauthorized API calls, logout replay and server expiry. Screenshots are under
ignored test-results/browser/. These tests use actual UI/API/backend source and
synthetic in-memory Google service mocks, with external navigation blocked. They
do not prove real Apps Script redirects, locking, persistence, OAuth or delivery.
The original authentication/membership scenarios remain covered; assertions were
updated for intentionally stronger public privacy, memory sessions and contact
notification preservation.

## 4. Apps Script test-deployment update

Replace **backend/Code.gs** in the existing disposable test project. Retain matching
**backend/Auth.gs** and **backend/Bcrypt.gs**; their bytes were not changed by this
completion pass. If the project still has the old password-only backend, install
all three main files and remove duplicate old handlers. Optional
staging/RuntimeChecks.gs is an editor diagnostic, not a replacement backend.
Do not use docs/BACKEND_SCRIPT_MODIFIED.gs or gym api apps script.txt as the source
of this release. No Google file/deployment/property was changed by this work.

Use V8 and **Asia/Kolkata**. Retain OWNER_ID, OWNER_PASSWORD_HASH, SPREADSHEET_ID,
MEMBER_SHEET_NAME, and **MEMBER_ID_HIGH_WATER_MARK >= 3**, or a higher trusted
historical maximum. A:I must remain Member ID, Name, Phone, Age, Weight,
Membership Plan, Start Date, End Date, Notified. Numeric phone digits already lost
in Sheets require restoration from a trusted source, not invented padding.

New/updated notification configuration:

| Property | Action |
| --- | --- |
| EXPIRY_EMAIL_ENABLED | Absent/false during this acceptance pass; exact true enables actual scheduled delivery later |
| ADMIN_EMAIL | Valid private owner recipient; only needed for separately authorized real email submission |
| GYM_NAME / GYM_LOCATION | Optional private email branding; match frontend gym branding |
| EXPIRY_NOTICE_<ID> | Automatically managed latest-term attempt journal; never manually clear to force retries |

No trigger is required for CRUD, dashboard or WhatsApp. No trigger was created.
After separate real-send authorization/testing, an owner may manually create one
daily time-based trigger for checkMembershipExpiries, not for a preview function.
Keep production schedules unchanged. [Notification policy](NOTIFICATIONS.md)
documents failed attempts, journal storage, reconciliation and exactly-once limits.

## 5. Frontend and local startup

Run npm ci, copy .env.example to .env.local, set only the disposable public
VITE_APPS_SCRIPT_URL and public branding fields, then npm run dev. Open the root
URL printed by Vite (normally http://localhost:5173/). Owner ID, password, bcrypt
verifier and session secrets belong only in private backend configuration, never
frontend environment values. Branding defaults are centralized in gymConfig.ts;
optional environment fields cover name/tagline/description, trainer, address/map,
logo, gallery and contacts. Existing public endpoint preferences are only a legacy
fallback; a built endpoint takes precedence.

The interface opens on Member Lookup. Sessions survive mode navigation in memory,
but page reload requires login. Refresh explicitly fetches current Sheets data;
there is no realtime-sync claim. The legacy generated docs assets and gh-pages
branch remain unchanged and continue to represent the older deployment.

## 6. Manual acceptance

Follow [FINAL_ACCEPTANCE.md](FINAL_ACCEPTANCE.md), in order. It covers disposable
configuration and counter setup; owner login; unauthorized calls; expiration,
logout/replay and rotation; private member lookup; all four plans; add/edit/renew/
delete; ID non-reuse; month/leap/midnight dates; direct Sheet Refresh and stale
forms; expiring-soon counts/filtering; synthetic email preview; manually prepared
WhatsApp links; and mobile/keyboard checks. Do not send messages during this pass.

## 7. Vercel staging readiness

The source is prepared for a later **Vercel staging deployment**, conditional on
configuring the disposable endpoint and completing real Google acceptance. No
Vercel deployment or project configuration action was performed.

| Setting | Exact value |
| --- | --- |
| Framework preset | Vite |
| Root Directory | repository root (.) |
| Node.js | 24.x |
| Install Command | npm ci |
| Build Command | npm run build |
| Output Directory | dist |
| Public environment | VITE_APPS_SCRIPT_URL plus the optional keys in .env.example |
| URL/base | /; no GitHub Pages subpath; navigation is state-based |

Rebuild after environment changes. Follow [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite)
and [Vite public environment rules](https://vite.dev/guide/env-and-mode). Do not
connect/publish production hosting or run the legacy Pages deploy command as part
of this preparation.

## 8. Remaining limitations and blockers

- **Real Google acceptance is not run:** disposable execution identity, full Sheets
  OAuth authorization, correct workbook/tab selection in web-app execution,
  ContentService redirects/CORS, actual bcrypt latency, real lock contention,
  quotas/persistence and session expiry/revocation must be verified manually.
- **No authorization for production/Vercel deployments, real sends or production
  triggers.** None were performed. Enabling actual Gmail delivery is a separate
  explicitly authorized step. WhatsApp Send always remains the owner's action.
- **Exactly-once email is not promised:** Gmail and Properties/Sheets are not one
  transaction. Pending/ambiguous submissions require checking Sent mail and
  explicit resolution; even failed-submission retries have residual duplicate risk.
- **Public ID enumeration remains:** the pseudonym/allowlist removes identifying
  contact fields, but membership existence, plan, expiry and status remain
  discoverable. ID-only lookup is not authentication or strong privacy.
- **Sheets coordination:** version checks protect against edits already present
  before UI writes; direct human edits during a write/another writer project are
  outside ScriptLock. Legacy clients omitting versions do not get stale detection.
  Only the current term is stored; future-start status follows existing expiry
  semantics. Historical deleted IDs and lost phone digits need trusted history.
- **Development tooling audit:** compatible fixes reduced 26 findings to 9; none
  remain in runtime dependencies. Residual issues originate in Tailwind 3/Pages
  glob/selector tooling. [The braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
  currently lists no patched version, and [the selector parser advisory](https://github.com/advisories/GHSA-rj75-hqrm-r3gf)
  affects older transitive parser versions. npm proposes a breaking Tailwind 4
  migration. Do not process untrusted build inputs; review a separate tooling
  migration or upstream fix before a production release. No forced migration
  or false clean-audit claim was made.
