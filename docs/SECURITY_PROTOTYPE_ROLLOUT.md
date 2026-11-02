# Phase 4 — controlled FitZone prototype rollout

Prepared **20 October 2026** (Asia/Calcutta), on `security/hardening-phase2`.
**GO for local fake-data verification and controlled owner-run head testing.
Public release remains pending exact approval and live acceptance. Real customers:
NO-GO.** No push, merge, account setting, Script Property, trigger or public
deployment was changed in this phase. One public fictional-ID lookup was read;
no authenticated live operation or Sheet mutation was performed.

## Scope and release identity

The owner confirms all existing member records are fictional, the existing
Google Sheet/Apps Script project are for testing, and Google/GitHub/Vercel account
MFA is already enabled. These are owner-provided facts, not independent account
inspection. Account MFA does not enable managed MFA in the FitZone login.

Use the **existing repository, existing Google project and existing public
`/exec` URL**. No new Apps Script project is required. Keep that URL in frontend
configuration; do not substitute a library URL, deployment ID or `/dev` URL.
This limited prototype scope supersedes earlier new-project requirements for
this exercise; it does not close customer security findings or certify Preview
isolation. Read the six earlier reports linked from
[the checklist](SECURITY_PRODUCTION_CHECKLIST.md) as historical evidence.

Phase 3 fixes are committed locally as **`f0d354a`**: stored challenge freshness,
capability version forwarding, regressions, regenerated backend and acceptance
report. Main was rechecked read-only and remains
`89472587fa592ad96aaecd8807366d5f65ddea60`; no remote release occurred.
Phase 4 adds compatible dependency maintenance, legacy-contract/session-upgrade
tests, an optional editor-only head test and these operating instructions.

Installer: [backend/generated/FitZone_Complete.gs](../backend/generated/FitZone_Complete.gs).
Current file SHA-256:

```text
5cbcc8b84b9621b61bd45081d9e02c7002ae6d8e134570a9578d3ae9440ed048
```

This identifies the current installer, not a Google deployed version. Record the
final reviewed Git SHA and Google version privately before any later release.
The four pre-existing untracked drafts/logs remain untouched. Private local
environment settings/branding were preserved; no endpoint value is committed.

## Verification actually completed

Node 24.16.0, npm 11.9.0, locked Vite 7.3.7 / Playwright 1.62.1. All automated
membership/authentication tests use fictional service doubles; browser tests
intercept Google requests. None proves cloud ACLs, live concurrency or recovery.

| Check actually executed | Result / exact scope |
| --- | --- |
| Phase 3 targeted regressions + `check:backend` before commit | PASS, exit 0; three regressions and fresh installer |
| Compatible update attempt | `npm update braces postcss-nested postcss-selector-parser --package-lock-only --ignore-scripts`: exit 0; only parser 6.1.4 → 6.1.5 changed |
| Clean `npm ci` after lock change | PASS, exit 0; 272 added, 273 audited |
| `npm test` | PASS, exit 0; **206 source + 206 bundle = 412 executions**, zero failures/skips; four new compatibility/head scenarios |
| `FITZONE_TEST_BACKEND=bundle; npm run test:browser` | PASS, exit 0; **26 tests**, zero failures/skips; Chromium synthetic browser flows |
| Exact baseline frontend API module against current source and bundle | PASS twice; `git show 8947258:src/api/gymApi.ts`, transpiled unchanged in a VM, exercises login/lookup/list/add/edit/renew/delete/logout against synthetic services |
| `node --test tests/prototype-compatibility.test.mjs` in source and bundle modes | PASS, four each; also asserts head helper is absent from installer |
| `npm run check:backend` | PASS, exit 0; deterministic Bcrypt/Auth/Code installer, syntax/globals/vendor integrity covered |
| `npm run typecheck`; `npm run lint` | PASS, exit 0 each, including identity server/API |
| `npm run build` | PASS, exit 0; 1,719 modules, process-only synthetic `/exec` setting with `VERCEL_ENV=production`; no deployment |
| `npm run check:security` | PASS, exit 0; targeted guard over 20 modules and backend parsing, not full SAST |
| `npm run check:docs`; `git diff --check` | PASS, exit 0; final documentation links and diff hygiene |
| `npm run scan:secrets` after explicitly staging Phase 4 files | PASS, exit 0; Gitleaks 8.30.1, zero current/history findings; unrelated untracked/ignored files excluded |
| `npm audit --omit=dev --audit-level=low` | PASS, exit 0; zero runtime advisories |
| Final full `npm audit --json` | **FAIL, exit 1: nine development entries (7 High, 2 Moderate)**; details below |
| Preview negative build probe | Expected Vite failure, child exit 1; incomplete Preview variables remain rejected. This is not Preview acceptance |
| `node scripts/prepare-security-analysis.mjs` and synthetic ZIP coverage fixtures | PASS for mirror preparation and exact/missing-source gate tests; **not CodeQL execution** |
| Public fake-data lookup | PASS: one ID `1` GET returned HTTP 200 / application success and only `daysRemaining,endDate,id,membershipType,name,status`, with pseudonymous name; local endpoint matched the deployed frontend in memory; values withheld |
| Read-only GitHub metadata | Main still unprotected, required contexts empty, rulesets empty; zero runs for this security branch |

No full audit failure was hidden. An initial `npm audit fix --dry-run --json`
inspection could not be parsed because npm prefixed JSON with a human-readable
change line (wrapper exit 1). The explicit compatible update and fresh audits
above then succeeded in recording the real result. No force upgrade, suppression
or major-version override was applied. The 6.1.5 patch is compatible/tested but
**does not fix** the selector advisory. No package.json ranges changed.

CodeQL, Semgrep, Trivy and ZAP were not run locally. CodeQL's actual extraction
and deployed header/function runtime verification remain open. The live lookup
tests the currently published backend, not the newly saved/released installer.
The optional head helper has passed only locally; the owner has not run it on
Google during this phase. Google login/password, CRUD, formatting, disabled-mail
state and rollback still require the live checklist below.

### Development advisory disposition

| Affected entry | npm severity | Chain / disposition |
| --- | --- | --- |
| braces | High | Root recursion advisory; no compatible patched resolution selected |
| chokidar | High | Through braces |
| micromatch | High | Through braces |
| fast-glob | High | Through micromatch |
| globby | High | Through fast-glob |
| gh-pages | High | Through globby; retained publishing tooling, not a runtime dependency |
| tailwindcss | High | CSS build chain aggregates these advisories |
| postcss-selector-parser | Moderate | Root CPU-exhaustion advisory; 6.1.5 remains below fixed 7.1.6 |
| postcss-nested | Moderate | Through selector parser |

These are nine affected entries from two advisories, not nine distinct runtime
exploits: [braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) and
[selector parser](https://github.com/advisories/GHSA-rj75-hqrm-r3gf).
Suggested forced remediation includes Tailwind 4 and a publisher version outside
the declared range. Those require a separately tested migration. Continue only
with trusted repository-controlled patterns/CSS/build inputs. Proposed triage
owner: repository maintainer; review by **27 October 2026**, or before adding
untrusted build input. This is a proposed time-boxed demo exception requiring
owner acceptance before public release, not an approved customer exception.

## Compatibility and inactive features

| Contract | Confirmed behavior / risk |
| --- | --- |
| Existing frontend → new backend | Exact baseline API module passes source/bundle synthetic CRUD and auth flows; extra `securityPolicy` is harmless to the old client |
| Legacy client omissions | Updates/renewals/deletes without operation IDs/versions still work with history off; stale supplied versions remain rejected |
| Upgrade sessions | New credential fingerprint differs from baseline even with unchanged password. Untouched old sessions fail closed; owner must sign in again. Do not copy/translate old sessions |
| Stable storage | A:I and four plans unchanged; calendar dates/phone formatting, paid-term rules, locks and persistent counters covered in regressions |
| Legacy retries/deletion | History off means no server mutation deduplication or recoverable archive. Do not repeat ambiguous writes; inspect first. Physical deletion is allowed only for the marked fictional test rows |
| Public lookup | Existing numeric lookup stays available with minimal DTO and shared budget. Enumeration/targeted budget exhaustion remain demo risks |
| Build and runtime | `/exec` only; browser and build reject `/dev`. Vite's build does not certify Vercel function packaging or live Google redirects |

Keep these values unchanged/inactive unless an already-active policy is reviewed
separately. Do not weaken an existing security policy to run the helper:

| Setting | Prototype release requirement |
| --- | --- |
| GAS `OWNER_AUTH_MODE` | Unset or `legacy`; never select `managed` |
| GAS `MEMBER_LOOKUP_MODE` and frontend `VITE_MEMBER_LOOKUP_MODE` | Unset or `legacy`; never select `capability` |
| GAS `MEMBER_HISTORY_ENABLED` | Unset or `false`; do not create a false backup attestation |
| GAS `OWNER_STEP_UP_REQUIRED` | Leave unset/false for the baseline compatibility/head helper. If already true, stop and use a separately reviewed confirmation-aware test; do not disable it silently |
| GAS `EXPIRY_EMAIL_ENABLED` | Owner sets exact `false` for all live checks; shared setting, effective immediately |
| Vercel `OWNER_IDENTITY_ENABLED` | Leave unset/false; no provider integration/enrollment/recovery completed |

Managed MFA still needs a selected provider, real assurance semantics,
issuer/audience/owner and per-gym keys, reviewed SDK/PKCE/nonce sign-in and
confirmation UI, enrollment, recovery, revocation and key-rotation tests.
Capabilities still need approved owner issue/revoke/recovery UI and private
member-code distribution. History still needs independent backup/restore,
archive controls and real partial-failure recovery. None is activated here.

## Existing-project head/test procedure — owner account actions

### Capture rollback state first

1. Open the **existing** Sheet and Apps Script project from your own bookmarks.
   Privately confirm the intended project, A:I tab, deployment identity/access,
   editors and manifest/scopes. Do not paste identifiers or properties into chat.
2. Record the current public deployment's selected version, description and URL
   privately. Save the current editor source and manifest, and identify the
   known authentication-gated rollback code/version. Do not assume an earlier
   version is safe merely because it exists.
3. Freeze other demo users/manual edits for the window. Make a private manual
   copy of the fictional Sheet preserving values, types, dates and number
   formats, and record its timezone. Preserve the member ID high-water mark and
   per-member expiry journals/Notified state privately. Do not export all Script
   Properties to logs or restore sessions later. A same-account copy is a demo
   rollback aid, **not an independent backup**.
4. Set `EXPIRY_EMAIL_ENABLED=false` privately. Record existing trigger settings;
   do not create/run a real sender. Inspect that no other legacy trigger/helper
   bypasses the email switch. Leave mail off until separately approved.

**Shared-state limit:** saving head code does not switch the versioned web app,
but the Sheet and Script Properties are shared; editor runs and triggers can
affect them immediately. Do not treat head as isolated staging. Google documents
[script-scoped shared properties](https://developers.google.com/apps-script/guides/properties).

### Save and test head without updating the public deployment

1. Run `npm run check:backend`. In the existing editor, install the entire
   generated bundle as one runtime file. Preserve `appsscript.json`; after the
   private source capture, remove duplicate old Bcrypt/Auth/Code runtime files
   if replacing the three-file installation. Do not delete unrelated files
   without inspecting their functions/trigger references.
2. Save. **Do not edit the versioned public deployment yet.** Use **Deploy →
   Test deployments → Web app**, then open the copied test URL signed into the
   Google account that can edit the project. `/dev` serves saved head and is
   editor-only. Test one known fictional numeric lookup in that tab. Do not put
   `/dev` in Vite, localStorage, Vercel or the public URL setting. See
   [Google's web-app test procedure](https://developers.google.com/apps-script/guides/web).
3. For bounded editor-side integration, create a temporary `.gs` file using
   [PrototypeHeadChecks.gs](../backend/testing/PrototypeHeadChecks.gs). This is
   explicitly excluded from the generated installer. Privately set
   `FITZONE_PROTOTYPE_HEAD_TEST=fictional-data-only` **only after confirming this
   project's records are fictional**. This attests no environment isolation and
   is unrelated to the forbidden Preview attestation.
4. Select `runPrototypeHeadChecks` in the editor and click **Run** once. Review
   requested Google scopes privately; stop on unexpected permissions. It checks
   unauthorized read rejection, temporary owner-session reads, marked-row
   create/edit/renew/delete, minimal lookup, calendar/phone values, non-reused
   IDs, trigger-event disabled-mail behavior and logout. It creates at most two
   marked rows and attempts cleanup using their captured IDs and marker. Only
   PASS/count is deliberately logged; do not copy private execution details.
5. Inspect the actual Sheet: original fictional rows untouched, marker rows
   removed, A:I preserved, leading-zero phone/text and date formats appropriate,
   high-water mark advanced rather than rolled back. The helper's temporary
   session must be gone. Any failure/ambiguous write or cleanup error means
   **stop, inspect and reconcile; do not repeatedly rerun**. It is not atomic
   and cannot undo manual edits or guarantee cleanup after every outage.
6. The helper uses the trusted editor's authority to issue a temporary session;
   it **does not verify the owner password or HTTP POST/CORS transport**. Those
   remain explicit checks against the public endpoint/local frontend after
   release approval. Do not count editor success as a complete end-to-end pass.
7. Remove the temporary head-test file and `FITZONE_PROTOTYPE_HEAD_TEST` property.
   Save the exact installer-only runtime, keep migrations off/mail off, and run
   `previewSyntheticExpiryNotifications` if desired. Never run the normal mail
   function with email enabled. Record only version/check outcomes, no data or
   credentials. No new daily trigger is part of this release.

## Local live-integration checklist — existing public `/exec`

This is a **manual acceptance checklist, not a claim these checks ran on the
new backend**. Current code changes on Google and authenticated tests require
the owner's account actions. Use only the existing fake dataset and dedicated
marked test records; never reuse another row for destructive tests. Allow one
operator, no parallel loops, a maximum of 40 backend actions in one controlled
pass and a 15-minute work window; test the 30-minute expiry separately. Stop on
unexpected destination/data, mail enabled, quota/throttle/busy errors, duplicate
IDs or ambiguous writes. No stress/brute-force testing.

Run the reviewed local frontend with `npm run dev`. Existing ignored local
configuration already matches the published backend; keep its `/exec` URL and
branding unchanged. Open the localhost URL Vite prints. Do not use
`VITE_MEMBER_LOOKUP_MODE=capability`, a fake `VERCEL_ENV`, or Preview attestation
to bypass controls. Enter the owner password only in the normal password field;
do not use console variables, command arguments, saved HAR/traces or screenshots
containing credentials/tokens/records.

| Manual check | Expected result | Actual Phase 4 live status |
| --- | --- | --- |
| Target/version | Same existing `/exec` URL; operator verifies selected Google version/code separately | Destination match verified; new version NOT deployed |
| Public known ID `1` | Membership facts/pseudonym only, no name/contact/age/weight leak | PASS once on existing public version |
| Unknown ID + GET admin action | Normal failure, no member/private data | PENDING on new version; local regressions pass |
| Absent/fake session POST | `UNAUTHORIZED` before owner read/write; no row changes. Submit only bounded non-mutating getAll negatives through a private reviewed HTTP client; no cookie/token capture | PENDING live; local pass |
| Login | One wrong valid-shaped password fails generically, then correct login works. Never exhaust the shared five-attempt budget | PENDING live; synthetic bcrypt/auth tests pass |
| Session lifecycle | Refresh requires login (memory-only); logout clears access; wait 30 minutes to check absolute expiry without changing system/property clocks | PENDING live; local pass |
| Add/list/four plans | Create marked fictional rows; correct dates, plans and fresh persistent IDs; nine columns only | PENDING live; all four plans local pass |
| Edit/CAS | Contact-only edit preserves end/Notified; supplied stale version rejected after one controlled edit; no blind retry | PENDING live; local pass |
| Renew | One overlap rejected; valid next-day/future renewal preserves paid time and returns new end date | PENDING live; local pass |
| Delete/IDs | Delete only marked test rows; next create ID exceeds previous/deleted high-water mark | PENDING live; local pass |
| Formatting | Leading-zero phone remains text; date cells stay real dates with expected display; existing rows/formats untouched | PENDING live; local plus editor-helper assertions pass in doubles |
| Notifications | Operator verifies switch false, then disabled sender/trigger-event check returns disabled/zero; pure synthetic preview sends nothing. No sent mail or journal reset | PENDING Google; local pass |
| Browser | Mobile/desktop, lookup/login/logout, keyboard/dialogs, search/filter/pagination and recoverable errors; WhatsApp preparation only, no Send | PENDING live; 26 intercepted browser tests pass |
| Headers/functions | Check actual Vercel HTML and static-asset response headers/framing after frontend release; managed API remains disabled | NOT VERIFIED deployed |

Use a known nonexistent ID selected after inspecting the fake fixture; do not
enumerate ranges. Keep evidence to outcome codes, test-marker IDs if needed,
version/SHA and timings. If a new test record's add response is lost, inspect
Sheet/list first; history-off mode cannot guarantee idempotent retry. Clean only
your marked records and retain ID high-water state. Keep email disabled.

## GitHub security branch, CodeQL and Preview

No push was performed. Read-only metadata still shows unprotected main, no
rulesets/required contexts, and zero security-branch runs. Account MFA does not
enforce review/checks. Actual CodeQL execution, source extraction and security
results are **UNVERIFIED**.

For a later authorized CI-only branch push:

1. Review the final commit/diff and tracked secret scan. An owner can push only
   `security/hardening-phase2` and open a draft PR against main; do not push main
   or enable auto-merge. This is a future step, not performed by these commands.
2. Security checks runs on this branch push/PR. Application checks runs on PRs
   and main, so open the draft PR to obtain its `verify` job. Select the reviewed
   SHA; a green run for a different SHA is insufficient. Manual dispatch of a
   newly introduced workflow may not be available until it exists on default.
3. Inspect `runtime-dependencies`, `secrets` and `codeql`. CodeQL must prepare the
   exact Auth/Code JavaScript mirrors, initialize JS/TS with the checked-in
   config, analyze, then complete **both** extraction and SARIF result gates.
   Confirm `Verified extracted backend mirrors: backend/Auth.gs, backend/Code.gs`
   and zero actionable findings, plus application/API/server/script scope in
   analysis/tool status. Missing source ZIP/database output or failed upload is
   a failed gate, not permission to remove the assertions. Native `.gs` support
   and bcrypt scanner coverage are not assumed; vendor integrity tests remain.
4. Review code scanning alerts/logs. If default setup conflicts with the custom
   workflow, an administrator must configure advanced setup deliberately,
   without generating/committing another workflow to main automatically. See
   [GitHub's advanced setup guidance](https://docs.github.com/en/code-security/how-tos/find-and-fix-code-vulnerabilities/configure-code-scanning/configuring-advanced-setup-for-code-scanning).
5. Configure the agreed main review/ruleset/check policy using **actual emitted
   check names** and a workable maintainer/reviewer/recovery model. No force
   merge/direct main push or claim of enforcement from workflow YAML alone.

**Preview remains unverified and not approved.** The intentionally shared
fake-data backend is not an isolated Preview resource. Do not set
`FITZONE_PREVIEW_SYNTHETIC=1`, invent a production fingerprint or replace the
guard. An automatic Vercel Preview build may fail at the guard after a branch
push; record that as expected protection, not a failed security CI test or a
successful Preview. Do not test credentials there. An administrator may choose
to suppress automatic previews for this branch using supported project settings;
no such account setting was changed. Decide the demo release's check policy
explicitly before merging; do not bypass an enforced required failing check.

## Backend first, frontend second — future exact approval required

1. Complete the head procedure and record its outcome, fake-Sheet rollback
   capture, previous Google version and previous Vercel deployment privately.
   Obtain the real CI evidence above and explicit owner acceptance of the
   time-boxed demo risks. Verify mail/migrations remain off. The optional head
   helper/test property must have been removed.
2. **STOP for approval identifying the exact Git SHA, installer hash, existing
   deployment, rollback targets and unchanged URL.** Preparing instructions or
   receiving the fake-data statement does not approve this public release.
3. After that approval, the owner opens **Deploy → Manage deployments**, selects
   the **existing public Web app**, clicks **Edit**, selects **New version**,
   records a release description/SHA and clicks **Deploy**. Preserve its intended
   execution/access settings. Do not select New deployment or replace the URL.
   Google documents that editing the existing deployment's version preserves
   its [URL/deployment identity](https://developers.google.com/apps-script/concepts/deployments).
4. Verify the same public URL and selected version. Keep the existing frontend
   initially; sign in again and run the bounded public integration checklist.
   The old frontend/new backend pairing is locally compatible. Stop on failures
   and use reviewed rollback; do not publish frontend to conceal a backend error.
5. Only after backend acceptance and separate frontend release approval, merge
   the reviewed PR through the agreed controls. Main is linked to Vercel's public
   environment, so a merge may publish frontend automatically: confirm release
   timing/check behavior beforehand. Keep its existing Production endpoint
   value unchanged and migrations off; never use Preview variables as a shortcut.
6. Verify the actual Vercel deployment SHA, existing domain, unchanged backend
   destination, login/lookup/CRUD/browser behavior and effective header values.
   Inspect CSP Report-Only violations for branding; no false header pass from
   reading `vercel.json`. Keep managed verifier disabled. No public deployment
   or promotion is authorized/performed in this phase.

## Rollback — four independent state layers

Stop demo writes/manual edits, leave mail off, record the incident and capture
current fake-state/counter before restoring anything. Neither code rollback
restores Sheet/Properties state nor Sheet restoration revokes authentication.

### Backend code and editor head

Privately identify the recorded last approved authentication-gated Google
version. **Manage deployments → existing Web app → Edit → select that recorded
version → Deploy**, preserving the URL and intended access identity. Check
unauthorized reads/writes fail and owner re-login works. Do not choose a guessed
version or historical unauthenticated backend. Baseline versions may reintroduce
the documented malformed-login lockout; review that tradeoff for a demo-only
incident and prefer a tested forward fix. If no acceptable rollback version is
verified, stop public use and obtain an approved repair; do not disable auth.

Separately restore editor head from its captured reviewed sources if necessary;
otherwise editor executions/triggers can keep running the faulty saved code.
Do not create a new URL, erase private config/counters or restore test helpers.
Actual version/permissions/rollback drill are still owner actions, not verified.

### Frontend

Prefer retaining the newly secured backend and rolling frontend back to the
recorded compatible previous Vercel production deployment. In the project,
choose **Instant Rollback**, verify deployment SHA/domains/config, and confirm
only after authorization. Availability depends on plan/eligible deployments;
capture an eligible target first. The old build's environment values are reused;
check the endpoint remains correct. After rollback, automatic domain assignment
stays off until an approved promotion/undo. See
[Vercel's rollback procedure](https://vercel.com/docs/instant-rollback).
Never promote an unverified Preview as a rollback substitute. Keep Git source
aligned with the chosen fix via a later reviewed PR, not a force reset of main.

### Sheet and notification state

Use the privately captured same-account fictional Sheet copy solely as a demo
rollback source, preserving A:I values/types/number formats and dates/timezone
in the **existing configured Sheet**. Do not point the app at a replacement
Sheet/URL. Inspect post-snapshot changes before restoring; do not overwrite
legitimate concurrent work. High-water mark must be at least the maximum of
pre-window, current and every ID issued during the window, including deleted
ones; never derive it only from current rows or lower it to the old snapshot.
Reconcile Notified/expiry journals and Sent mail before any future mail enablement;
do not clear journals to make a test pass. Do not bulk-restore Script Properties.
If any real customer data appears, stop this procedure; this demo authorization
does not cover destructive customer recovery.

### Credentials and sessions

Do not restore old session records, step-up proofs, challenges or member codes.
The current credential-version scheme is deterministic, so code/config rollback
alone can revive untouched older records. Before reopening after backend/config
rollback, the authorized editor must invalidate authorities under ScriptLock.
This optional maintenance snippet is run privately, **not an HTTP route**:

```javascript
function revokePrototypeSessionsForMaintenance() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error('Busy; stop maintenance.');
  try {
    const properties = PropertiesService.getScriptProperties();
    Object.keys(properties.getProperties()).forEach(function (key) {
      if (key.indexOf('OWNER_SESSION_') === 0 ||
          key.indexOf('OWNER_STEPUP_') === 0 || key === 'OWNER_IDENTITY_CHALLENGES') {
        properties.deleteProperty(key);
      }
    });
  } finally { lock.releaseLock(); }
}
```

Preserve owner ID/verifier, identity keys/config, counters and notification state;
never use `deleteAllProperties`. Close/reload browser sessions and sign in afresh.
If credentials are actually compromised, use a separately approved private
rotation/recovery process, then revoke again; do not reinstate a compromised
password/verifier for convenience. No credential rotation occurred here.

## Separate decisions and required owner actions

| Decision | Status now |
| --- | --- |
| Local demo-only verification / controlled existing-project head test | **GO** within the fictional-data, disabled-mail, migration-off procedure; local work complete |
| Public fake-data prototype release | **NO-GO until** owner-run head/remaining live checks, real security CI, recorded rollback targets, advisory exception and exact backend/frontend approvals; this is pending acceptance, not a demand for a new project |
| Vercel Preview | **UNVERIFIED / NOT APPROVED**; guard unchanged, no isolation attestation |
| Real paying customers | **NO-GO**; independent encrypted backups/restore, application MFA/provider/recovery, privacy/distribution, release enforcement, protected logging, Google ACL/version and deployed header/runtime controls remain incomplete or unverified |

**Your account-access steps:** capture the current Google version/source/Sheet
rollback state, verify scopes/sharing/triggers and mail off, install/test head in
the existing project, remove the optional helper, then authorize a CI-only branch
push/draft PR when ready. Inspect actual CodeQL/check results and configure the
release controls. Finally approve the exact public backend-first/frontend-second
release before editing the existing deployment or merging main. No new Apps
Script project, public URL replacement, independent-backup claim or Preview
guard exception is required for these local/demo steps.
