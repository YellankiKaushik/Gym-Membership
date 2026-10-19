# Phase 2 security test results

Date: **19 October 2026**. Branch: `security/hardening-phase2`. Results refer to the local implementation, **not production certification**. All membership/authentication simulations used synthetic records/credentials and service doubles. No real Google API login, lookup, mutation, trigger, email or load test was performed.

## Final command ledger

| Command / check actually run | Result | Evidence / scope |
| --- | --- | --- |
| `npm ci` | PASS, exit 0 | Final locked graph: 272 packages installed / 273 audited; no major force-upgrade |
| `npm run check:docs` | PASS, exit 0 | 18 Markdown files / 151 local links and anchors checked |
| `npm run check:backend` | PASS | Generated installer up to date; deterministic maintained-source order and globals |
| `npm test` | PASS, exit 0 | **199 tests in source mode + 199 in generated-bundle mode = 398 passing executions**, 0 failures/skips in each; 199 scenarios, not 398 distinct vulnerabilities |
| `npm run typecheck` | PASS | Frontend/Vite plus new Node identity server/API modules |
| `npm run lint` | PASS | Existing rules retained; expanded to identity server/API; no disabling rules to obtain success |
| `npm run build` | PASS | Vite 7.3.7, 1,719 transformed modules; process-only synthetic endpoint override; ignored output only; no deployment |
| `FITZONE_TEST_BACKEND=bundle` then `npm run test:browser` | PASS | **26 browser tests, 0 failures/skips**; 23 existing + 3 security flows; Chromium with intercepted synthetic backend, external requests blocked |
| `npm audit` | **FAIL, exit 1: advisories remain** | 9 affected development-package entries: 7 High + 2 Moderate, 2 underlying advisories; no falsely claimed clean full audit |
| `npm audit --omit=dev` | PASS, exit 0 | **0 runtime advisories**, including pinned `jose` dependency |
| `npm run check:security` | PASS, exit 0 | 20 application modules checked; targeted AST unsafe-sink guard and backend syntax/global parsing, not full SAST |
| `node scripts/prepare-security-analysis.mjs` | PASS | Exact normalized JS mirrors and SHA-256 manifest prepared for Auth/Code; ignored local artifacts |
| Synthetic ZIP fixtures through `scripts/verify-codeql-coverage.py` | PASS | Positive exact-source fixture accepted; missing backend rejected; **not actual CodeQL extraction/analysis** |
| SARIF result-gate regression | PASS within full tests | Valid empty results accepted; warning, malformed structure/JSON rejected; diagnostic snippets not printed |
| `npm run scan:secrets -- --download`, final `npm run scan:secrets` | PASS, exit 0 | Official Gitleaks 8.30.1 checksum verified; final reachable local history and tracked snapshot returned zero findings; no unrelated untracked/private files scanned |
| Read-only Vercel environment target metadata | BLOCKER CONFIRMED | One sensitive-type backend URL entry still targets Production + Preview with no branch scope; values were not decrypted/printed and settings not changed |

Node **24.16.0**, npm **11.9.0**, Playwright **1.62.1**, Vercel CLI **54.4.1**, bundled Python **3.12.14**, vendored bcryptjs **3.0.3**, new server verifier `jose` **6.2.12**. Browser test screenshots remain ignored synthetic artifacts. The final test count adds 51 local scenarios per installation format and three browser flows over the Phase 1 baseline.

## Behavioral security coverage

| Requirement | Actual evidence |
| --- | --- |
| Auth bypass / unauthorized writes | Every existing protected action and new restore/reauth/capability-admin route rejects absent/fake credentials before member access; GET cannot dispatch admin operations |
| Missing/expired/revoked sessions | Exact server deadline, credential rotation, logout replay, cap/pruning and endpoint binding exercised; memory-only frontend state/legacy cleanup preserved |
| Malformed inputs / bcrypt cost | 100 malformed attempts with unavailable lock cause zero bcrypt work and no throttle record; correct owner succeeds afterward; valid-shaped hostile traffic remains capped at five comparisons/window |
| Known-owner targeted abuse | Explicit test still demonstrates valid-shaped requests can exhaust the shared owner budget; this is a recorded unresolved risk, not a passing claim of complete DoS prevention |
| Public enumeration | Secure mode rejects arbitrary numeric GETs and invalid/missing codes uniformly with zero member reads; legacy contract remains separate/default until approved migration |
| Capability lifecycle / quotas | Correct code, replacement, revocation, expiry, cross-project rejection, per-code/global budget, active-state ceiling/expiry pruning, duplicate/moved ID handling and row cap tested |
| Read optimization | 100-member fixture uses 109 cells for ID-column + one row versus 909 full-range cells; no stale member-data cache; not a latency/load benchmark |
| Formula/malformed member data | Existing name/control-character, phone, age/weight, plan/date and persistent-ID regressions retained; text formatting reinforced; archive restore validates before images |
| Fresh destructive confirmation | Missing/expired/replayed proof rejected; proof bound to parent session, member, version and purpose; browser wrong/empty password cannot delete, successful confirmation clears password field |
| Managed identity | Synthetic ES256-signed provider assertions exercise issuer/audience/owner/nonce/ACR/AMR/auth-time/authorized-party checks; unsigned/forged/expired/stale/weak/wrong-gym claims rejected; one-use bridge proof and managed password-fallback rejection tested |
| Frontend managed interfaces | Actual signed synthetic assertion → Node verifier → HMAC proof → Apps Script session → action-bound confirmation → deletion in doubles; browser storage contains no provider/shared key or session credential |
| Cross-gym isolation | Separate in-memory Script Properties reject other-project session/capability/identity proof; **actual project configuration not verified** |
| Concurrent work / lock release | Existing shared-execution ID allocation and lock-contention tests retained; new lookup/auth/identity/step-up contention and finite state checks exercise fail-closed behavior |
| Deduplication / optimistic versions | Missing/stale versions rejected in history mode; same operation/intent replays without another creation; different intent rejected; client retains operation ID after an ambiguous response |
| Archive/recovery | Independent-restore gate, separate-store requirement, before/after journal, deletion/previous-term restore, raw legacy IDs and numeric-phone format preservation, counters and intervening-edit conflicts tested |
| Partial failures | Archive write failure blocks member writes; post-write commit failure remains pending; unsafe retries/notices blocked; editor reconciliation checks before/after images; failed writes do not reuse reserved IDs |
| Backup rehearsal | AES-GCM round trip, tampering, wrong key/gym/version, unsafe data/counter/date/duplicate IDs, session/config exclusion and email-disabled restore plan tested using synthetic-only data |
| Notifications | Existing disable switch, pure preview, trigger-event wrapper, pending/sent/failed journal/backoff/ambiguous delivery behavior retained in source and bundle; new pending-history protection tested without Gmail |
| Redacted events / errors | Credential/identity/CRUD/revocation events inspected in captured logs; no passwords/verifiers/raw session/provider tokens, private identifiers, names/phones or raw exceptions; client errors stay generic |
| Hosting/configuration | Enforcing frame policy separated from Report-Only CSP; no unsafe shortcuts; preview inheritance/missing attestation/same-destination rejection, URL validation and action pin/permission assertions tested |

## Scanner findings and coverage boundaries

Gitleaks uses the upstream default rule set without broad fixture/backend exclusions. Installation pins official release archives by platform SHA-256; output is reduced to rule/file/line and redacted reports are removed from temporary directories. Inline `gitleaks:allow` comments cannot silently suppress checks. Scans cover reachable local Git history and tracked/staged current files, not all inaccessible/deleted remote objects, ignored private files or unrelated untracked drafts. Zero findings is not proof no secret has ever existed.

Full npm advisories remain:

- [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm): `braces` recursion/stack exhaustion, propagated through development tool chains.
- [GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf): selector-parser CPU exhaustion, propagated through CSS tooling.

The suggested force fix includes a breaking Tailwind major update. No unproven major upgrade/downgrade, broad suppression or audit-fix command was used. Trusted build inputs narrow the observed exposure; no anonymous runtime route into these packages was established. Monitoring/runtime gating does not resolve the development advisories.

CodeQL CLI, Semgrep, Trivy and ZAP were unavailable locally; none is claimed passed. The committed CodeQL workflow has not run because the branch is unpushed. JavaScript mirrors avoid relying on native `.gs` support; actual CodeQL database extraction remains **unverified** until the source-archive gate succeeds in CI. Vendor bcrypt coverage is integrity/regression testing, not claimed native scanner coverage. Generic JS queries do not comprehensively model Google services. No ZAP or production attack/load test ran.

## Failures found and corrected during implementation

- Initial sandboxed `npm ci --ignore-scripts` failed on filesystem permissions; requested normal `npm ci` subsequently passed, including the final graph. Initial metadata fetching failed sandbox DNS; read-only retry succeeded without exposing values.
- Initial browser run could not find the sandbox-redirected Chromium cache. Tests subsequently used the existing installed Chromium with normal permissions; no alternate assertions were substituted.
- A new browser test expected a nonexistent empty-state label; it was corrected to the existing “Your community starts here” heading and then passed. Application behavior was not weakened to satisfy the assertion.
- ESLint rejected a control-character regular expression in the new branding validator. It was replaced with an equivalent explicit character check; the lint rule was retained.
- Recovery testing found that value-only restoration could lose raw zero-padded IDs or numeric-phone display formats. The implementation now captures/restores original formats and validates the saved displayed phone. Source/bundle tests verify this case.
- Commit review caught an unnecessary replacement of the existing Git attributes. Its original bcrypt/installer LF and vendor-whitespace rules were restored; the final file matches main and vendor payload bytes never changed.
- Localhost HTTP tests and a Python temporary-directory fixture hit sandbox access restrictions. Authorized normal-permission retries passed; the ZIP fixture was confined to the ignored workspace analysis directory. These were tooling/environment failures, not production verification.

No failing assertion was skipped, no existing authorization/notification test was removed, and no security mechanism was weakened to obtain green checks. The obsolete test that expected malformed requests to lock out the owner now uses valid-shaped wrong credentials, preserving the bcrypt-budget regression while explicitly testing the repaired malformed case separately.

## Still required before release

Actual Google permissions/scopes/deployed versions, independent backup identity/job/restore and achieved RPO/RTO, real provider enrollment/recovery/UI, member access-code migration/distribution, quota/lock capacity, independent log retention/alerts, actual GitHub enforcement/scanner execution, Vercel preview scope/protection and deployed headers remain unverified. Follow [the production checklist](SECURITY_PRODUCTION_CHECKLIST.md); local success authorizes neither production data changes nor deployment.
