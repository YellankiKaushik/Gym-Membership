# Security release and operating checklist

Prepared 19 October 2026. **NOT approved for production release.** No account setting, production data, deployment, trigger or Script Property was changed by Phase 2 implementation. Use [implementation status](SECURITY_IMPLEMENTATION_REPORT.md) and [test evidence](SECURITY_TEST_RESULTS.md) before approving any rollout.

## Phase 4 prototype scope — 20 October 2026

The owner confirms all existing records are fictional, the current Sheet/project
are for prototype testing, and Google/GitHub/Vercel account MFA is enabled.
[The prototype rollout](SECURITY_PROTOTYPE_ROLLOUT.md) governs this limited
exercise using the **existing** Apps Script project and unchanged public `/exec`
URL. Its instructions supersede the new-project/isolation prerequisite below
for editor/head testing of this prototype only. Account MFA is owner-confirmed,
not a claim that the application's managed MFA is active.

| Release gate | Phase 4 decision |
| --- | --- |
| Fake-data prototype local verification and owner-run head testing | **GO**, with mail disabled, migrations off, controlled access, manual rollback capture and the documented limits |
| Public prototype release | **NO-GO pending** owner-run head results, actual security CI, recorded rollback targets and approval of the exact backend/frontend release; no deployment performed |
| Vercel Preview isolation | **UNVERIFIED / NOT APPROVED**; keep its fail-closed guard. Do not attest the shared backend is isolated or weaken the guard to obtain a preview |
| Real-customer readiness | **NO-GO**; all customer/independent recovery/privacy/identity/release controls below still apply |

A later authorized security-branch push may run GitHub checks while a Vercel
preview deliberately fails closed. That failure does not prove isolation or
authorize production. No direct main push, automatic public deployment, fake
backup attestation or migration activation is permitted by this exception.

## Customer and isolated-Preview stop gates

- [ ] A distinct synthetic Google project, Sheet, owner identity and credentials have been verified for previews.
- [ ] The shared preview/production environment binding has been corrected by an authorized administrator. The read-only Phase 2 check still found it shared.
- [ ] An independent encrypted backup exists and a separate-project restore has actually succeeded. Local synthetic codec tests do not satisfy this condition.
- [ ] Main branch rulesets and required checks have been configured and tested by an administrator.
- [ ] Provider enrollment, phishing-resistant assurance claims, recovery and the chosen provider's sign-in UI have been validated before selecting managed authentication.
- [ ] Member-access migration and distribution/recovery procedures have been approved before changing lookup mode.
- [ ] Exact frontend and Apps Script versions pass disposable Google staging and receive separate deployment approval.

For customer/isolated-Preview rollout, do **not push this branch** until preview isolation is verified. A GitHub push may create a Vercel preview automatically. Local fail-closed build guards reduce risk but are not proof that account configuration or an existing preview is isolated. The Phase 4 fake-data CI-only branch-push procedure above is a separate, later-authorized exception; it does not approve a Preview deployment.

## 1. Preview isolation without exposing values

An authorized administrator must do the following privately; none of these settings was changed automatically:

1. Open the intended Vercel project's Settings → Environment Variables. Confirm the project/team privately.
2. Remove Preview from the production `VITE_APPS_SCRIPT_URL` entry's targets, retaining its approved Production target. Do not replace its value with staging or alter the production Google deployment.
3. Create a separate disposable Google Sheet/Apps Script project and unique synthetic owner credentials. Disable expiry email. Inspect sharing, execution identity, private Sheet/tab selection and installed code version. No real members or production credentials belong there.
4. Configure these **Preview-only build variables**, without posting their values in issues, reports or chat:

| Variable | Required meaning |
| --- | --- |
| `FITZONE_PREVIEW_APPS_SCRIPT_URL` | Complete disposable staging `/exec` endpoint |
| `FITZONE_PREVIEW_SYNTHETIC` | `1`, only after independently checking synthetic data/credentials |
| `FITZONE_PRODUCTION_ENDPOINT_SHA256` | SHA-256 of the exact approved production endpoint, UTF-8 with no newline |

5. In a private interactive local terminal, run `node scripts/deployment-fingerprint.mjs`. Paste the endpoint into its hidden prompt. It prints only the fingerprint; do not put the endpoint in command arguments or commit it. This helper does not read/write environment files.
6. Verify environment scopes read-only, including branch overrides and custom environments. The preview guard ignores inherited `VITE_APPS_SCRIPT_URL`, requires a valid separate endpoint, and rejects one matching the production fingerprint. A truthful fingerprint/attestation still requires administrative review; it is not a cloud identity oracle.
7. Before permitting a push, run an isolated preview-mode build with those private build variables in a controlled environment. Confirm the compiled destination by a redacted comparison and a synthetic-only end-to-end check. Keep preview access protected. Never enter production credentials into untrusted changed code.
8. Build/deploy a preview only after this gate is signed off. Validate effective headers and destination on that preview. Production remains a separate approval.

Local development keeps its existing configuration. All public branding and endpoint routing information in frontend JavaScript is public; `sensitive` Vercel metadata does not make a compiled `VITE_*` value secret. The build exposes an explicit allowlist and disables Vite's automatic public environment prefix. Do not add authentication secrets to that allowlist.

## 2. GitHub release and account controls

The repository workflow does not create or enforce a ruleset. An authorized administrator must:

1. Require strong account authentication for Google, GitHub and Vercel; review recovery contacts, collaborators, installed apps and release credentials. Preserve legitimate owner recovery before removing access.
2. In GitHub Settings → Rules → Rulesets, create an active main-branch ruleset requiring pull requests, current successful checks, appropriate review, and restrictions on force pushes/deletion. Restrict bypass to an audited recovery role.
3. Select the **actual emitted check names after a successful workflow run**: Application checks / verify; Security checks / runtime-dependencies; Security checks / secrets; Security checks / codeql. Do not invent check contexts before GitHub emits them. Require CodeQL result/extraction gates as well as analysis completion.
4. A sole maintainer cannot approve their own PR. Choose a real independent reviewer or a documented controlled release policy; avoid an unusable approval requirement that leads to permanent bypass.
5. Configure secret scanning/push protection and dependency alerts where supported. Enable the advanced CodeQL workflow and avoid competing default/advanced setups. Review Dependabot PRs rather than enabling blind auto-merge.
6. Verify a disposable PR with a failing check cannot merge, direct/force pushes are denied to intended actors, and the controlled recovery process works. Confirm Vercel Deployment Checks or the chosen release policy actually gates production publication.

Actions remain pinned to full SHAs, checkout does not persist credentials, npm uses `npm ci`, and only the CodeQL job receives `security-events: write`. No workflow publishes/deploys this implementation. Dependabot schedules npm and GitHub Actions reviews weekly. Gitleaks uses a checksum-pinned official release without requiring a paid action license.

CodeQL uses exact JavaScript mirrors of maintained `Auth.gs`/`Code.gs`; do not assume native `.gs` support. The post-analysis source-archive gate must prove both mirrors were actually extracted. The standard queries do not automatically model every Apps Script-specific authorization/storage behavior. Vendored bcrypt is integrity-tested separately; no backend CodeQL pass is claimed before CI runs and its coverage gate succeeds.

## 3. Browser policy verification

`vercel.json` contains enforcing frame denial, nosniff, no-referrer, restricted Permissions-Policy, and an enforcing minimal CSP (`frame-ancestors`, `object-src`, `base-uri`). Broader content restrictions begin in Report-Only. There is no blanket wildcard, `unsafe-inline` or `unsafe-eval`.

- Bundled scripts, styles, images and fonts use self. Google fetch needs `https://script.google.com` and its ContentService response origin `https://script.googleusercontent.com`.
- Map and WhatsApp links open a separate page; they are not embedded frames or current-page fetches. No map iframe permission is needed for the existing implementation.
- Custom branding images require an explicit reviewed HTTPS origin in the Report-Only policy before broader enforcement. Existing custom HTTPS branding is not blocked by the minimal enforcing policy; expected Report-Only violations require review, not permissive shortcuts.
- A chosen identity provider/SDK will require its exact approved script/connect/frame/navigation origins. Do not weaken the policy before selecting and testing that provider.
- Review browser-console violations first; no unapproved remote CSP collector is configured. Reports can contain URLs, so any later collector needs privacy/access review.

After an approved Vercel preview deployment, inspect real response headers, verify an unrelated page cannot frame it, and run lookup, owner login/logout, CRUD, dialogs, branding/maps and manual WhatsApp preparation. Preserve provider-managed HSTS. Consider COOP only after testing provider popups; it is not enabled here. Local configuration tests and Vite browser tests do not verify actual Vercel response headers.

## 4. Independent backup and synthetic restore runbook

**Production backup scheduling/storage is not implemented or verified by the local rehearsal module.** Do not set activation properties merely because unit tests pass.

1. Choose an already approved independently administered backup identity and versioned storage. The running app and ordinary gym owner credentials must not be able to delete retained snapshots. Review shared Google-account blast radius. Do not introduce paid storage/scheduling without approval.
2. Configure an approved daily snapshot job. Capture A:I values, data types, number formats, schema/version/timezone and private persistent member-ID high-water mark. Capture required expiry journal/Notified state and history metadata. Document how human Sheet edits and scheduled sends are coordinated during capture; a partial snapshot is not a consistent backup.
3. Exclude all active `OWNER_SESSION_*`, `OWNER_STEPUP_*`, identity challenges, lookup capabilities and temporary operation authority. Do not revive authentication credentials after recovery. Back up private configuration/verifiers/identity keys only through a separate encrypted secret-recovery process with restricted access and deliberate rotation.
4. Encrypt member snapshots with an authenticated encryption design and independently held keys; keep keys separate from snapshot storage and the application principal. Test key recovery privately. Google Drive/version history alone is not independent protection against account compromise.
5. Approve retention and privacy deletion requirements. Suggested starting targets: RPO 24 hours, RTO four hours; daily 30 days, weekly 12 weeks, monthly 12 months. These are proposals, not achieved guarantees. Review retention locks before activation because some are irreversible.
6. Restore a synthetic snapshot into a **new disposable project**, never over production. Check exact nine columns, canonical and raw legacy IDs, phone display/formatting, dates/timezone, four plans, notification state and historical records. The high-water mark must remain at least the highest ever issued ID, including deleted IDs, not just the current maximum row.
7. Keep expiry email off. Inspect Sent mail and journal state under owner control before reconciling ambiguous attempts or re-enabling notices. No restored active sessions or old member lookup codes should become usable; issue fresh access after identity verification.
8. Record measured snapshot completion/age, restore duration, data validation, independent identity/access evidence, reviewer and a private restore reference. Alert routing and any real test sends require separate approval.

Local rehearsal: `scripts/synthetic-backup.mjs` provides authenticated AES-256-GCM snapshot encryption/decryption and a restore plan. It deliberately accepts only clearly synthetic names/phone fixtures and a synthetic installation identifier, refuses cross-installation/tampered snapshots, preserves counters/journals, excludes session/config secrets and produces no Google writes. Run `node --test tests/security-backup.test.mjs`. It is **not a production backup job** or proof of independent storage.

## 5. Gated history, reversible archival and recovery

Leave `MEMBER_HISTORY_ENABLED` unset until the independent backup/restore gate and disposable Google staging are approved. The existing member Sheet remains A:I. History uses a **different** privately configured spreadsheet, not extra live member columns.

Create the archive tab with these exact ten header cells in row 1:

```text
Operation ID | Member ID | Action | State | Intent | Before | After | At | Notification Journal | Result
```

The `Notification Journal` cell contains private JSON metadata: the prior notice record, original A:I number formats and displayed phone value. Before/after images contain member data; restrict this archive as carefully as the member Sheet. An app-writable archive is not an independent immutable backup.

Only after actual independent restore verification, privately configure in the disposable project first:

| Script Property | Meaning |
| --- | --- |
| `MEMBER_HISTORY_SPREADSHEET_ID` | Private separate archive spreadsheet identifier |
| `MEMBER_HISTORY_SHEET_NAME` | Exact archive tab name |
| `BACKUP_RESTORE_VERIFIED_AT` | Actual completed verification time, ISO UTC; must not be future-dated or older than 30 days |
| `BACKUP_RESTORE_REFERENCE` | Private verification record reference, 8–128 letters/digits/underscores/hyphens; no URL/secret |
| `OWNER_STEP_UP_REQUIRED` | `true`, after fresh-confirmation staging validation |
| `MEMBER_HISTORY_ENABLED` | `true`, **last**, after the prerequisites are genuinely satisfied |

The properties are administrative attestations, not cryptographic proof a backup exists. Production activation remains a separate approval. History reads stop at 50,000 archive rows and member reads default to a 10,000-row ceiling (including header); benchmark real staging workload before selecting limits. Do not delete history to work around capacity failures without a reviewed retention/rotation plan.

With history enabled:

- Mutation operation IDs are mandatory; updates/renewals/deletes also require current versions. Legacy clients without those fields fail safely and need upgrading.
- A `PENDING` before/after journal is flushed before the member write. Member writes are flushed before journal commit. A completed operation can be replayed with the same ID/intent without another mutation; different details with that ID are rejected.
- The frontend retains an operation ID in memory after an ambiguous response, reusing it for the same explicit retry. It does not retry mutations automatically. Logout/refresh loses that memory; inspect records/history before retrying after reload. Legacy mode does not provide server deduplication.
- Any unresolved pending history blocks further history-mode mutations and normal notification sending. A stale backup attestation or unavailable archive also requires review before continuing in that mode. Existing legacy notification behavior is unchanged while history remains disabled.
- Delete writes the recoverable before image then removes the live row, retaining the high-water mark and revoking member lookup access. Renewal/update preserve the prior term/record and original formatting.
- Restoration is a privileged `restoreMember` POST requiring a current owner session, one-use fresh confirmation, current-version/after-image checks where applicable, email disabled and explicit notice reconciliation. It preserves the original ID/phone formats and dates, revokes lookup access and journals the restoration. No public restore route exists.

### Interrupted-operation handling

Do not repeatedly click Save/Delete to clear `HISTORY_REVIEW_REQUIRED`.

1. Freeze affected work and keep notices disabled during recovery. Preserve independent snapshots and inspect the private operation journal and actual member data.
2. Match the complete current row to the recorded before or after image, including contact values, term, ID and Notified. Inspect property/format state and Sent-mail/journal consistency too.
3. In the Apps Script editor, an authorized operator may call `reconcileMemberHistory(operationId, 'applied')` or `'not-applied'` only after review. This function is not exposed over HTTP. It refuses ambiguous value mismatches; not-applied reconciliation restores original formats for an existing row. If neither image matches, stop for a deliberate reviewed restore, rather than guessing.
4. Applied commits the recorded result so the same intent can return its prior outcome. Not-applied marks cancellation; a new approved attempt requires a new operation ID. Verify counters and journal state separately, since Sheets/Properties do not provide a cross-service transaction.
5. Revalidate actual records, history and notifications before resuming. Never relabel partial changes as committed solely to unblock the UI.

## 6. Phishing-resistant managed owner identity

**Integration interfaces are implemented; provider enrollment, SDK/UI wiring, real Google verification and recovery are blocked by external configuration. Do not select managed mode in production yet.** The existing Owner Login form remains password-based. There is no fake frontend MFA toggle or public recovery bypass.

The intended flow is: backend challenge → approved provider SDK using nonce/PKCE and fresh authentication → same-origin `/api/owner-identity` → signature/claims/assurance verification → short-lived HMAC-bound proof → Apps Script challenge consumption → existing expiring server session. Direct password login is rejected when managed mode is selected. A direct Apps Script call cannot mint the bridge proof without the private key. This is an identity verifier, not a general API proxy.

An authorized operator must first choose a provider with a suitable free/existing approved plan and documented phishing-resistant assurance semantics. Do not introduce paid infrastructure without approval. Enroll the intended owner and test provider recovery/revocation with an independent trusted administrator; no hardcoded recovery code or password-only fallback may bypass the required factor.

Configure these **server-only** values privately on the intended Vercel environment and matching private values in the disposable Apps Script project:

| Configuration | Required meaning |
| --- | --- |
| `OWNER_IDENTITY_ISSUER` | Exact HTTPS OIDC issuer |
| `OWNER_IDENTITY_JWKS_URL` | Pinned HTTPS JWKS URL on the configured issuer origin; not a token-supplied URL |
| `OWNER_IDENTITY_AUDIENCE` | Intended client/audience |
| `OWNER_IDENTITY_SUBJECT` | Exact approved immutable owner subject; also a Script Property |
| `OWNER_IDENTITY_REQUIRED_ACR` | Provider-documented phishing-resistant assurance context; not an arbitrary label |
| `OWNER_IDENTITY_REQUIRED_AMR` | Comma-separated required verified method claims; e.g. a provider-documented hardware/passkey method, not merely a password claim |
| `GYM_INSTALLATION_ID` | Unique per-gym opaque binding, 16–64 allowed identifier characters; also a Script Property; not a Sheet ID |
| `OWNER_IDENTITY_SHARED_KEY` | Unique random 256-bit key encoded as 64 lowercase hex characters; server and Script Properties only |
| `OWNER_IDENTITY_ENABLED` | `true` on the verifier server only after setup validation |
| `OWNER_AUTH_MODE` | Apps Script `managed` only after provider/UI/recovery staging acceptance; unset/`legacy` keeps the working password login |

Never put these private server settings under `VITE_*` or into `__GYM_PUBLIC_CONFIG__`. Keep existing private owner verifier for controlled administrative recovery, but managed mode does not accept it as a web-login fallback. Changes to mode, subject, installation binding or shared key invalidate old credential-version sessions; no public credential reset is implemented.

Before any private-configuration rollback, invalidate all server sessions, step-up
proofs and outstanding identity challenges through the approved maintenance
procedure. Do not restore those records from backups or reuse earlier authority
merely by reverting configuration values. Verify provider/session revocation and
owner recovery before reopening access.

Preview identity additionally requires `FITZONE_PREVIEW_SYNTHETIC=1` and `FITZONE_PRODUCTION_IDENTITY_KEY_SHA256`; it rejects a preview key matching the production fingerprint. Compute that fingerprint privately using `node scripts/deployment-fingerprint.mjs --identity-key`. Scope staging provider subject, client, key and installation separately. Do not send real provider tokens to a preview.

Wire the chosen reviewed SDK to `loginOwnerWithIdentity(obtainIdToken)` and `reauthenticateOwnerWithIdentity(obtainIdToken, purpose, memberId, expectedVersion, archiveOperationId?)`. The callback receives the backend nonce and `maxAge:0`; it must use the provider's supported PKCE/nonce flow and force the required fresh assurance. Implement the provider sign-in button and managed confirmation UI only after that choice. The current delete-password prompt covers legacy fresh confirmation, not managed-provider sign-in.

The verifier restricts algorithms to RS256/ES256, requires issuer/audience/subject, expiry/issued-at/auth-time, nonce, exact ACR and required AMR, checks authorized party for multiple audiences and rejects stale/pre-challenge authentication. Apps Script separately verifies installation/owner hash, HMAC, expiry, challenge, session/action binding and one-time consumption. Challenge state is capped at eight for two minutes; step-up proofs at twenty for one minute. These bounds can still be monopolized by hostile traffic; no complete targeted DoS fix is claimed.

Validate actual provider claim meanings, key rotation, recovery, logout/expiry/revocation, direct endpoint rejection, nonce/proof replay and a second installation before approving activation. External provider admin compromise or a compromised trusted verifier remains a security boundary.

## 7. Member lookup capability migration

Leave current lookup mode unchanged until member migration is approved. The locally implemented secure mode has **no numeric fallback**:

1. Test disposable project Script Property `MEMBER_LOOKUP_MODE=capability` and frontend public build setting `VITE_MEMBER_LOOKUP_MODE=capability` together. A mismatched old numeric client fails closed against secure backend mode.
2. Use the protected owner action `issueMemberLookup` with `memberId` and optional `validDays` (default 30; 1–90 allowed). When step-up is required, obtain a one-use confirmation bound to that purpose/member/version first. The raw 64-hex code is returned once, while only its digest is stored. Rotation revokes the previous code.
3. Distribute privately only after the gym verifies the member's identity through an approved existing process. Do not put codes in public links, query strings, screenshots, repository files, analytics or mass email. This task sends nothing automatically and does not add a bulk-distribution feature.
4. Members paste their code into the access-code form. It travels in a POST body, not a URL/storage. The backend validates it before reading IDs plus the single selected member row and returns only pseudonymous membership facts.
5. `revokeMemberLookup` immediately revokes the stored binding; replacement, expiry and deletion also invalidate access. Recovery means owner-verified reissue, not a numeric-ID bypass. Restoring a member requires a fresh code.
6. Validate arbitrary IDs, guessed/expired/revoked codes, cross-gym codes, manually moved/duplicated IDs and response uniformity. Invalid codes must not trigger member reads.

The owner client exports `issueMemberLookup`, `revokeMemberLookup` and
`restoreMember` with the existing private in-memory session handling; obtain a
purpose/member/version-bound confirmation first. Pass the same version to
`issueMemberLookup(memberId, validDays, stepUpToken, expectedVersion)` or
`revokeMemberLookup(memberId, stepUpToken, expectedVersion)` when it was bound
into the confirmation. Do not extract session tokens
from developer tools or place them in command arguments to operate these routes.
Review the owner-facing distribution/recovery surface before migration; this
branch provides tested interfaces and the member entry form, not a bulk token
management/distribution screen.

Limits: ten valid lookups per code/minute, sixty accepted lookups per installation/minute, 500 active capability records, and a configured member-row ceiling. Expired token state is pruned during issuance. Public invalid traffic still consumes Apps Script/Properties quota, legacy anonymous budgets can be exhausted, and valid code holders can share their bearer code. These are partial abuse controls, not a complete internet DoS solution or member identity authentication.

## 8. Security logging and incident response

The backend emits allowlisted JSON events with category `fitzone_security`, timestamp, action/result, a correlation identifier and optional canonical member ID. Coverage includes login/failures/throttling, owner reads, unauthorized requests, logout, fresh confirmation, managed identity, credential-configuration changes, member creation/update/renewal/deletion/restoration and capability administration.

No raw request, password/verifier, bearer token, provider token, private environment value, Sheet URL, personal contact/name or raw exception is logged. Do not add broad object serialization later. One shared owner still lacks individual staff attribution.

An authorized Google administrator must configure/review available Apps Script/Cloud logging, separate log reader/admin roles, retention, export/immutability requirements and cost. The app-writable history Sheet is not a tamper-proof security log. Console emission alone does not prove independent log durability or prevent a Google editor from changing the code. No remote collector, paid log sink, alert recipient or real alert was enabled here.

After approved setup, create bounded alert rules for unusual invalid-login/throttle rates, unauthorized operations, deletion spikes and backup/restore failures, with reviewed thresholds and routing. Test using synthetic events only before enabling real alerts. Preserve evidence, restrict affected identities, revoke sessions/rotate actually compromised credentials, review disclosure, and restore validated records through the recovery procedure. Check Sent mail before resolving ambiguous notification delivery; do not blindly resend.

## 9. Staging acceptance and separate releases

- [ ] `npm ci`, docs/backend/security checks, source/bundle tests, typecheck, lint, build and browser tests pass on the reviewed commit.
- [ ] Runtime audit passes; remaining development advisories have an owner, compatibility plan and review date. Do not force a major tooling update just to clear a number.
- [ ] Gitleaks passes with redacted output; CodeQL runs remotely, extraction is proven and actionable SARIF results are reviewed/gated. No local CodeQL pass is assumed.
- [ ] Two actual disposable Google installations prove session/proof/capability isolation, permissions, OAuth scopes and installed bundle version.
- [ ] Approved bounded staging work tests measure read cost, quotas, locking and notification contention. No production brute force/load test.
- [ ] Independent synthetic restore succeeds; history/crash recovery is verified with real Google service failures/permissions before activation.
- [ ] Real provider enrollment, supported SDK UI, fresh confirmation, recovery and revocation are accepted before managed mode.
- [ ] Capability distribution/privacy contract is approved before disabling numeric lookup.
- [ ] Actual Vercel preview headers/framing/CSP and effective destination match intended settings.
- [ ] Google account/Sheet/project permissions and historical deployments are inventoried; retire old services only with approval and consumer checks.
- [ ] Release and rollback approvals identify exact frontend/GAS versions and state compatibility.

Frontend publication and manual Apps Script deployment are independent. Install the regenerated single bundle **instead of**, not alongside, the three source files. Preserve private properties and counters. Deploy compatible code first with migration flags disabled, verify staging, then activate only individually approved changes. A Vercel rollback does not restore Sheet data or Script Properties. Never roll authentication back to a known insecure version to resolve an outage. No production release is authorized by this checklist.
