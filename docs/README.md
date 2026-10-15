# Developer handoff and documentation index

Use [the root README](../README.md) for onboarding and
[PROJECT_EXPLANATION.md](../PROJECT_EXPLANATION.md) for the actual implementation.
This is the one maintenance index; older reports remain evidence of their own
release dates, not instructions to roll back the current deployment.

## Current references

| Question | Read |
| --- | --- |
| How do I install an independent gym? | [INSTALLATION.md](../INSTALLATION.md) |
| How do I configure/rotate an owner privately? | [Owner authentication setup](../backend/OWNER_AUTH_SETUP.md) |
| How do IDs, dates, stale writes and renewals work? | [Membership correctness](MEMBERSHIP_CORRECTNESS.md) |
| How do I schedule, disable or reconcile reminders? | [Notifications](NOTIFICATIONS.md) |
| Which manual Google checks remain? | [Disposable acceptance checklist](FINAL_ACCEPTANCE.md) and [server-session checks](SERVER_SESSION_VERIFICATION.md) |
| What bcrypt code/license is shipped? | [Vendor provenance](../backend/vendor/README.md) and [license](../backend/vendor/bcryptjs-LICENSE) |

## Find the code for a change

| Task | Main files | Verification |
| --- | --- | --- |
| Public lookup or privacy display | `src/pages/MemberLookup.tsx`, `src/api/gymApi.ts`; server allowlist in `backend/Code.gs` | `tests/frontend-config.test.mjs`, `tests/api-auth.test.mjs`, browser privacy test |
| Owner login/session behavior | `src/api/gymApi.ts`, `src/pages/Adminpanel.tsx`, `backend/Auth.gs` | API/backend auth and login-form tests; disposable Google session checks |
| Dashboard, search, filters, forms | `src/pages/Adminpanel.tsx`, shared components | Membership UI and browser tests |
| Colors, layout and keyboard dialogs | `src/index.css`, `src/components/ui.tsx`, `MemberDialog.tsx` | Browser suite at 320–1920px, keyboard, landscape and zoom |
| Dates, statuses or plans | `src/utils/membership.ts`, server membership helpers | Membership and validation suites; preserve backend/frontend agreement |
| IDs and stale writes | `backend/Code.gs`, version payloads in API/panel | Membership/validation tests, never reset a real counter |
| Email reminder behavior | Email section of `backend/Code.gs` | Notification tests against source and bundle; synthetic preview |
| WhatsApp prepared links | `src/utils/whatsapp.ts`, `WhatsAppReminder.tsx` | WhatsApp tests and intercepted browser link checks; never auto-send |
| Public branding | `.env.example`, `vite.config.ts`, `src/config/gymConfig.ts` | Frontend configuration tests; rebuild after authorized changes |
| Single-file installer | `scripts/generate-apps-script.mjs`, three maintained `.gs` sources | `generate:backend`, `check:backend`, full source/bundle suite |

Dates shown in `src/utils/presentation.ts` are formatting only. Do not move the
membership calculation into UI components or make cosmetic work change API contracts.

## Folder boundaries and preserved history

| Location | Purpose | Maintenance rule |
| --- | --- | --- |
| `src/`, root Vite/Tailwind configs | Current frontend source | Make focused, tested changes |
| `backend/`, `backend/generated/`, `backend/vendor/` | API, installation artifact and license | Preserve maintained originals and generation/integrity workflow |
| `tests/`, `scripts/`, `.github/workflows/` | Repeatable checks and tools | Keep secrets out; source/bundle parity is mandatory |
| `staging/RuntimeChecks.gs`, `staging/members.tsv` | Optional synthetic diagnostics/rows | Disposable project only; never add to production or HTTP handlers |
| [Authentication staging record](AUTH_STAGING_VALIDATION.md) | Historical review and Google test procedure | Its old merge/deployment gate does not revoke later owner approval |
| [Development release report](RELEASE_REPORT.md) | Historical 15 October completion evidence | Counts/statuses belong to that release, not current deployment |
| [UI redesign review](UI_REDESIGN_REVIEW.md), `ui-review/` | Approved design and synthetic screenshots | Historical review evidence; not production assets |
| `docs/index.html`, `docs/assets/`, `docs/vite.svg` | Legacy generated Pages snapshot | Retained unchanged; do not edit as application source or serve as current Vercel build |
| Remote `gh-pages` | Older published static build | Retain: Pages API returned 404, which does not establish safe retirement |
| Ignored `test-results/`, `.release-backups/` | Local screenshots, logs and release evidence | Do not commit private data or traces |
| Local untracked drafts/logs | Existing personal work | Not supported backend source; leave untouched unless separately authorized |

The superseded project narrative remains in
[Git history](https://github.com/YellankiKaushik/Gym-Membership/blob/795153b8614c3dcd867db2cac2b28b63d6afde68/PROJECT_EXPLANATION.md).
No source files, staging helpers, reports, licenses, screenshots or legacy builds
were moved for this maintenance pass; the index supplies the missing organization.

## Safe change and release routine

1. Fetch current main, create one focused branch and read the relevant reference.
   Use disposable Google data for development; CI uses only synthetic services.
2. Keep existing `.env.local` and production environment values private and intact.
   The compiled API URL and branding are public; owner verifiers and Sheet settings
   belong only in Script Properties. Never install untracked backend drafts.
3. If backend source changes, regenerate the installer and include it. New Google
   installations choose the single generated file OR the original three sources.
4. Run the commands below. Inspect browser screenshots for UI changes. Do not
   weaken tests or force dependency upgrades to obtain a clean status.
5. Open a focused PR, pass CI and merge only within release authorization. Main
   triggers the existing Vercel project. Confirm Ready, correct SHA/domain and a
   public smoke test. A frontend push does not deploy Google Apps Script changes.
6. Delete a temporary remote branch only after confirming its PR was merged, its
   reviewed content is retained and it is neither protected nor actively needed.
   Never delete main or unknown-purpose branches; never force-push.

```powershell
npm ci
npm run check:docs
npm run check:backend
npm test
npx playwright install chromium
npm run test:browser
npm run typecheck
npm run lint
npm run build
npm audit
npm audit --omit=dev
```

CI runs the same core quality gates on PRs and main; it has read-only GitHub
contents permissions and no Google credentials or deployment step. Vercel's Git
integration separately builds the frontend. Current `main` was reported unprotected
by GitHub at this audit; status checks and PR discipline are not a configured
branch-protection rule. This cleanup does not silently impose new administrator
policies. Keep branch protection/required reviews under the owner's release policy.

`npm run deploy` remains available for legacy Pages compatibility and must not be
used for a Vercel production release. The active PostCSS config loads Tailwind 3
and Autoprefixer; the unused Tailwind 4 adapter, router and animation packages
were removed. No runtime component or build configuration was rewritten.

## Maintenance findings (16 October 2026)

### Dependencies

`npm audit` reports **9 affected package entries: 7 high and 2 moderate**, arising
from two root advisories and their dependent packages. These are development/tooling
dependencies; `npm audit --omit=dev` reports **0** at this audit. Audit output is
point-in-time evidence, not a future security guarantee.

| Root issue | Affected dependency path | Decision |
| --- | --- | --- |
| [braces stack exhaustion](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | Tailwind 3/chokidar/micromatch and gh-pages/globby/fast-glob | No patched braces release; compatible audit dry run changes nothing. Retain active toolchain and Pages compatibility; isolate builds from untrusted patterns. |
| [PostCSS selector parsing complexity](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) | Tailwind 3/postcss-nested/selector-parser | Fixed parser is 7.1.6, outside the current parser-6 dependency range. No forced override, major Tailwind migration or unsupported downgrade. Review an upstream compatible path separately. |

Unused `framer-motion`, `react-router-dom` and `@tailwindcss/postcss` dependencies
were removed after confirming no imports/configuration usage. This removes 21
installed packages; it does not claim to fix the nine active-toolchain findings.
Do not use `npm audit fix --force`. Reassess advisories and test a compatible
solution when maintainers publish it. Build tools should process trusted source
and repository configuration, not user-provided glob patterns or stylesheets.

### Security and data

The tracked text-tree scan found no private-key blocks, recognized provider-token
patterns, actual Apps Script/Sheet URLs or literal bcrypt verifiers. Synthetic
test passwords/IDs are deliberate fixtures, not production credentials. `.env.local`
and local evidence are ignored. Pattern scanning is limited; it is not a proof
that all historical commits, private Google properties or external settings are safe.

Legacy generated JavaScript is retained as historical evidence and is not included
in the Vercel build. Do not use it as the current authentication implementation.
Current sessions remain memory-only and backend-enforced; no endpoint, Sheet,
owner credential, Script Property or trigger was changed in this cleanup.

### Verified, owner-reported, deferred

- **Release verified:** the approved UI was merged and published, the production
  domain served it, and a read-only unknown-ID lookup reached the existing backend.
- **Automated:** the current source/bundle and synthetic browser suite verifies
  auth, CRUD, date/ID rules, notification safety and responsive/keyboard behavior.
- **Owner-reported:** manual application testing and a successful real Gmail test.
  This maintenance pass does not independently repeat or certify those actions.
- **Manual/commercial acceptance:** real Google OAuth/scopes, absolute server
  expiry/rotation, concurrency/quotas, backup/restore, data retention/privacy,
  scheduler monitoring, physical keyboards and Safari/Firefox need installation-specific
  evidence. Live mutations and actual sends are intentionally excluded here.
- **Deferred:** live WhatsApp integration acceptance. Prepared links are implemented
  and tested synthetically; automatic sending is not implemented.
- **Future ideas only:** payments, attendance, AI retention, new databases, new login
  providers and subscription billing are outside current scope.

Numeric public IDs remain enumerable and expose limited membership facts; no
identity verification/public rate limit is implemented. Exactly-once email delivery
is not guaranteed. Human Sheet edits are outside ScriptLock, current-term-only
storage is not a ledger, and no availability/latency/commercial compliance guarantee
is made. These are explicit product boundaries, not items to silently redesign in
routine repository cleanup.
