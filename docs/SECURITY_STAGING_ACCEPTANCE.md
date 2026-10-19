# Phase 3 security staging acceptance

Assessment: **19 October 2026**, branch `security/hardening-phase2`.
Reviewed Phase 2 commits: `75c1dc87fe04f8eed33ffc832b103c9f543dd977` and
`17622017cdbcbc2d8fd1225b2b03a7638fb3cfbd`, against main
`89472587fa592ad96aaecd8807366d5f65ddea60`. Results below include the small,
uncommitted Phase 3 fixes in this working tree. They do not certify the original
Phase 2 commits without those fixes.

**Cloud staging acceptance: NO-GO. Production release: NO-GO.** Local synthetic
regression testing passes. Preview isolation is demonstrably incomplete;
independent recovery and actual security CI/Google staging are not verified.
No push, merge, cloud deployment, production request, Google data/property
change, trigger creation, real message or feature activation occurred.

## Review basis and boundaries

Read completely: [audit](SECURITY_AUDIT_REPORT.md),
[remediation plan](SECURITY_REMEDIATION_PLAN.md),
[implementation report](SECURITY_IMPLEMENTATION_REPORT.md),
[prior results](SECURITY_TEST_RESULTS.md), and
[production checklist](SECURITY_PRODUCTION_CHECKLIST.md).
Reviewed the two commits and actual auth, dispatch, identity verifier/bridge,
capability, history/restore, frontend API/UI, installer, hosting and workflow
implementations. This is implementation acceptance, not a repeat baseline audit.

All behavioral tests used synthetic credentials/records and Google service
doubles. Browser tests intercept the backend and block unrelated external
requests. Signed synthetic JWT tests exercise real JOSE verification but not a
real enrolled provider. No supplied historical Google URL was assumed to be a
verified disposable target. Private `.env.local` was neither printed nor edited;
`git check-ignore .env.local` passes. The four pre-existing untracked drafts/logs
were not altered or used as installation sources.

## Verified protections in local code

| Boundary | Implementation and actual evidence | Limit |
| --- | --- | --- |
| Password/session | Bcrypt cost 12–14, UTF-8 truncation rejection, malformed-input rejection before expensive work/lock/budget; digest-only tokens, 30-minute absolute expiry, cap 20, logout and credential-version checks; source/bundle regressions pass | Valid-shaped traffic can still exhaust the shared five-failure/15-minute login budget; stolen active tokens remain bearer authority |
| API authorization | All owner read/write/restore/confirmation/capability-admin routes require a server-validated session; managed completion independently checks authority; GET cannot perform admin actions; unauthorized tests cause no member access | Google editors/publishers remain trusted; direct endpoint traffic still consumes platform resources |
| Managed proof | Pinned issuer/JWKS origin, RS256/ES256, audience/subject/nonce/ACR/AMR/auth-time/expiry/authorized party; HMAC gym/owner/challenge/purpose binding; bounded, one-use GAS challenges and session-bound action proofs; tamper/replay/cross-store tests pass | Inactive; real provider, key rotation, claims semantics, SDK/UI, enrollment and recovery unverified; freshness defect corrected below |
| Capability privacy | Opt-in POST-body random bearer codes, digest storage, expiry/rotation/revocation, minimal DTO, numeric fallback rejected; invalid codes avoid member reads; ID uniqueness and one-row read verified | Legacy remains default; per-code/global budgets and row caps only partially mitigate abuse; no distribution UI/process acceptance |
| Data/history | Nine live columns and four plans preserved; high-water IDs, locks, history-mode mandatory versions, operation deduplication, flushed before/after intent and pending-operation stop gates; restore requires fresh proof, matching state and email off | History is inactive. Sheets/Properties/Gmail are not one transaction; manual edits bypass ScriptLock; real crash recovery not demonstrated |
| Recovery rehearsal | Synthetic AES-256-GCM tamper/wrong-key/wrong-installation tests, counter/journal checks, no restored sessions and email-disabled plan pass | No independent backup job/storage/identity/retention or achieved RPO/RTO evidence; codec does not constitute a full typed/formatted production snapshot |
| Notifications/events | Daily parameterless trigger wrapper, disable switch, pure synthetic preview, pending/sent/failed journal/backoff/locking preserved; pending history stops normal sends; allowlisted event redaction tests pass | No real mail sent; console output is not independently protected logging/alerting |
| Hosting/preview | Enforcing frame denial/nosniff/referrer/permissions/minimal CSP; broader Report-Only policy; explicit public config allowlist; actual local Vite build rejects incomplete preview config and synthetic destination comparison passes | Local configuration only; no current staging response headers verified; fingerprint/attestation depend on truthful administrator input |
| Supply chain/installer | Pinned Actions, scoped permissions, locked install, vendor integrity, deterministic Bcrypt/Auth/Code order, duplicate-global/syntax/freshness tests and scanner gates pass locally | No actual CodeQL run/extraction or enforced release gate; full dependency audit fails |

No working legacy authentication, session protection, email journal or paid-term
regression was identified in the executed suites. This is bounded evidence, not
a claim that all vulnerabilities are absent.

## Demonstrated defects and local fixes

### P3-01 — Managed challenge freshness trusted client timing (Medium, latent)

`verifyOwnerIdentity` receives the challenge through the browser. Its freshness
calculation used that supplied expiry, while GAS checked nonce/purpose/signature
and a five-minute age ceiling without comparing authentication time with its own
stored challenge creation time. A signed synthetic assertion with authentication
60 seconds before challenge creation was accepted after reducing the submitted
challenge expiry by 60 seconds. It still required a valid configured owner's
signed assertion and matching nonce/assurance; this was not arbitrary login or a
legacy-password bypass. The affected managed path remains inactive.

Fix: [Code.gs](../backend/Code.gs) now checks the saved challenge's 120-second
lifetime with five-second clock tolerance before consuming it or issuing
authority, and rechecks proof expiry under the lock. Regenerated the installer.
The new regression first failed, then passed: manipulated timing is rejected,
no session is minted, the challenge is retained, and a genuinely fresh assertion
can still complete. The same completion gate protects login and action proofs.

### P3-02 — Capability helpers omitted confirmation version (Low, compatibility)

The documented confirmation can include `expectedVersion`, but frontend
`issueMemberLookup` and `revokeMemberLookup` omitted it from the eventual request.
Both version-bound operations therefore failed closed with fresh-confirmation
errors. The existing tests covered only confirmations without a version.

Fix: added an optional final `expectedVersion` argument to each helper, retaining
existing call compatibility, and documented the signatures. Two new client-to-
backend tests first failed, then passed for issuance and revocation, including
actual lookup/revocation outcomes. This forwards the bound confirmation target;
it does not introduce mandatory capability CAS or activate capability mode.

Phase 3 changes are limited to those two implementation fixes, three regression
scenarios, regenerated backend, the signature clarification in the checklist,
and this report. They remain local and unmerged.

## Checks actually executed

Node 24.16.0 / npm 11.9.0; locked Vite 7.3.7 and Playwright 1.62.1.
Checks below were rerun after implementation changes where relevant.

| Command/check | Actual result | Scope |
| --- | --- | --- |
| `npm ci` | PASS, exit 0; 272 added / 273 audited | One earlier attempt failed EPERM removing a Windows dependency directory; retry passed. No force fix or dependency change |
| Three new targeted regressions before fixes | FAIL, exit 1; 0/3 passed | Reproduced both defects; not omitted from evidence |
| Same targeted regressions after fixes | PASS, exit 0; 3/3 | Added to the normal source/bundle suite |
| `npm test` | PASS, exit 0; **202 source + 202 generated = 404 executions**, zero failures/skips | 202 scenarios, three more than Phase 2; synthetic service/identity tests |
| `FITZONE_TEST_BACKEND=bundle; npm run test:browser` | PASS, exit 0; **26/26**, zero failures/skips | Actual Chromium, intercepted synthetic backend; not Google/Vercel acceptance |
| `npm run generate:backend`, `npm run check:backend` | PASS, exit 0 | Installer regenerated from sources and freshness verified; vendor untouched |
| `npm run typecheck`, `npm run lint` | PASS, exit 0 each | Includes server/API TypeScript, not just frontend |
| `npm run build` | PASS, exit 0; 1,719 modules | Process-only synthetic endpoint and `VERCEL_ENV=production`; no deployment or private env rewrite |
| `npm run check:security` | PASS, exit 0; 20 modules plus backend parsing | Targeted sink/syntax guard, not full SAST |
| Actual Vite preview build with required isolation variables absent | Child exit 1, **expected rejection verified** | No cloud build/deploy; inherited synthetic production reference cannot silently pass |
| Vite `build({build:{write:false}})` with distinct synthetic preview config | PASS | Compiled JS contains synthetic staging destination and omits inherited synthetic production destination; no Google request |
| `node scripts/prepare-security-analysis.mjs` | PASS | Current Auth/Code JS mirrors and SHA manifest prepared |
| Bundled Python running `scripts/verify-codeql-coverage.py` with synthetic source ZIPs | PASS for positive/negative harness | Exact mirrors accepted; missing mirror rejected; **not actual CodeQL extraction** |
| SARIF result-gate tests | PASS within full tests | Actionable warnings/malformed results rejected; does not establish a clean actual CodeQL report |
| `npm run scan:secrets` | PASS, exit 0, zero findings in both scopes | Gitleaks 8.30.1, local reachable history and tracked working snapshot; untracked/private drafts excluded |
| New acceptance document supplemental Gitleaks stdin scan | PASS, exit 0, zero findings | Explicitly scans this new, untracked deliverable separately |
| `npm audit --omit=dev --audit-level=low` | PASS, exit 0; zero runtime advisories | Includes `jose`; no runtime vulnerability finding from this check |
| Full `npm audit --json` | **FAIL, exit 1; 9 affected development entries: 7 High, 2 Moderate** | Two underlying advisories below; no suppression/major force update |
| `npm run check:docs`, `git diff --check` | PASS, exit 0 | Final local documentation links and diff hygiene |

Remaining advisories:
[braces recursion](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) and
[selector-parser CPU exhaustion](https://github.com/advisories/GHSA-rj75-hqrm-r3gf).
The dependency graph is unchanged. A tested tooling migration or time-bounded,
owner-approved exception is required; trusted build inputs narrow exposure but
do not make the full audit pass. No automatic `audit fix --force` was used.

CodeQL, Semgrep, Trivy and ZAP were not available on PATH and were not run.
Python was the bundled runtime, not the Windows Store alias. No production
attack/load test or real Google staging test ran. Scanner success covers the
stated files/rules, not all remote/unreachable Git history or every secret class.

## Preview isolation — BLOCKED, live metadata verified

Read-only Vercel environment metadata, with no value decryption/output, still
shows one sensitive-type `VITE_APPS_SCRIPT_URL` entry targeting **Production and
Preview**, no branch scope. Required entries:

| Required variable | Accessible metadata result |
| --- | --- |
| `FITZONE_PREVIEW_APPS_SCRIPT_URL` | Missing |
| `FITZONE_PREVIEW_SYNTHETIC` | Missing |
| `FITZONE_PRODUCTION_ENDPOINT_SHA256` | Missing |

Project metadata confirms Vite, Node 24, `main` production branch,
`autoExposeSystemEnvs=true`, SSO setting `all_except_custom_domains`, and zero
custom environments. Those facts do not prove all preview access is protected.
Deployment metadata lists five historical deployments and no further page; none
is for this security branch/commits. The latest production SHA remains the
baseline above. Old previews were not exercised as security acceptance targets.

**Conclusion:** the new local build guard fails closed in the tested Preview
environment, but the cloud binding remains unsafe and historical previews are
not retroactively repaired. Actual production-endpoint non-inheritance cannot
be accepted. No push or preview deployment is permitted by this assessment.

Administrator actions, in order:

1. Privately verify the intended project/team and remove Preview from the
   production endpoint entry, keeping its approved Production value/target.
2. Provision/verify a disposable Google project and Sheet with synthetic-only
   records, distinct owner credentials, reviewed sharing/execution identity and
   scopes, expiry email off and no production access.
3. Create the three variables above **Preview-only**: staging `/exec` URL,
   synthetic attestation `1`, and SHA-256 of the exact approved production URL
   (UTF-8, no newline). Use the hidden fingerprint helper privately.
4. Recheck all branch/team/shared/custom overrides, system-variable exposure and
   effective preview protection. Independently confirm ownership/data/credential
   isolation; setting the attestation alone proves none of these.
5. Provide redacted scope evidence and destination comparison. After a later
   authorized staging release, verify the deployed destination, headers,
   framing/CSP and synthetic flow. Do not reuse production credentials.

## Independent recovery — BLOCKED

No real backup scheduler/exporter or independent storage integration exists in
the reviewed repository. The only backup implementation is the synthetic codec.
No accessible evidence establishes an external independent system. This means
**unavailable for acceptance**, not proof no private external backup exists.

Scheduling/job success, storage ACLs, encryption/key recovery, retention,
restoration time/data consistency, and protection against primary-account
compromise are all **NOT VERIFIED**. RPO 24h/RTO 4h and retention periods in the
checklist remain proposals. App-writable history and same-account Drive/version
history do not satisfy independent recovery.

An administrator must supply independently controlled snapshot/job evidence,
separate key/storage permissions and retained-copy deletion protections, approved
retention, failure monitoring, and a successful separate-project synthetic
restore with measured RPO/RTO. Restore must capture formats/types/timezone,
deleted-ID high-water mark, notice state and history metadata; exclude active
sessions, step-up/challenges and lookup authority. Keep email off and reconcile
Sent mail/journals before enabling it. Do not set backup-verification properties
or enable history merely to bypass this gate.

Pending-history reconciliation verifies row images but is not a cross-service
transaction repair engine. Operators must separately inspect notification
properties, formats, lookup revocation and counter state before marking an
interrupted restore applied. Real service-failure recovery remains untested.

## GitHub release gates — BLOCKED

Fresh read-only [main metadata](https://api.github.com/repos/YellankiKaushik/Gym-Membership/branches/main)
returns `protected:false`, enforcement off and no required contexts;
[rulesets](https://api.github.com/repos/YellankiKaushik/Gym-Membership/rulesets)
returns an empty list. Main remains at the reviewed baseline.
Main's workflow directory contains only `authentication-checks.yml`.
Actions run queries for both this branch and the Phase 2 HEAD return zero runs.
The connector rejected the workflow-list endpoint; the directory and run reads
succeeded. Repository security-analysis settings were not returned and remain
unknown, not presumed disabled.

The local security workflow has pinned actions, read-only default permissions,
CodeQL-only security-event write permission, no persisted checkout credentials,
runtime audit, redacted Gitleaks, exact GAS mirrors, source-archive and SARIF
gates. **CodeQL has not actually run or extracted the intended code.** A valid
synthetic source ZIP is only a gate unit test. Vendor bcrypt is integrity/test
covered, not claimed CodeQL covered. Actual JS analysis also must include
frontend/API/server/scripts; generic queries do not model every Google service.

After isolation and later push authorization, an administrator must obtain real
successful workflow runs including exact-source extraction and result gates,
enable appropriate scanning/push protection, configure an enforced main ruleset
with actual emitted check names, review/current checks, force-push/deletion
restrictions and audited recovery bypass. Test a failing disposable PR and
prohibited direct/force pushes using intended actors. Establish an independent
reviewer or workable controlled maintainer release policy; confirm Vercel's
production release waits for the approved checks. None was changed/tested live.

## Google staging and installer compatibility — BLOCKED externally

No independent confirmation of disposable ownership, sharing, scopes, unique
credentials, synthetic data or email-disabled properties is available. Therefore
no Google endpoint was contacted, even for synthetic ID `1`.

Local frontend/source/bundle compatibility passes, including the fixed
capability version contract and signed managed bridge. Current installer:
[FitZone_Complete.gs](../backend/generated/FitZone_Complete.gs), regenerated from
the three maintained sources; use the bundle **instead of** those three files,
never alongside them. Local VM parsing, globals, synchronous bcrypt and vendor
hash checks pass. Actual Apps Script V8 execution, OAuth permissions, redirects,
quota/lock behavior and installed-version equivalence remain unverified.

Before acceptance, use two independently verified synthetic Google installations
to test owner lifecycle, unauthorized/direct calls, cross-project sessions and
capabilities/proofs, normal CRUD/paid terms, ID persistence and bounded locking.
Test history/service-failure recovery only after its real backup gate. Use pure
notification preview and disabled-email behavior; no real sends/triggers are
authorized here. Agree request/time/quota stop limits before any capacity test.

## Managed MFA and privacy/history migration — NOT READY / INACTIVE

| Migration | Work still required before any activation |
| --- | --- |
| Managed owner identity | Choose an approved provider/plan; validate real phishing-resistant ACR/AMR semantics; configure issuer/JWKS/audience/immutable owner, per-gym binding and unique server/GAS HMAC key privately; preview subject/client/key must be separate with verified production-key fingerprint; enroll owner/factor, test independent recovery, revocation and key rotation |
| Managed UI | Integrate the provider SDK's supported PKCE/nonce flow with `maxAge:0` into the tested callbacks; build sign-in and managed action-confirmation UI, cancellation/logout and recovery UX; allow only required provider CSP origins. Current Owner Login and delete confirmation use passwords; enabling managed now would break those flows |
| Member privacy | Approve minimal public DTO and migration; test matching frontend `VITE_MEMBER_LOOKUP_MODE=capability` and GAS `MEMBER_LOOKUP_MODE=capability`; create reviewed owner issue/rotate/revoke/recover UI/process; privately distribute one-time returned codes after member identity verification, never URLs/logs/bulk mail; plan expiry/reissue/support without numeric bypass |
| Reversible history | Prove independent backup/restore, separate archive ACL/schema/retention and live partial-failure recovery; approve lifecycle/restore surface and owner confirmation; deploy compatible operation-ID/version client before activation |

Keep `OWNER_AUTH_MODE=managed`, `MEMBER_LOOKUP_MODE=capability` and
`MEMBER_HISTORY_ENABLED=true` **out of production configuration**. No flag was
enabled, provider chosen or member code sent. The new interfaces are not complete
enrollment/recovery/distribution products.

## Separate deployments and safe rollback

**Vercel:** after isolation, later authorization and actual CI, publish a protected
staging frontend/functions build. Verify response headers on that deployment;
Vite browser tests do not serve Vercel headers. Test the identity function's real
Vercel packaging/runtime only with the approved provider integration; frontend
`vite build` alone does not package/certify that server route. Preserve HSTS,
review branding/provider CSP origins and destination, and record exact frontend
SHA/config. Production deployment remains separately prohibited.

**Apps Script:** a separately authorized operator must install the regenerated
bundle in the verified disposable project, review private properties/scopes and
deployment execution/access identity, create a version and update that staging
web app. Preserve A:I and counters. Vercel publication does not update GAS.
Production Google code/properties/deployment remain unchanged; do not create a
daily trigger or enable email as part of acceptance.

Rollback must identify compatible known-secure frontend and GAS versions and
preserve history, counters and notification integrity. Frontend rollback cannot
restore Sheet/Properties state. Do not deploy an old insecure auth version or
re-enable numeric fallback as recovery. Credential-version fingerprints are
deterministic: reverting private configuration must first purge sessions,
step-up authority and challenges; never restore authority from backups or let
configuration rollback revive it. No live rollback/administrator recovery drill
was performed, so this gate is **NOT VERIFIED**.

## Remaining production risk and decision

No required external control is marked production verified. Password-only owner
access/shared-owner attribution, targeted lockout, direct Apps Script quota
abuse, default numeric membership enumeration, unverified independent recovery,
unenforced release restrictions, shared preview binding, non-independent logs,
remaining development advisories and historical-service/Google ACL inventory
remain open. Production still runs the baseline; local headers and gated
protections have not changed its exposure. No new Critical bypass was established.

| Decision | Status | Required evidence |
| --- | --- | --- |
| Continue isolated local synthetic verification | GO | Completed checks above; no cloud/data authority implied |
| Push / create cloud preview / accept Google staging | **NO-GO** | Correct preview scopes and independently verified disposable resources first; later explicit push/deploy authorization, actual CI/extraction and staged acceptance evidence |
| Activate managed MFA, capability lookup or history | **NO-GO** | Provider/UI/recovery, privacy/distribution and independent backup/history gates respectively |
| Production release | **NO-GO** | All above, enforced/tested release controls, real staged headers/runtime/Google compatibility, recovery/rollback proof, advisory ownership and separate release approval |

**Exact remaining blockers:** shared Preview/Production backend binding and three
missing Preview variables; no independent backup/restore evidence; unprotected
main/no rulesets; no actual security CI/CodeQL extraction; no verified disposable
Google staging or current staging headers/function runtime; incomplete managed
provider/UI/enrollment/recovery and capability distribution; nine development
audit entries without a time-bounded approved disposition; unverified live
rollback, Google permissions/historical services and protected logging controls.

**Safest next action:** have the administrator isolate Preview and provide
redacted ownership/permission/synthetic-credential evidence for disposable
Google resources, while establishing independently controlled backup/restore.
Recheck those gates read-only before requesting a later authorized push/staging
CI/deployment. Keep this branch local, unmerged and migration flags inactive.
