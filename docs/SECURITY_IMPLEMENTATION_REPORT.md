# Phase 2 security implementation report

Date: **19 October 2026**. Repository: `YellankiKaushik/Gym-Membership`. Branch: **`security/hardening-phase2`**, created from `89472587fa592ad96aaecd8807366d5f65ddea60`. The Phase 1 audit/remediation baseline is recorded in local commit `ddec4ea`. Subsequent focused local implementation commits are identified by `git log` and the completion report; this document does not embed its own commit hash.

**Local implementation is complete for the safe/testable scope described below. Production release is blocked.** No production Google Sheet, Script Property, trigger, deployment, permission, Vercel setting or GitHub setting was changed. No emails/WhatsApp messages were sent. No branch was pushed or merged; the verified shared preview/production environment binding prohibits pushing for now. No paid infrastructure or database migration was introduced.

## What changed

### Release, scanning and browser protections

- Added enforcing Vercel frame denial, nosniff, no-referrer, restricted browser capabilities and a minimal enforcing CSP. Broader CSP is Report-Only with explicit self/Google fetch origins, without unsafe shortcuts. Custom image/provider origins need environment-specific review before broader enforcement.
- Added fail-closed preview build configuration: a separate staging endpoint, synthetic-data attestation and verified production fingerprint are mandatory. Preview cannot silently inherit the production endpoint. Build errors omit private values; explicit public configuration replaces automatic `VITE_*` exposure.
- Added a preview-only owner-login warning, safe HTTPS/root-relative branding URL validation and a hidden-input fingerprint helper. Existing branding settings are preserved; no local environment file was changed apart from the public example's documented legacy lookup-mode default.
- Added weekly npm/Actions Dependabot configuration, a runtime advisory gate, pinned CodeQL and checksum-pinned official Gitleaks integration. Read-only workflow token scope is retained except CodeQL's required `security-events: write`. Checkout credentials are not persisted; installs remain locked with `npm ci`. No deployment workflow was added.
- CodeQL prepares exact `Auth.gs`/`Code.gs` JavaScript mirrors. A source-archive gate requires proof that they were extracted, and a SARIF gate rejects actionable results. Native `.gs` extraction is not assumed; local CodeQL execution remains unavailable. Standard JS queries do not prove all Apps Script authorization/storage semantics.
- Added a small targeted AST guard for executable/unsafe HTML sinks and backend syntax/global checks. It is explicitly not a replacement for full SAST. Retained the repository's existing bcrypt/installer LF and vendor-whitespace rules for portable byte-integrity checks.

### Login abuse resistance and identity interfaces

The concrete malformed-input defect is fixed: malformed requests are rejected before lock acquisition, bcrypt or failure-budget writes. A test sends 100 such requests while the lock is unavailable, then confirms valid owner login works with only one bcrypt comparison. Valid-shaped guessing still consumes a fixed-size five-comparison/15-minute budget. This preserves bounded expensive work but **does not solve targeted owner lockout**. No client IP/Origin header is trusted and no unbounded per-identifier state is created.

Added a provider-compatible managed identity path with actual server-side RS256/ES256 verification using pinned `jose` **6.2.12**, configured JWKS/issuer/audience/owner, exact required ACR/AMR, nonce, freshness and authorized-party checks. A short-lived HMAC proof binds the verified owner to a configured gym, challenge and purpose. Apps Script independently checks HMAC, installation/owner hash, deadlines, challenge/session binding and one-time consumption. Invalid or replayed proofs cannot create sessions or authorize actions directly.

Existing 30-minute absolute expiry, token digests, memory-only browser sessions, session cap, logout and credential-version revocation remain. Changes to managed mode/subject/installation/key invalidate earlier credential-version sessions. Fresh one-use confirmations bind delete/recovery/access-code administration to a session/member/version/action. The legacy delete confirmation UI works when the approved step-up policy is enabled.

**MFA is not activated.** The chosen provider, enrollment/recovery and SDK/sign-in UI are unavailable. The current Owner Login form stays password-based. Tested `loginOwnerWithIdentity` and `reauthenticateOwnerWithIdentity` callbacks provide integration interfaces; they are not a fake frontend MFA switch. Do not select managed mode until its real provider/UI/recovery path passes isolated Google staging. Challenge/work budgets can still be monopolized without a trusted limiter.

### Membership privacy and bounded work

Added opt-in capability mode: 64-hex random codes, digest-only server storage, expiry, rotation/revocation, owner-controlled issuance and a minimal DTO. Codes are sent in POST bodies, not query strings or storage. Secure backend mode rejects **all numeric GET lookup fallbacks**, even if an old frontend is still installed. Names, contact details, age and weight are excluded.

Valid capability lookup reads the ID column for uniqueness/selection, then one member row. The measured synthetic fixture with 100 members reads **109 cells versus 909** for the previous full-range path; this is a cell-read assertion, not a production latency/load benchmark. Unknown/malformed codes cause no member reads. Manual duplicate/moved IDs fail safely rather than using a stale member-data cache.

Limits are explicit: 10 accepted requests/code/minute, 60/installation/minute, 500 active capability records, default 10,000 member rows (including header), configurable up to 50,000 with review. Expired token state is pruned during issuance. Legacy numeric mode now has a shared read budget too, but remains enumerable and can be starved; invalid direct calls still consume Apps Script/Properties resources. No complete internet DoS protection is claimed.

**Capability migration is not activated** and needs privacy/distribution approval. Stable internal IDs and A:I remain. Recovery means owner-verified code replacement, never a numeric bypass. No member communications were sent or automated distribution feature added.

### Data integrity, history and recovery

Added disabled-by-default write-ahead history in a separately configured spreadsheet. Activation requires a recent, owner-attested independent restore verification and reference. The source cannot itself prove an administrator's attestation, so the actual independent backup and Google staging tests remain mandatory before enabling it.

History-mode updates/renewals/deletes require optimistic versions. Mutations require operation IDs; same-ID/same-intent completed retries return the prior result. The frontend retains an operation ID in memory after an ambiguous failure, avoiding duplicate creates on an explicit same-intent retry in history mode. It does not automatically retry mutations or persist member payloads.

Before/after images, original cell formats, displayed phone value and notification metadata are journaled/flushed before live changes. Commit follows the member write/flush. Physical deletion therefore has a recoverable archive; previous terms are preserved. Pending/ambiguous operations block further history-mode changes and normal notices until explicit reconciliation, instead of being silently retried. Protected restoration requires fresh confirmation, current-state checks, email off and journal review; it preserves raw legacy IDs, phone formatting, dates and the high-water mark, and revokes old lookup access. Reconciliation is editor-only and not an HTTP action.

Added a synthetic-only AES-256-GCM snapshot/restore rehearsal module. It rejects ordinary personal records, cross-installation/tampered snapshots and unsafe counters, excludes active sessions/config secrets, keeps notifications disabled and requires reconciliation. **It is not a production backup scheduler or independent backup proof.** Production archive/history stays off until those external requirements and a migration approval are satisfied.

### Minimal security events

Added structured allowlisted security events for login/failure/throttling, unauthorized operations, owner data reads, logout, fresh confirmation, managed identity, configuration changes, member mutations/restoration and capability changes. Events contain time, action/result, correlation and optional member ID. Inputs, passwords/verifiers, session/provider tokens, private URLs/config values, member contact/name and raw exceptions are excluded. Tests verify redaction.

Events use the existing provider console; they do not claim an independently protected immutable sink, configured alerts or individual staff attribution. No remote collector or real alert was enabled. The operational checklist describes those remaining access/retention/incident-response steps.

## Finding statuses

The authoritative per-finding table is in [the updated remediation plan](SECURITY_REMEDIATION_PLAN.md#phase-2-finding-status).

| Finding | Status |
| --- | --- |
| F01 public enumeration | PARTIALLY MITIGATED |
| F02 malicious lockout | PARTIALLY MITIGATED |
| F03 public workload | PARTIALLY MITIGATED |
| F04 release enforcement | BLOCKED BY EXTERNAL CONFIGURATION |
| F05 recovery readiness | PARTIALLY MITIGATED |
| F06 owner MFA | BLOCKED BY EXTERNAL CONFIGURATION |
| F07 browser headers | FIXED IN LOCAL CODE |
| F08 logging/attribution | PARTIALLY MITIGATED |
| F09 tooling advisories | PARTIALLY MITIGATED |
| F10 environment isolation | BLOCKED BY EXTERNAL CONFIGURATION |
| F11 historical services | BLOCKED BY EXTERNAL CONFIGURATION |

**No finding is PRODUCTION VERIFIED.** Local test doubles are not labeled actual Google synthetic staging. Overall production risk remains High pending access/release protection, verified backups and strong owner authentication. No confirmed Critical vulnerability was established, but stolen owner/publisher/Google credentials can still have severe business impact.

## File inventory

| Area | Files created or modified |
| --- | --- |
| Hosting/release | `vercel.json`, `.gitignore`, `.gitleaks.toml`, `.github/dependabot.yml`, `.github/codeql/codeql-config.yml`, `.github/workflows/security.yml`; original `.gitattributes` preserved in final tree |
| Dependency/config | `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.node.json`, `.env.example` |
| Backend | `backend/Auth.gs`, `backend/Code.gs`, regenerated `backend/generated/FitZone_Complete.gs`; vendor bcrypt unchanged |
| Identity server | `server/owner-identity.ts`, `api/owner-identity.ts` |
| Frontend | `src/api/gymApi.ts`, `src/types/member.ts`, `src/vite-env.d.ts`, `src/config/gymConfig.ts`, `src/utils/publicUrls.ts`, `src/components/OwnerLogin.tsx`, `src/pages/MemberLookup.tsx`, `src/pages/Adminpanel.tsx` |
| Security/build tools | `scripts/deployment-config.mjs`, `scripts/deployment-config.d.mts`, `scripts/deployment-fingerprint.mjs`, `scripts/check-security.mjs`, `scripts/scan-secrets.mjs`, `scripts/prepare-security-analysis.mjs`, `scripts/verify-codeql-coverage.py`, `scripts/check-codeql-results.mjs`, `scripts/synthetic-backup.mjs` |
| Regression tests | `tests/helpers/apps-script.mjs`, `tests/backend-auth.test.mjs`, `tests/api-auth.test.mjs`, `tests/security-config.test.mjs`, `tests/security-backend.test.mjs`, `tests/security-backup.test.mjs`, `tests/security-identity.test.mjs`, `tests/security-identity-http.test.mjs`, `tests/security-codeql-gate.test.mjs`, `tests/browser/security.test.mjs` |
| Documentation | Phase 1 baseline reports committed; remediation status updated; this report, `SECURITY_TEST_RESULTS.md`, `SECURITY_PRODUCTION_CHECKLIST.md`; installation, owner-authentication and notification guides point to activation gates |

Unrelated pre-existing untracked drafts/logs were not opened for implementation, staged, deleted or modified. Private environment files were not printed or edited. Ignored build output, synthetic screenshots, CodeQL mirrors and a reviewed scanner cache are local verification artifacts, not deploys or committed secrets.

## Deployment and migration impact

| Change | Manual Google deployment | Separate Vercel deployment | External/migration gate |
| --- | --- | --- | --- |
| Login partial fix / backend bounds / minimal events | Yes | Not intrinsically; compatible frontend recommended | Actual Google compatibility/quotas/log access |
| Headers / branding / preview guards | No | Yes | Preview isolation first; deployed headers must be checked |
| CI / Dependabot / scanner integration | No | No application deployment intrinsically | Safe push, actual CI, rulesets/admin security configuration |
| Legacy fresh-action confirmation | Yes | Yes | Explicit policy activation after staging |
| Managed identity | Yes | Yes | Provider, isolated server secrets, SDK/UI, enrollment/recovery; currently blocked |
| Capability lookup | Yes | Yes | Approved member migration/distribution; currently off |
| History/reversible archival | Yes | Yes for current client contract | Actual independent backup/restore, archive ACLs/format, staging/migration; currently off |
| Backup rehearsal tool | No | No | Production job/storage/identity remain unimplemented/unverified |

The installer still uses the existing three maintained sources in deterministic Bcrypt/Auth/Code order and is regenerated by the existing generator. Source/bundle tests, duplicate-global checks and bcrypt integrity support local compatibility; they do not certify a deployed Google version. Do not paste bundle plus sources together.

## Required next work

Follow [the production checklist](SECURITY_PRODUCTION_CHECKLIST.md) in order: isolate previews before pushing; enforce release/admin access controls; prove independent backup/restore; run real disposable Google staging; wire and enroll the chosen provider before managed mode; approve member/privacy/history migrations; verify effective Vercel headers; obtain separate compatible GAS/frontend release approval. Remaining development advisories require tested dependency-chain maintenance; no force-major update was used.

Frontend rollback does not restore member data, properties, history or Google versions. Pending history requires reconciliation, and credential/session revocation must survive recovery. Never disable authorization, revive old sessions or deploy insecure earlier authentication as a rollback shortcut. This implementation is not a claim that production is secure or unhackable.
