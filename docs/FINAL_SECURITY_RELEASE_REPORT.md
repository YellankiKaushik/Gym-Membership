# FitZone Security Release Report

**Reviewed:** 3 November 2026 (Asia/Kolkata)
**Decision:** **RELEASE BLOCKED — Google Apps Script validation and release gates are incomplete.**  
**Scope:** Fake-data prototype only. This report does not certify the product as secure for real member data.

## Executive result

- **Prototype release:** **NO-GO pending backend validation.** Google access is now authenticated and the existing project, version 3 deployment, original source/manifest and fictional Sheet checkpoint have been verified and privately backed up. The owner directed that the Apps Script API remain off. The official `clasp push` was rejected before any source write because that API is disabled, so the editor remains unchanged, the actual head test was not run, and no new public version or `/exec` smoke test exists. PR #6 remains unmerged and Vercel Production was not updated. The temporary fake-data Preview exception remains in force without claiming Preview isolation; it does not waive backend verification.
- **Commercial readiness:** **NO-GO.** Application-level owner MFA, secure member-lookup migration, isolated customer projects/data, independent backups with demonstrated restore, member history/recovery, effective abuse controls, protected security-event logging, and incident-response validation remain prerequisites.
- The repository contains the code for the reviewed security candidate. Tests and scans are evidence about that code, not proof of security or live account configuration.

## GitHub

| Item | Result |
| --- | --- |
| Initial `main` | `cf9af5c789696b6306ffad9c347a62dec43cc30a` |
| `main` at final review | `cf9af5c789696b6306ffad9c347a62dec43cc30a` (unchanged; last refreshed with `git fetch`) |
| Security code candidate before this status update | `97243cca0637379053c07765dd5c4e8358c413cc` (remote ref refreshed; subsequent branch updates contain only this release-report correction) |
| Pull request | [#6 — security/hardening-phase2 into main](https://github.com/YellankiKaushik/Gym-Membership/pull/6), last confirmed open and draft; direct GitHub page/API was inaccessible in this session |
| PR merge commit | None; not merged |
| Main protection | Last verified active ruleset `main-required-checks` (ID `26360575`); it requires PR, resolved review threads, and `verify`, `runtime-dependencies`, `codeql`, `secrets`; blocks force pushes and deletion; requires no second reviewer. Repository-admin role has a recovery bypass. Not rechecked this turn. |
| Existing remote branches | `main`, `gh-pages`, and `feature/fitzone-promotional-video` remain; `security/hardening-phase2` was added and pushed normally. No force push or main write occurred. |

The security branch includes history-preserving integration commit `12448a59b61a669279a41d95c33da57be4911c78` and later CodeQL/documentation-gate fixes. PR #6 remains draft. Both CodeQL review threads have replies; the checksum-gated archive-flow thread was resolved with its narrow false-positive rationale, and the URL-origin finding was already marked resolved/outdated after the strict URL fix. No PR-to-main merge commit exists because the mandatory Apps Script gate remains open.

## Code changes

The candidate contains the security hardening and the compatible merge from main. Principal areas include:

- Frontend/backend owner-authentication and session handling: `src/api/gymApi.ts`, `src/components/OwnerLogin.tsx`, `src/pages/Adminpanel.tsx`, `src/pages/MemberLookup.tsx`, `src/config/gymConfig.ts`, `src/types/member.ts`, `src/utils/publicUrls.ts`, `src/vite-env.d.ts`, `api/owner-identity.ts`, `server/owner-identity.ts`, `backend/Auth.gs`, and `backend/Code.gs`.
- Generated Apps Script parity and controlled-test support: `backend/generated/FitZone_Complete.gs`, `backend/testing/PrototypeHeadChecks.gs`, and `backend/OWNER_AUTH_SETUP.md`. The generated installer remains current; no Google deployment was performed.
- Security controls and CI: `.github/workflows/security.yml`, `.github/codeql/codeql-config.yml`, `.gitleaks.toml`, `scripts/check-security.mjs`, `scripts/check-codeql-results.mjs`, `scripts/check-docs.mjs`, `scripts/scan-secrets.mjs`, `scripts/prepare-security-analysis.mjs`, `scripts/verify-codeql-coverage.py`, `scripts/deployment-config.mjs`, `scripts/deployment-config.d.mts`, `scripts/deployment-fingerprint.mjs`, `scripts/synthetic-backup.mjs`, `.gitignore`, `.env.example`, and `vercel.json`.
- Regression coverage: `tests/api-auth.test.mjs`, `tests/backend-auth.test.mjs`, `tests/browser/security.test.mjs`, `tests/helpers/apps-script.mjs`, `tests/prototype-compatibility.test.mjs`, `tests/security-backend.test.mjs`, `tests/security-backup.test.mjs`, `tests/security-codeql-gate.test.mjs`, `tests/security-config.test.mjs`, `tests/security-identity-http.test.mjs`, and `tests/security-identity.test.mjs`.
- Security/deployment and user documentation: `INSTALLATION.md`, `docs/NOTIFICATIONS.md`, and `docs/SECURITY_{AUDIT_REPORT,IMPLEMENTATION_REPORT,PRODUCTION_CHECKLIST,PROTOTYPE_ROLLOUT,REMEDIATION_PLAN,STAGING_ACCEPTANCE,TEST_RESULTS}.md`.
- Build configuration: `tsconfig.node.json`, `vite.config.ts`, and `vercel.json`.
- Root `package-lock.json` received compatible audit resolution for the high-severity Zod advisory; no forced breaking downgrade was used. Remotion lockfiles and pinned versions were not changed. `promo-video/LICENSE_OBLIGATIONS.md` was updated with the current terms review.
- This report: `docs/FINAL_SECURITY_RELEASE_REPORT.md`.

No production app authentication mode, backend code, public deployment, Vercel setting, or advanced migration flag was activated. `OWNER_AUTH_MODE=managed`, `MEMBER_LOOKUP_MODE=capability`, and `MEMBER_HISTORY_ENABLED=true` remain inactive. The authorized safety setting `EXPIRY_EMAIL_ENABLED` is now exactly `false`; the existing notification trigger and journal were left intact. The approved promo-video source and all published MP4 files were preserved; this turn did not change their visual inputs or rerender them.

## Automated testing and CI

### Local checks

| Command/check | Result |
| --- | --- |
| `npm ci` | Pass; installed from the lockfile. |
| `npm run check:docs` | Pass; 29 Markdown files and 187 local links/anchors. |
| `npm run check:backend` | Pass; generated installer is up to date. |
| `npm run check:security` | Pass; targeted guard parsed 20 application modules and backend syntax/globals. This is not a full SAST scan. |
| `npm test` | Pass; 206 source tests and 206 generated Apps Script bundle tests (412 executions). |
| `npm run test:bundle` | Pass; 206 generated-bundle tests. Also run inside `npm test`. |
| `npm run typecheck` | Pass. |
| `npm run lint` | Pass. |
| `npm run build` | Pass; production Vite build generated. |
| `npm run test:browser` | Pass; 26/26 browser tests, including responsive layouts and owner/member flows. |
| `npm run scan:secrets` | Pass; Gitleaks 8.30.1 reported zero findings in reachable local history and the tracked working tree. |
| `npm audit` | **Not clean:** 12 moderate package entries, all from advisory `GHSA-g3hv-75wg-m249` (`minimatch <11.0.1`, globparts denial of service) in the development ESLint/TypeScript-ESLint toolchain. The audit was rerun with registry access; npm proposes a forced breaking dependency change and it was not applied. **Time-limited prototype-only disposition expires 2 December 2026:** no customer/production data; reassess and remediate compatibly or stop using the affected development tooling by expiry. |
| `npm audit --omit=dev` | Pass; zero runtime dependency vulnerabilities (rerun with registry access). |
| Promo `npm test` | Pass; 27/27 tests. |
| Promo `npm run typecheck` | Pass. |
| Promo `npm run check:compositions` | Pass; both compositions were checked for metadata, layout, frame rendering, and a short H.264 sample. One initial attempt collided with the exclusive verification lock; rerun after verification, with required local browser permission, passed. |
| Promo `npm run verify` | Pass; all four exports fully decoded: hero and clean 1920×1080/60s, silent 1920×1080/60s, vertical 1080×1920/30s. The verification reports were restored after confirming the outputs so no generated report diff remains. |
| `node --test tests/security-codeql-gate.test.mjs` | Pass; regression test verifies malformed findings fail closed, the exact checksum-gated release flow is narrowly recognized, removing the checksum check fails, and an attacker-controlled URL host fails closed. |
| `git diff --check` | Pass. |

The previously approved MP4 hashes remain hero/clean `f8e8d0b65a6ce5e3ccdc41ae1f22b09bbf6d7becfbe32380f00586fb4509937b` and vertical `98c8cc3310474dd787c5aec458bb926e16e70bae47df68a15781f97c6856def5`. No MP4 bytes were changed in this task.

### GitHub Actions and CodeQL

The previous GitHub status audit checked candidate `97243cca0637379053c07765dd5c4e8358c413cc`: application verify, runtime dependencies, secrets, and CodeQL were all reported passing, and the CodeQL result reported no new alerts ([application/security workflow runs](https://github.com/YellankiKaushik/Gym-Membership/actions), [CodeQL runs](https://github.com/YellankiKaushik/Gym-Membership/security/code-scanning)). Subsequent branch updates only correct this release report; their checks have not been refreshed because the GitHub connector returned 404 and the browser session was signed out. The external Vercel Preview status was previously **failure** because the explicit deployment-config guard rejects the shared production endpoint; this is not counted as a passing Preview. The owner-approved fake-data exception permits proceeding without claiming Preview isolation, but it does not waive the Apps Script head/deployment checks or controlled production smoke test.

The previously completed CodeQL coverage gate verified the intended TypeScript/JavaScript source set (21/21 TypeScript files and 13/13 JavaScript files) and exact archived Apps Script source mirrors for `backend/Auth.gs` and `backend/Code.gs`. The SARIF/extraction gate completed successfully. This evidence demonstrates coverage of the configured scope, not a guarantee that all vulnerabilities are found.

## Remotion license obligations

The eight Remotion packages at version `4.0.538` remain unchanged in `promo-video/package-lock.json`, with their custom license classifications and upstream notices intact. The package-specific evidence and pinned v4 license text are recorded in [`promo-video/LICENSE_OBLIGATIONS.md`](../promo-video/LICENSE_OBLIGATIONS.md).

Official Remotion documentation checked 2 November 2026 says the Free License is available to an individual or organization/team of up to three people, including commercial media creation; users outside free eligibility need a Company License. Current terms consider involved parties that own, control, or operate the same editable project. A customer receiving only the finished MP4 is distinguished from one that uses or controls the Remotion project. Current pricing/FAQ list `renderMedia()` and `renderStill()` as automation APIs for Company License Users, while also stating free-eligible users may automate. This repository’s render script calls both APIs. The owner’s eligibility, total involved-party headcount, and any license entitlement were not available to verify, so no license conclusion is claimed.

Official references: [version-tagged Remotion v4.0.538 license](https://github.com/remotion-dev/remotion/blob/v4.0.538/LICENSE.md), [current Terms v5.0](https://www.remotion.dev/docs/terms), [license FAQ](https://www.remotion.dev/docs/license/faq), and [license/pricing](https://www.remotion.dev/docs/license/pricing). Remotion describes its license as proprietary/source-available rather than OSI open source. These terms concern tool use; they do not restrict ownership of generated media under the current Terms, and they do not establish licensing rights for separately sourced media.

## Google Apps Script

- The authenticated Apps Script editor and clasp both identified the existing project by its exact project ID. The existing public Web app is still deployment version 3 (`FINAL`); a separate `@HEAD` deployment already exists. The public deployment ID and `/exec` URL were preserved. No new project or endpoint was created.
- Private recovery artifacts now include the pre-edit project clone, a separate clone of deployed version 3 (including `appsscript.json`), and the Sheet copy `FitZone TEST Recovery 2026-11-03`. The Sheet copy is saved under the same account with “Share with same people” unchecked. Private source hashes, project/deployment identities, prior deployment settings, installer SHA and release SHA are recorded in `private-recovery/release-checkpoint-2026-11-03.txt`, which is untracked and must not be published.
- Script Properties were inspected without exposing their values in this report. `EXPIRY_EMAIL_ENABLED` was changed to the exact string `false` and independently read back after a settings reload. The existing high-water mark (6), notification journal, and other properties were left untouched. A pre-existing time-based `runDailyExpiryNotifications` trigger remains. The current source short-circuits sending unless the property is exactly `true`, so the disabled value blocks this trigger and the test path.
- A temporary `FITZONE_PROTOTYPE_HEAD_TEST=fictional-data-only` property was added, then deleted and its absence verified. No test helper was installed and no actual Apps Script head test was run.
- The Apps Script API setting is **OFF**, per the owner’s explicit direction. Official `clasp push` returned “User has not enabled the Apps Script API” before writing any project files. The editor still contains its original `Code.gs`, `Auth.gs`, `Bcrypt.gs`; version 3 remains public. No new code version was created or deployment updated.
- The maintained source-to-installer check passes. Generated installer SHA-256: `5CBCC8B84B9621B61BD45081D9E02C7002AE6D8E134570A9578D3AE9440ED048`. No Sheet rows were mutated. `/dev` head checks, cleanup assertions, authenticated live operations, and existing `/exec` smoke tests are **NOT RUN**. Do not merge or deploy until the owner changes the API setting or uses another explicitly authorized official upload method, then the candidate head test and production smoke pass.

## Vercel

- The last reported Production deployment was on commit `cf9af5c789696b6306ffad9c347a62dec43cc30a`; that deployment was reported READY and the public app returned HTTP 200 in the earlier read-only check. Production was not rechecked this turn, and no deployment was made for this PR.
- The production response did not include the candidate `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, Content Security Policy, or Permissions Policy headers. The candidate headers are therefore not live on the checked deployment.
- The candidate Preview failed at the explicit Vite configuration guard because there is no distinct synthetic staging endpoint and verified production-endpoint fingerprint. The owner approved a temporary exception for this fake-data-only prototype that does not claim Preview isolation and instead relies on local/browser tests, production-build checks, GitHub CI, actual Apps Script head/deployment verification, and controlled production smoke checks. This exception does not authorize real customer data. No endpoint, Vercel environment variable, or attestation was changed to bypass the guard.
- The existing fake-data endpoint and production build compatibility were not authenticated end-to-end. Preview isolation is not asserted or a release prerequisite under the approved exception. The Apps Script gates and controlled production smoke test remain mandatory before production deployment.

## Recovery and data integrity

- The original Sheet was not mutated. A private same-account fictional-data checkpoint, pre-edit source/manifest copy, and exact version-3 source/manifest rollback copy were verified. The only live configuration change was `EXPIRY_EMAIL_ENABLED=false`; the temporary test gate was removed. No code rollback was needed because the Apps Script API rejected the push before a write.
- The currently reported Vercel commit `cf9af5c789696b6306ffad9c347a62dec43cc30a` is identifiable as the frontend rollback target; production was not rechecked after this session began. The existing Apps Script rollback target is public deployment version 3 and its exact files are privately cloned; no restore was needed or demonstrated.
- The local protected backup/recovery tooling has automated tests. The real Sheet has a same-account private checkpoint copy, but no restore drill was performed. The original Sheet's rows were not modified.

## Commercial readiness and follow-up

Do not introduce real gym/member data until the owner completes and evidences: application-level owner MFA; the secure lookup migration; isolated Google project/Sheet ownership per customer; scheduled independent backups and a tested restoration; member history and reversible recovery; measured abuse controls; protected security-event logging; and documented access control, rollback, incident-response, and tenant-isolation procedures. Reassess the remaining moderate dev-tool `minimatch` advisory and Remotion license eligibility before ongoing use. No “100% secure,” “unhackable,” or certification claim is made.

## Final decision

**RELEASE BLOCKED — Apps Script API is OFF by owner instruction, so clasp cannot install the reviewed source.** The account, project ID, version-3 public deployment, existing deployment ID, and private rollback copies were verified; email is disabled, the test flag is removed, and no Sheet rows were changed. The actual head test and public `/exec` integration smoke test were not run, so no new backend version was published. Keep PR #6 unmerged and do not update Vercel Production until the verified editor candidate passes those tests. The main ruleset and fake-data Preview exception do not substitute for the Apps Script gate.
