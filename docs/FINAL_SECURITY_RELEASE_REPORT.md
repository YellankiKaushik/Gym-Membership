# FitZone Security Release Report

**Reviewed:** 2 November 2026 (Asia/Kolkata)  
**Decision:** **RELEASE BLOCKED — Google Apps Script validation and release gates are incomplete.**  
**Scope:** Fake-data prototype only. This report does not certify the product as secure for real member data.

## Executive result

- **Prototype release:** **NO-GO pending backend validation.** The security branch and draft pull request are published and automated checks pass, but the existing Apps Script deployment/version, actual controlled head test, rollback state, and `/exec` behavior were not verified with authenticated Google access. The PR is not merged and no production deployment was made. The owner authorized a temporary fake-data Preview exception: rely on local/browser tests, production-build checks, GitHub CI, an actual Apps Script head test, and a controlled production smoke test without claiming Preview isolation. Preview still fails closed; no unsafe Preview configuration was introduced.
- **Commercial readiness:** **NO-GO.** Application-level owner MFA, secure member-lookup migration, isolated customer projects/data, independent backups with demonstrated restore, member history/recovery, effective abuse controls, protected security-event logging, and incident-response validation remain prerequisites.
- The repository contains the code for the reviewed security candidate. Tests and scans are evidence about that code, not proof of security or live account configuration.

## GitHub

| Item | Result |
| --- | --- |
| Initial `main` | `cf9af5c789696b6306ffad9c347a62dec43cc30a` |
| `main` at final review | `cf9af5c789696b6306ffad9c347a62dec43cc30a` (unchanged) |
| Security implementation candidate with completed checks | `53b294452439bbbd9904b0d25972729c826bbaa7` |
| Pull request | [#6 — security/hardening-phase2 into main](https://github.com/YellankiKaushik/Gym-Membership/pull/6), open and draft |
| PR merge commit | None; not merged |
| Main protection | Verified active ruleset `main-required-checks` (ID `26360575`); main reports protected. Requires PR, resolved review threads, and `verify`, `runtime-dependencies`, `codeql`, `secrets`; blocks force pushes and deletion; requires no second reviewer. Repository-admin role has a recovery bypass. |
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

No production app authentication mode, backend deployment, email setting, deployment environment setting, or advanced migration flag was activated. `OWNER_AUTH_MODE=managed`, `MEMBER_LOOKUP_MODE=capability`, and `MEMBER_HISTORY_ENABLED=true` remain inactive. The approved promo-video source and all published MP4 files were preserved; this remediation did not change their visual inputs or rerender them.

## Automated testing and CI

### Local checks

| Command/check | Result |
| --- | --- |
| `npm ci` | Pass; installed from the lockfile. |
| `npm run check:docs` | Pass; 28 Markdown files and 185 local links/anchors. |
| `npm run check:backend` | Pass; generated installer is up to date. |
| `npm run check:security` | Pass; targeted guard parsed 20 application modules and backend syntax/globals. This is not a full SAST scan. |
| `npm test` | Pass; 206 source tests and 206 generated Apps Script bundle tests (412 executions). |
| `npm run test:bundle` | Pass; 206 generated-bundle tests. Also run inside `npm test`. |
| `npm run typecheck` | Pass. |
| `npm run lint` | Pass. |
| `npm run build` | Pass; production Vite build generated. |
| `npm run test:browser` | Pass; 26/26 browser tests, including responsive layouts and owner/member flows. |
| `npm run scan:secrets` | Pass; Gitleaks 8.30.1 reported zero findings in reachable local history and the tracked working tree. |
| `npm audit` | **Not clean:** 12 moderate package entries, all from one advisory `GHSA-g3hv-75wg-m249` (`minimatch <11.0.1`, globparts denial of service) in the development ESLint/TypeScript-ESLint toolchain. No high or critical findings remain. npm proposes a forced breaking downgrade for its remaining fix; it was not applied. **Time-limited prototype-only disposition expires 2 December 2026:** no customer/production data; reassess and remediate compatibly or stop using the affected development tooling by expiry. |
| `npm audit --omit=dev` | Pass; zero runtime dependency vulnerabilities. |
| Promo `npm test` | Pass; 27/27 tests. |
| Promo `npm run typecheck` | Pass. |
| Promo `npm run check:compositions` | Pass; both compositions were checked for metadata, layout, frame rendering, and a short H.264 sample. One initial attempt collided with the exclusive verification lock; rerun after verification, with required local browser permission, passed. |
| Promo `npm run verify -- --published-only` | Pass; all three published MP4s fully decoded and met metadata/audio checks: hero and clean 1920×1080/60s, vertical 1080×1920/30s. |
| `node --test tests/security-codeql-gate.test.mjs` | Pass; regression test verifies malformed findings fail closed, the exact checksum-gated release flow is narrowly recognized, removing the checksum check fails, and an attacker-controlled URL host fails closed. |
| `git diff --check` | Pass. |

The previously approved MP4 hashes remain hero/clean `f8e8d0b65a6ce5e3ccdc41ae1f22b09bbf6d7becfbe32380f00586fb4509937b` and vertical `98c8cc3310474dd787c5aec458bb926e16e70bae47df68a15781f97c6856def5`. No MP4 bytes were changed in this task.

### GitHub Actions and CodeQL

For candidate `53b294452439bbbd9904b0d25972729c826bbaa7`, GitHub scheduled and completed new runs (the result is not inferred from historical runs):

- [Application verify run](https://github.com/YellankiKaushik/Gym-Membership/actions/runs/41433586619) — pass.
- [Security checks, PR run](https://github.com/YellankiKaushik/Gym-Membership/actions/runs/41433586607) — `runtime-dependencies`, `secrets`, and `codeql` pass.
- [Security checks, push run](https://github.com/YellankiKaushik/Gym-Membership/actions/runs/41433580338) — `runtime-dependencies`, `secrets`, and `codeql` pass.
- [Latest CodeQL result](https://github.com/YellankiKaushik/Gym-Membership/runs/125238300895) — successful check, no new alerts. Alert 3 for the medium `Network data written to file` flow was dismissed with a documented false-positive reason: the URL is fixed to the official Gitleaks 8.30.1 release and the complete archive must match a hard-coded platform SHA-256 before write/extract. The SARIF gate permits only this exact sink with that guard/version/digest; regression tests fail if the guard is removed. This disposition is specific to the verified artifact flow and does not suppress other findings.

CodeQL’s coverage gate verified the intended TypeScript/JavaScript source set (21/21 TypeScript files and 13/13 JavaScript files) and exact archived Apps Script source mirrors for `backend/Auth.gs` and `backend/Code.gs`. The SARIF/extraction gate completed successfully. This evidence demonstrates coverage of the configured scope, not a guarantee that all vulnerabilities are found.

## Remotion license obligations

The eight Remotion packages at version `4.0.538` remain unchanged in `promo-video/package-lock.json`, with their custom license classifications and upstream notices intact. The package-specific evidence and pinned v4 license text are recorded in [`promo-video/LICENSE_OBLIGATIONS.md`](../promo-video/LICENSE_OBLIGATIONS.md).

Official Remotion documentation checked 2 November 2026 says the Free License is available to an individual or organization/team of up to three people, including commercial media creation; users outside free eligibility need a Company License. Current terms consider involved parties that own, control, or operate the same editable project. A customer receiving only the finished MP4 is distinguished from one that uses or controls the Remotion project. Current pricing/FAQ list `renderMedia()` and `renderStill()` as automation APIs for Company License Users, while also stating free-eligible users may automate. This repository’s render script calls both APIs. The owner’s eligibility, total involved-party headcount, and any license entitlement were not available to verify, so no license conclusion is claimed.

Official references: [version-tagged Remotion v4.0.538 license](https://github.com/remotion-dev/remotion/blob/v4.0.538/LICENSE.md), [current Terms v5.0](https://www.remotion.dev/docs/terms), [license FAQ](https://www.remotion.dev/docs/license/faq), and [license/pricing](https://www.remotion.dev/docs/license/pricing). Remotion describes its license as proprietary/source-available rather than OSI open source. These terms concern tool use; they do not restrict ownership of generated media under the current Terms, and they do not establish licensing rights for separately sourced media.

## Google Apps Script

- Authenticated Google Apps Script access was unavailable in this session. The existing project, deployed version, live manifest, editor identity, existing `/exec` URL, and rollback version could not be read or captured. No Google code was deployed and no Sheet was accessed or mutated.
- Therefore the controlled existing-project `/dev` head test, owner-authenticated operations, fictional-row cleanup, old-row integrity check, and existing `/exec` smoke tests were **not run**. A local mock is not counted as an Apps Script execution.
- The maintained generated installer passed parity checks. Its SHA-256 is `5CBCC8B84B9621B61BD45081D9E02C7002AE6D8E134570A9578D3AE9440ED048`.
- Existing frontend endpoint configuration was not changed. The current live endpoint identity, `EXPIRY_EMAIL_ENABLED=false`, and migrations-off state were not independently verified against Google properties. Do not merge/deploy until an authorized owner completes the documented bounded procedure in [`SECURITY_PROTOTYPE_ROLLOUT.md`](SECURITY_PROTOTYPE_ROLLOUT.md), records deployment/version/rollback evidence, confirms the existing URL and safe flags, and verifies marked fictional rows are cleaned up.

## Vercel

- Current production remains on commit `cf9af5c789696b6306ffad9c347a62dec43cc30a`; its existing deployment was reported READY and the public app returned HTTP 200 in a read-only check. No production deployment was made for this PR.
- The production response did not include the candidate `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, Content Security Policy, or Permissions Policy headers. The candidate headers are therefore not live on the checked deployment.
- The candidate Preview failed at the explicit Vite configuration guard because there is no distinct synthetic staging endpoint and verified production-endpoint fingerprint. The owner approved a temporary exception for this fake-data-only prototype that does not claim Preview isolation and instead requires local/CI checks, actual Apps Script head/deployment verification, and controlled production smoke checks. This exception does not authorize real customer data. No endpoint, Vercel environment variable, or attestation was changed to bypass the guard.
- The existing fake-data endpoint and production build compatibility were not authenticated end-to-end. Keep Preview unapproved and do not deploy the candidate to production before a safe isolated preview and Apps Script gates are verified.

## Recovery and data integrity

- No live Google data or production deployment was mutated; no restore or rollback was performed.
- The currently live Vercel commit `cf9af5c789696b6306ffad9c347a62dec43cc30a` is identifiable as the frontend rollback target. The existing Apps Script deployment/version rollback target was not captured, and no actual restore was demonstrated.
- The candidate’s local protected backup/recovery tooling has automated tests, but that does not substitute for an independent backup or demonstrated restoration of the real Sheet. Real Sheet integrity remains unverified because Google was not accessed.

## Commercial readiness and follow-up

Do not introduce real gym/member data until the owner completes and evidences: application-level owner MFA; the secure lookup migration; isolated Google project/Sheet ownership per customer; scheduled independent backups and a tested restoration; member history and reversible recovery; measured abuse controls; protected security-event logging; and documented access control, rollback, incident-response, and tenant-isolation procedures. Reassess the remaining moderate dev-tool `minimatch` advisory and Remotion license eligibility before ongoing use. No “100% secure,” “unhackable,” or certification claim is made.

## Final decision

**RELEASE BLOCKED —** authenticated Apps Script access is unavailable, so the existing deployment/version and rollback target, controlled `/dev` head test, current `/exec` identity, safe Script Properties, and fictional-data smoke checks remain unverified. Main remains unchanged. The main ruleset is active, and the owner-approved temporary Preview exception is documented for fake-data-only use; neither substitutes for the mandatory backend gate. Keep PR #6 draft and do not merge/deploy until an authorized owner completes the backend procedure and the candidate is smoke-tested against the preserved deployment.
