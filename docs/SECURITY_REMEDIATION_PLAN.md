# FitZone prioritized security remediation plan

Prepared **19 October 2026** against `main` at `89472587fa592ad96aaecd8807366d5f65ddea60`. Evidence, severity and limitations are in [the security audit](SECURITY_AUDIT_REPORT.md).

**Phase 2 local implementation update, 19 October 2026:** the user authorized repository implementation on `security/hardening-phase2`. Safe local changes have been implemented; account changes, production deployments and gated migrations remain unapproved. The original phased plan below is retained as the baseline. Current evidence and setup gates are in [the implementation report](SECURITY_IMPLEMENTATION_REPORT.md), [test results](SECURITY_TEST_RESULTS.md) and [production checklist](SECURITY_PRODUCTION_CHECKLIST.md).

## Phase 2 finding status

Statuses describe the stated layer only. **None is PRODUCTION VERIFIED or TESTED IN SYNTHETIC STAGING on real Google infrastructure.** Local VM/service doubles, signed synthetic identity tests and intercepted browser tests are explicitly local, not an actual Google staging deployment.

| Finding | Current status | Implemented evidence / remaining gate |
| --- | --- | --- |
| F01 | PARTIALLY MITIGATED | Revocable expiring capabilities, minimal DTO, POST-only token and no numeric fallback in secure mode tested locally; legacy remains default until approved member migration |
| F02 | PARTIALLY MITIGATED | Malformed input no longer acquires lock/runs bcrypt/spends failure budget; valid-shaped targeted lockout and platform quota DoS remain unresolved |
| F03 | PARTIALLY MITIGATED | Fixed public work budget, per-code budget, row cap and ID-column-plus-one-row reads tested; direct Apps Script execution/Properties abuse still needs trusted edge design and measured staging capacity |
| F04 | BLOCKED BY EXTERNAL CONFIGURATION | Pinned CodeQL, Gitleaks, runtime audit gate and Dependabot configured locally; main rulesets/reviewer/release gates require administrator action and actual CI execution |
| F05 | PARTIALLY MITIGATED | Gated archive/history, CAS, operation deduplication, interrupted-write reconciliation and synthetic encrypted restore tests implemented; independent real backup/restore remains unverified, so migration stays off |
| F06 | BLOCKED BY EXTERNAL CONFIGURATION | Real asymmetric JWT/assurance verification, installation-bound HMAC bridge, nonce/replay controls and fresh-action interfaces tested locally; provider enrollment, SDK/UI wiring and recovery are not complete; production password login unchanged |
| F07 | FIXED IN LOCAL CODE | Enforcing anti-framing/basic headers and broader Report-Only CSP plus tests; no Vercel deployment or live-header verification performed |
| F08 | PARTIALLY MITIGATED | Allowlisted redacted JSON events for auth/read/CRUD/recovery/config changes; independently protected log retention, staff attribution and alerts remain external work |
| F09 | PARTIALLY MITIGATED | Runtime gate and dependency monitoring configured; runtime audit zero, full audit still nine development entries/two advisories; no unproven major upgrade forced |
| F10 | BLOCKED BY EXTERNAL CONFIGURATION | Fail-closed preview endpoint/fingerprint guards and preview warning tested; read-only Vercel recheck still shows shared binding; no push permitted until actual isolation is verified |
| F11 | BLOCKED BY EXTERNAL CONFIGURATION | Reviewed redacted Gitleaks history/current scans pass; historical nonsecret URLs remain; private old-deployment/permission inventory and retirement need owner action; no history rewrite |

The confirmed malformed-request defect within F02 is fixed in source; the broader finding remains partial. F07's local status does not mean live hosting headers changed. Backup/provider/access attestations cannot be satisfied by merely setting a flag or passing a unit test. No critical finding was added or declared production-resolved.

Priorities: **P0** before extending production use or onboarding more gyms; **P1** next security release; **P2** subsequent improvement after measurement. Complexity: Small (localized), Medium (cross-component), Large (new identity/infrastructure or migration). The order within a phase reflects dependencies rather than a promise of completion time.

## Recommended starting point

Approve **Phase A** first: verify administrative access, establish recoverable independent backups, enforce release gates, separate previews, and decide the public-lookup privacy contract. Backups and a recovery path should precede destructive-operation or authentication migrations. Continue the current per-gym architecture while measuring constraints; a database rewrite is not the first remediation.

First five objectives, ranked by urgent benefit:

1. Protect GitHub main and publisher/admin accounts, with a documented maintainer recovery path (A1/A3; F04).
2. Create independently controlled backups and prove synthetic restore before changing data lifecycle (A2; F05).
3. Add strong owner MFA/identity validation and destructive-action step-up after recovery is ready (B2; F06).
4. Replace unrestricted numeric lookup with an approved minimal member-access model; separate synthetic previews immediately (A4/A5, C1; F01/F10).
5. Repair malicious owner lockout while retaining brute-force/compute limits (B1; F02).

Browser headers, dependency advisories and event logging should follow in the same planned security program; they are not substitutes for these access/recovery controls.

## Phase A — Emergency Protection

### A1 — Review administrative identities and access

- **Priority / targets / findings:** P0; Google accounts, Sheet sharing, Apps Script editors/execution identity/OAuth scopes, GitHub/Vercel membership and connected apps; F04/F06/F11 and unverified Google controls.
- **Engineering objective:** create a private installation/access inventory, remove unintended sharing only after owner review, require account MFA and recoverable account ownership, and minimize editors/execution-account access. Inventory old deployments before retiring any. Distinguish consumer Google accounts from Workspace administration; use the [CIS Workspace benchmark](https://www.cisecurity.org/benchmark/google_workspace) only where applicable.
- **Dependencies / benefit / complexity:** owner access and recovery verification; limits administrative bypass and shared-account blast radius; Medium operational effort.
- **Behavior and tests:** no member workflow change intended. Read-only identity/access review first; prove legitimate owner access and disallowed access using designated test accounts/disposable resources, without sharing production data. Review deployment identity and actual manifest scopes, not guessed defaults.
- **Rollback:** retain an owner-approved recovery route and record previous ACL settings privately; restore only intended access, never broad public sharing. Do not remove the last administrator.
- **Deployment:** manual GAS code deployment **No** for account/ACL inventory; deployment-setting changes may require a separately approved Google reauthorization/redeployment. Vercel deployment **No** for team/account controls.

### A2 — Establish independent, restorable backups before migration

- **Priority / targets / findings:** P0; external backup job/storage/identity and recovery runbook, Sheet A:I, private ID counter/notification state; F05.
- **Engineering objective:** encrypted, versioned snapshots using an independent identity whose historical copies cannot be deleted with the application principal. Separate secret-recovery material from member data. Exclude active `OWNER_SESSION_*` records. Set owner-approved retention, access auditing and failure alerts.
- **Dependencies / benefit / complexity:** A1 ownership and approved privacy/retention requirements; bounds data loss and account-compromise impact; Medium/Large infrastructure effort.
- **Behavior and tests:** propose RPO 24 hours/RTO four hours, daily 30 days/weekly 12 weeks/monthly 12 months subject to approval; these are not existing guarantees. Restore synthetic data into a separate project and verify date types, nine columns, counters/no reused IDs, notification state/no resend and no revived sessions. A notification-state restore must account for Sent-mail reconciliation, not blindly re-enable triggers.
- **Rollback:** disable faulty snapshot jobs while preserving existing snapshots; never overwrite the only source or restore over production as a test. Review any immutable retention lock before enabling it because that configuration can be irreversible.
- **Deployment:** manual GAS deployment **Conditional** if a new backup exporter is implemented there; prefer separate restricted backup execution where practical. Vercel deployment **No**. No live data copy is authorized by this plan alone.

### A3 — Enforce safe release gates on main

- **Priority / targets / findings:** P0; GitHub main ruleset/review policy, `.github/workflows/authentication-checks.yml`, Vercel Git release integration; F04.
- **Engineering objective:** require reviewed PRs and current application-check success, prevent unauthorized force pushes/deletion, scope bypass, and ensure production release waits for approved checks. Preserve full-SHA action pins, read-only permissions, locked install and no persisted checkout credentials.
- **Dependencies / benefit / complexity:** A1, verified real check names and maintainer model; prevents unreviewed release drift; Small/Medium. A sole maintainer cannot independently approve their own PR: agree an enforceable reviewer/release policy instead of imposing an unusable rule.
- **Behavior and tests:** disposable failing/passing PR and attempted prohibited push using appropriate test actor; verify emergency process without weakening normal gates. Confirm Vercel deployment-check behavior rather than assuming a CI job automatically gates Git integration.
- **Rollback:** documented administrator recovery with auditable temporary bypass; restore scoped prior rules only if necessary. Do not permanently disable controls to clear a failed build.
- **Deployment:** manual GAS **No**; Vercel deployment **No** for policy changes, unless the release workflow itself is separately changed and tested.

### A4 — Separate preview/staging from production

- **Priority / targets / findings:** P0; Vercel environment target/branch bindings, disposable Google project/Sheet/owner configuration, frontend build acceptance; F10.
- **Engineering objective:** previews use synthetic-only staging endpoint and distinct credentials, production uses its intended endpoint; verify installed project identity without exposing private values. Require protected previews where appropriate and tell reviewers never to enter production credentials into changed/untrusted preview code.
- **Dependencies / benefit / complexity:** A1, owner-provisioned disposable resources; limits accidental writes and credential crossover; Small/Medium.
- **Behavior and tests:** compile target-specific builds, assert destination using redacted comparisons, exercise synthetic workflows and confirm cross-project token rejection. Do not migrate current production Sheet or change its deployment.
- **Rollback:** retain correct production binding; if staging breaks, stop the preview and repair its binding rather than pointing it back at production.
- **Deployment:** manual GAS **Yes for a new staging installation** if needed; **No change to current production deployment**. Vercel preview rebuild **Yes**; production rebuild **Only if** its environment binding is changed with approval.

### A5 — Decide and contain public membership disclosure

- **Priority / targets / findings:** P0 decision; P1 implementation; lookup product/privacy contract, `backend/Code.gs:216–232`, `src/pages/MemberLookup.tsx`, `src/api/gymApi.ts`, installation/member instructions; F01/F03.
- **Engineering objective:** approve owner-only lookup or high-entropy member-specific capabilities with minimal output, expiry/revocation and abuse budget. If an urgent privacy shutdown is chosen, make it an explicit temporary behavior change rather than silently breaking lookup.
- **Dependencies / benefit / complexity:** business privacy decision, A2 before migrating access records; prevents simple ID enumeration; Medium.
- **Behavior and tests:** stable internal numeric IDs and A:I remain; external lookup access may change. Prove guessing/revoked capability/missing capability cannot obtain member facts. Do not retain an unrestricted numeric fallback that bypasses the new model. Plan member distribution/recovery without disclosing other members' information.
- **Rollback:** disable new public access fail-closed while fixing issues; do not roll back to the known disclosure without an explicit risk decision. Privately preserve migration mapping outside live A:I columns.
- **Deployment:** manual GAS **Yes** for enforcement; Vercel **Yes** for lookup UI/API contract; member communication/migration **Yes**, separately approved.

## Phase B — Authentication and Authorization

### B1 — Replace global malicious-lockout behavior

- **Priority / targets / findings:** P1; `backend/Auth.gs:44–96`, source/bundle auth tests, possibly challenge service/private gateway; F02/F03.
- **Engineering objective:** validate input cheaply, preserve generic failures and bounded bcrypt work, and use bounded progressive anti-automation that hostile unknown/malformed attempts cannot convert into project-wide denial of the valid owner. Retain session cap, absolute expiry and lock release on all outcomes.
- **Dependencies / benefit / complexity:** A4 disposable staging and an approved rate/challenge model; reduces owner lockout without opening brute force; Medium. Do not use a client-supplied `X-Forwarded-For`, Origin or gym ID as trusted identity. Per-owner counters alone still allow targeted lockout.
- **Behavior and tests:** source and bundle tests covering five malformed attempts followed by valid owner, repeated wrong valid-shaped passwords, concurrent attempts, window expiry, challenge replay/bypass and quota budgets. Any staging performance test needs explicit budget/stop limits; no real endpoint brute force.
- **Rollback:** versioned backend rollback to a previously approved limited mode or temporarily disable public login if necessary; never remove all throttling as a fallback.
- **Deployment:** regenerate bundle/manual GAS **Yes**; Vercel **Conditional** if adding challenge or UX. No Script Properties values are changed automatically.

### B2 — Introduce strong owner authentication and sensitive-action confirmation

- **Priority / targets / findings:** P1; `backend/Auth.gs`, `Code.gs` session/action gate, `gymApi.ts`, OwnerLogin/Adminpanel, private identity-provider configuration, owner recovery instructions; F06/E05.
- **Engineering objective:** prefer managed MFA/passkeys with backend-verified assertions and explicit installation-owner binding. Evaluate issuer, audience, expiry, nonce/signature, algorithm and key-rotation rules; enforce the provider's required authentication strength and verified factor/authentication-context claims so an ordinary single-factor assertion cannot satisfy MFA. Google-account MFA alone does not add a factor to custom owner login. If TOTP is chosen instead, review encrypted secret storage, enrollment/recovery, replay prevention and rate controls explicitly.
- **Dependencies / benefit / complexity:** A1/A2/A4, supported provider decision, B1, private recovery process; reduces stolen-password impact; Large.
- **Behavior and tests:** preserve short absolute server sessions, memory-only frontend state, logout/credential rotation and endpoint binding. Add fresh step-up for export/destruction with one-use action binding, not a reusable front-end flag. Test replay, challenge expiry, wrong audience/gym, old/revoked credentials, recovery abuse and every protected action. Staff roles require separate principals and least-privilege server checks only if product scope includes staff.
- **Rollback:** staged enrollment and recovery proof before disabling existing access. Maintain a tightly controlled audited administrative recovery method; no public fallback that bypasses MFA. Roll back using reviewed versions and invalidate incompatible sessions.
- **Deployment:** manual GAS **Yes**, Vercel **Yes**, private provider setup/owner enrollment **Yes**. New login domains/origins must be included in the tested browser policy.

### B3 — Improve password provisioning and session lifecycle without weakening controls

- **Priority / targets / findings:** P2, or alongside B2 if retaining passwords; `scripts/create-owner-config.mjs`, `backend/Auth.gs`, owner setup guide; E02/E05.
- **Engineering objective:** check common/breached/context-specific passwords using a safe local/private method; recommend unique passphrases of at least 15 characters while retaining explicit bcrypt byte-limit errors. Never send the plaintext password to a third-party service or log it. Define all-session revocation, loss/recovery and credential-rotation procedures.
- **Dependencies / benefit / complexity:** identity choice B2; reduces credential reuse and operational mistakes; Small/Medium.
- **Behavior and tests:** legitimate supported Unicode/ASCII, 72-byte boundaries, no silent truncation, existing cost limits and hidden TTY entry, no secret output beyond deliberately private verifier provisioning. Test rotation invalidates old sessions and does not revive them after restore. No arbitrary periodic rotation/complexity rules without a reason.
- **Rollback:** preserve supported existing verifier format until an approved migration; keep private recovery instructions. Do not reset real passwords while testing.
- **Deployment:** manual GAS **Conditional** if backend policy/session functions change; Vercel **Conditional** for session UI; local provisioning-only changes require neither runtime deployment.

## Phase C — Backend and API Hardening

### C1 — Bound public work and evaluate a verified server-side boundary

- **Priority / targets / findings:** P1; public lookup/row-read helpers in `backend/Code.gs`, `gymApi.ts`, optional Vercel server routes/private config; F01/F03/B1.
- **Engineering objective:** reduce work per lookup with measured indexing/caching, robust invalidation and limits; retain duplicate-ID failure behavior. Decide whether managed edge abuse controls justify a server layer based on real workload and support cost.
- **Dependencies / benefit / complexity:** A5, B1, measured Google quotas, A4; availability and clearer authorization boundary; Medium for bounded access, Large for gateway migration.
- **Behavior and tests:** **A proxy alone is insufficient.** If adopted, GAS must reject direct protected requests lacking a server-verified envelope or equivalent authority. Proposed private server-to-GAS authentication: HMAC over version, installation, method/action, body digest, timestamp and nonce, with replay store, clock-skew limits and timing-safe comparison. Keep server keys out of `VITE_*`; verify all public/owner routes so the original endpoint cannot bypass rate/auth policy. Keep editor-only triggers/internal functions correctly separated. Treat this as a new protocol requiring review, not an automatic patch.
- **Cookie implications:** if the gateway changes to HttpOnly/Secure/SameSite sessions, add server CSRF defenses and session fixation/revocation tests. Current token-in-body flow has no equivalent ambient auth cookie; do not add meaningless cookie advice to the current implementation.
- **Tests:** direct endpoint bypass, spoofed headers, invalid signatures/installation, replay/skew, cached revocation, read consistency, malformed/oversized bodies, pending writes, synthetic load with explicit staging limits. Never use Origin/CORS as authorization.
- **Rollback:** dual-protocol rollout only under explicit short-lived approval and without a bypassable public legacy path; fail closed or disable affected feature if integrity checks fail. Securely rotate temporary server keys when retiring versions.
- **Deployment:** manual GAS **Yes**; Vercel **Yes** if gateway/client protocol changes; private server secrets/configuration and staged migration **Yes**. A smaller GAS-only optimization may avoid a new service.

### C2 — Make conflicts, retries and destructive changes recoverable

- **Priority / targets / findings:** P1; `Code.gs:210–214,281–365`, source/bundle/member/API/browser tests, owner UI, separate archive/history store; F05/E01/E04.
- **Engineering objective:** version the client contract before requiring expected versions; use an independent archive or tombstone/history ledger outside A:I for reversible deletion and previous terms. Design operation IDs with bounded deduplication and queryable outcome for ambiguous network timeouts before enabling retries.
- **Dependencies / benefit / complexity:** A2, B2 step-up for destructive actions, approved history/retention contract; protects paid-term integrity and recoverability; Medium/Large.
- **Behavior and tests:** current valid owners are authorized to edit, so optional CAS is a conflict-safety change, not an auth bypass fix. Preserve ID high-water marks, contact-only expiry behavior, four plans, inclusive renewals, date/timezone semantics and notification journal. Test stale/omitted versions across supported clients, simultaneous owners/manual edits, duplicate operation IDs, partial writes, retry/timeout and archive restore. Locks cannot atomically include manual Sheets edits or Gmail transactions.
- **Rollback:** compatible versioned deployment and migration backup; never discard archive history/counters. Stop unsafe writes on schema/state mismatch; restore only in a reviewed maintenance procedure.
- **Deployment:** manual GAS **Yes**, Vercel **Yes** for changed contract/delete UX. Archive/backfill outside nine live columns is a data migration requiring separate approval; no automatic change to current Sheet.

## Phase D — Frontend and Deployment Hardening

### D1 — Deploy tested response headers and a compatible CSP

- **Priority / targets / findings:** P1; new Vercel hosting header configuration, `index.html`, trusted gym branding configuration, browser tests; F07/E03.
- **Engineering objective:** deny framing, prevent MIME sniffing and explicitly limit browser capabilities. Preserve existing HSTS and meta no-referrer. Begin content restrictions in **Report-Only** and collect redacted violations before enforcing.
- **Dependencies / benefit / complexity:** known branding image origins, C1/B2 if changing API/auth origins; limits UI redress and future injection impact; Small/Medium.
- **Proposed starting CSP (must be adjusted/tested, not copied blindly):**

```text
default-src 'none';
script-src 'self';
style-src 'self';
img-src 'self' https://<explicit-approved-branding-origin>;
font-src 'self';
connect-src 'self' https://script.google.com https://script.googleusercontent.com;
base-uri 'none';
object-src 'none';
form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests;
```

The angle-bracket origin is a placeholder requiring replacement/removal, not valid production policy. Add only actually required image/font/auth/redirect origins. Do not add wildcards, `unsafe-eval` or blanket `unsafe-inline` to silence reports. Google response redirects and supported branding need testing. Report-Only does not enforce frame blocking: use X-Frame-Options DENY immediately after preview validation or a separately enforced minimal frame-ancestors policy while content restrictions are being evaluated.

- **Other headers:** `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()` if no approved feature needs them. Consider COOP same-origin only after testing OAuth/WhatsApp/popups; it is not automatically required for this fix.
- **Behavior and tests:** iframe rendering blocked, CSP violation review, mobile/dialog/focus/scroll styles, login/lookup/CRUD, images/maps, Google redirects, WhatsApp and provider login. Public static HTML CORS is not an owner-record access-control vulnerability; do not break Google transport to “fix” it. Header checks must run on deployed preview and production because Vite local headers do not attest to Vercel settings.
- **Rollback:** keep frame/nosniff protections where working; return content policy to Report-Only rather than broadly trusting script origins. Keep prior Vercel deployment available.
- **Deployment:** manual GAS **No**; Vercel **Yes**. Revisit policy if gateway/provider origins change.

### D2 — Resolve tooling advisories and establish scanning ownership

- **Priority / targets / findings:** P1; `package.json`, lockfile, CSS/toolchain, Actions workflows, dependency-update policy, vendored bcrypt integrity; F09/F04.
- **Engineering objective:** test supported dependency-chain updates/replacements for both underlying advisories; avoid force-fixing incompatible major versions. Establish an owned update schedule, security advisory triage, secret scanning/push protection and appropriate SAST coverage.
- **Dependencies / benefit / complexity:** A3/A4, supported version research at implementation time; reduces known build-tool risks and future response lag; Medium, potentially Large if Tailwind migration needed.
- **Behavior and tests:** locked clean install in approved environment, full source/bundle/browser/type/lint/build/docs checks, visual comparison and fresh npm runtime/dev audits. If a fix is unavailable, time-box a documented exception, isolate trusted build input and track upstream. Do not silently claim advisories eliminated by removing audit checks.
- **Scanner scope:** evaluate official CodeQL/Semgrep coverage for TypeScript and GAS-compatible JavaScript; `.gs` coverage must be explicitly configured/verified or marked unsupported. Scan maintained sources and detect generated drift; avoid hiding all backend code as a generated duplicate. Use reviewed Gitleaks configuration for current/reachable history; synthetic fixtures may need narrow documented allowlists. Never upload unredacted secret artifacts to CI logs. Trivy/container checks only where a real artifact makes them applicable.
- **Rollback:** restore reviewed lockfile/toolchain and prior compatible frontend deployment, retain triage evidence; do not deploy a known-broken UI solely for a lower audit count. Do not rewrite public history automatically for nonsecret URLs.
- **Deployment:** manual GAS **No** for tooling/CI-only changes; **Yes only if** backend source changes. Vercel **Yes** when updated assets/toolchain ship. Scanning/account settings alone require no runtime deployment.

## Phase E — Monitoring and Recovery

### E1 — Add privacy-preserving security events and incident response

- **Priority / targets / findings:** P1; Auth/Code security boundaries, separate protected log sink, owner runbook/alerts; F08/F05.
- **Engineering objective:** record timestamp, installation/principal identifier, action, outcome code, minimal member identifier if needed, correlation ID and relevant version. Log login failures/successes, session revocation/credential changes and CRUD/export/destructive events with controlled retention. Alert on failed-login/destructive-action patterns and backup failures.
- **Dependencies / benefit / complexity:** A1/A2/B2 identity, log ownership/retention, approved alert destination; detection and defensible recovery; Medium.
- **Behavior and tests:** do not log raw tokens, passwords/verifiers, credential-derived version values, member names/phones, private Sheet/deployment URLs or raw Google exception messages. Prevent log injection; protect append-only history against the running app and restrict readers. Test redaction, authorization, missing/outage sink, event rate bounds and deletion attribution. Document whether each failure must fail closed or safely buffer based on action criticality.
- **Runbook:** suspicious access => preserve minimal evidence, restrict affected identity, revoke sessions/rotate compromised credentials, assess member disclosure, restore validated data if needed, communicate through approved channels and review root cause. Outage => distinguish quota/config/publisher/Sheet failures. Notification ambiguity => review Sent mail and journal before explicit reconciliation; never blindly resend. No alerts/messages are sent in Phase 1.
- **Rollback:** disable faulty forwarding/alerts while preserving local-safe or provider evidence and access controls; never expose secrets to regain observability. Do not delete historical records during rollback.
- **Deployment:** manual GAS **Yes** for application events; Vercel **Conditional** for gateway telemetry; provider logging settings and alert routing require approved configuration, not necessarily deployment.

### E2 — Operationalize restores, retention and release inventory

- **Priority / targets / findings:** P1 operational acceptance, recurring review thereafter; backup system, installation/version inventory, notification/mailbox retention, recovery docs; F05/F11/E06.
- **Engineering objective:** verify snapshot completion, independent identity access, restore time and data consistency. Maintain per-gym mapping of intended frontend/source/GAS versions without publishing private identifiers. Review historical endpoints, collaborator drift and backup/email retention.
- **Dependencies / benefit / complexity:** A2, C2, E1; turns backup existence into demonstrated recovery; Medium.
- **Behavior and tests:** periodic synthetic restore plus owner-approved controlled recovery drill, no live Sheet overwrite. Record achieved RPO/RTO, not just targets. Validate historical term recovery, no token revival, counter integrity and notification reconciliation. Test both frontend rollback and manual GAS version recovery as separate processes.
- **Rollback:** disable a broken scheduled job without deleting valid snapshots; retain a known-good runbook and installation inventory. Retention deletion/immutable-lock changes require explicit approval and review.
- **Deployment:** manual GAS **Conditional** for job changes; Vercel **No** for operational drills, **Conditional** only if a compatible rollback is actually approved. No production rollback is authorized by this plan.

## Phase F — Security Validation

### F1 — Source, bundle, browser and staging security acceptance

- **Priority / targets / findings:** P1 release gate for every implemented change; all regression/security tests, generated bundle, isolated Google projects, hosting policy; F01–F11 and relevant E improvements.
- **Engineering objective:** produce reproducible evidence for each change and its exact deployed versions; close findings only after both implementation and required live-setting verification.
- **Dependencies / benefit / complexity:** completed approved changes and disposable staging, synthetic fixtures, owned checklists; prevents regressions and unsupported assurance claims; Medium.
- **Required validation matrix:**

| Layer | Tests / evidence required |
| --- | --- |
| Authentication/authorization | Every action without/with invalid/expired/revoked token; login cannot return records; wrong-project token; MFA challenge/assertion/recovery abuse; credential rotation/session cap/logout |
| Abuse resilience | Valid owner remains available after malformed traffic; compute/challenge/replay budgets; direct GAS bypass denied if a gateway is adopted; staging-only measured quota margin |
| Public privacy | Numeric guessing, invalid/revoked capabilities, no identity/contact leaks or existence side channels beyond approved contract; only allowlisted fields |
| Input/data integrity | Formula/control-character attempts, canonical/duplicate IDs, dates/four plans, phone preservation, inclusive renewal, contact-only changes, stale clients and operation deduplication |
| Concurrency/recovery | Parallel writes/busy errors, version mismatch, partial failure, archive/backup restore, persistent counters, corrupted state fail-closed, no resurrected sessions |
| Notifications | Boolean-only preview, trigger event wrapper, email-disable switch, pending/sent/failed ledger and ambiguous delivery reconciliation using doubles; no real send unless separately approved |
| Frontend/browser | Safe React rendering, trusted URL validation, session memory/legacy cleanup, stale responses/logout race, CSP/headers/framing on deployed staging, branding/dialog/navigation/WhatsApp behavior |
| Cloud isolation | Two actual disposable Google projects/Sheets with distinct credentials/permissions; intended execution identity/scopes; denied cross-project operations; no production credentials/data |
| CI/dependencies/secrets | Locked installs, generated freshness/vendor integrity, reviewed advisories, supported SAST coverage, approved history secret scan, enforced PR/checks and preview/prod separation |
| Recovery/release | Independent backup access, achieved RPO/RTO, separate Vercel and GAS rollback/version verification, operator recovery without broad bypass |

- **Commands in the approved implementation phase:** `npm run check:docs`, `npm run check:backend`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:browser`, npm full/runtime audits. Run reviewed security scanners only after installing trusted tooling with approval where required. Production build can write normally in Phase 2 if authorized; Phase 1 used an in-memory build to respect the two-file restriction.
- **Staging boundaries:** no ZAP active/load/security traffic against production. Obtain explicit disposable target/permissions/budget before ZAP or stress tests; use synthetic members, disposable credentials, email disabled, request/time/quota caps and stop criteria. Passive ZAP still needs the authorized staging target. Do not use the user's earlier production/disposable URLs automatically as authorization for active audit attacks.
- **Behavior / rollback:** testing itself must not change production behavior. Stop rollout on failed privacy/auth/recovery checks; revert reviewed code/config versions only after compatibility checks. Preserve backups and investigation evidence. Do not auto-disable controls to get green tests.
- **Deployment:** manual GAS **Yes for isolated staging acceptance**, production **Only after separate approval**; Vercel staging **Yes**, production **Only after separate approval**. Scanners/local checks alone require neither deployment.

## Rollout and closure rules

1. Obtain explicit Phase 2 scope before making source, dependency, account, environment or infrastructure changes. Audit approval is not deployment approval.
2. Capture a private configuration/version inventory and prove independent recovery first. No real member data belongs in repository fixtures or reports.
3. Implement the smallest coherent change, preserving original security controls and regenerating the installation bundle from maintained sources. Never hand-edit the generated backend alone.
4. Test against synthetic local doubles and isolated Google staging; review behavior/migration impact and known limitations. Two green local suites cannot certify cloud ACLs or quotas.
5. Deploy compatible frontend and GAS versions deliberately; one does not automatically update the other. Verify effective settings/version and rollback access after any approved rollout.
6. Close findings with before/after evidence, remaining risk owner and verification date. Keep runtime-unknown items open until checked; accepted residual risk needs a stated owner and review date.

Use [OWASP ASVS 5.0.0](https://owasp.org/projects/asvs), [OWASP Top 10:2025](https://top10.owasp.org/2025/) and [CIS Controls v8.1](https://www.cisecurity.org/controls/v8-1) as control references. This plan does not claim certification, prescribe a costly multi-tenant rewrite, or authorize live data changes, sends, triggers or deployments.
