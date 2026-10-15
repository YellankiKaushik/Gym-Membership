# PR #1 authentication review and staging verification

Date: 2026-10-14 (Asia/Kolkata). Reviewed starting head: `d298f8b`.
Architecture and nine-column layout are preserved. This document is a procedure
and evidence record, not a claim that the Google deployment was tested.

## Decision and evidence boundary

**NO-GO for merging as a staging-validated release.** The introduced auth race and
timeout defects below are fixed and regression-tested locally. Google runtime,
ContentService/CORS, real bcrypt timings, and real Sheet CRUD remain NOT RUN.
The browser reached Google's public Apps Script landing page rather than an
authenticated project dashboard. No staging endpoint or temporary credentials
were supplied; no clasp executable, local `.clasp.json`, or standard user
`.clasprc.json` was available. No Google project was created or deployed.

## Task 04: explicit spreadsheet selection (2026-10-14)

The active-Sheet blocker is corrected in source. Every member lookup, listing,
create/edit/renew/delete operation and expiry check now calls `getMemberSheet_()`.
It reads `SPREADSHEET_ID` and `MEMBER_SHEET_NAME` from Script Properties, uses
`SpreadsheetApp.openById(id).getSheetByName(name)`, and never falls back to an
active spreadsheet/tab. Names such as `Sheet1`, `Members`, or `Gym Members 2026`
are supported. Both settings are required; the tab name is used exactly as entered.

Missing/blank/malformed ID, inaccessible/wrong ID, absent tab setting, and missing
tab fail closed. HTTP handlers return `success:false`, code
`MEMBER_SHEET_UNAVAILABLE`, and a generic configuration/access message. No Sheet
ID, tab name, Google exception, credential, or member data is echoed. Editor/trigger
invocations throw the controlled `MEMBER_SHEET_UNAVAILABLE` error before any row
write or email. Login/logout remain independent of Sheet availability; a successful
login alone does not prove Sheet access. Unauthorized requests never open a book.

The mock now rejects active APIs and uses a fixed synthetic workbook/tab independent
of configured values. Tests cover incorrect configuration, three tab names, all
seven Sheet operations, and nine-column preservation. These are local regressions,
not real Google runtime verification. An in-memory replay of the previous committed
handlers also confirmed lookup/list fail without active APIs, while the corrected
handlers pass. A source comparison confirmed read/CRUD/ID/date/email function bodies
differ only in the Sheet accessor and its whitespace; Auth.gs, Bcrypt.gs and frontend
source are unchanged. Real staging below remains **NOT RUN**.

Google references:

- https://developers.google.com/apps-script/guides/bound#special_methods
- https://developers.google.com/apps-script/reference/spreadsheet/spreadsheet-app#openById(String)
- https://developers.google.com/apps-script/reference/spreadsheet/spreadsheet#getSheetByName(String)

## Confirmed introduced defects and corrections

### AUTH-R1: Pending login could undo logout or replace a newer login (P1 High)

Starting `src/api/gymApi.ts` lines 108–122 persisted any successful login response
when the endpoint still matched. There was no request generation/cancellation check.
A delayed login could restore a session after logout, overwrite a newer session,
or survive an endpoint change away and back. Three new tests failed on the old code.

Correction: an authentication revision cancels obsolete requests. Late returned
tokens are revoked best-effort at their original endpoint without clearing a newer
session. `Adminpanel.tsx` also ignores outdated login and logout UI updates and
invalidates pending UI work on unmount. Cleanup failures or a permanently lost
login response can leave an unclaimed token valid until its 30-minute expiry.

### AUTH-R2: Timeout ended before response JSON was consumed (P2 Medium)

Starting API lines 54–75 cleared the AbortController timer as soon as fetch returned
response headers. `response.json()` could remain pending indefinitely. A new test
confirmed no timer remained while its synthetic response body was waiting.

Correction: HTTP checking and JSON reading are inside the same timed operation.
The regression test aborts a waiting JSON body and verifies the timeout message
and timer cleanup. Mutations are still not automatically retried.

## Other review conclusions

- Owner configuration fails closed for missing/empty/invalid IDs or bcrypt hashes;
  accepted bcrypt cost is bounded to 12–14 and UTF-8 truncation is rejected.
- Login returns only success/token/expiry, not the member database. All five admin
  actions validate a server session. GET cannot dispatch admin actions.
- Tokens use two Google platform UUIDs, are stored server-side only through SHA-256
  keys, expire after 30 minutes, and are revoked by logout/credential rotation.
- The five-failure/15-minute limiter serializes checks under ScriptLock. Real lock
  contention and performance have not been measured. An attacker can temporarily
  deny logins; this is basic installation-wide throttling, not network protection.
- Browser storage holds bearer sessions, not permanent passwords. XSS/shared-device
  compromise remains a risk. Endpoint changes invalidate local state; they do not
  automatically revoke every previously issued server session.
- Public lookup's approved keys are `id`, `name`, masked `phone`, `membershipType`,
  `startDate`, `endDate`, `status`, `daysRemaining`. Age/weight and admin fields are
  absent. Predictable IDs and full member names remain a privacy consideration.
- Bcrypt's unchanged upstream payload and timer adapter load in a mock GAS-like VM
  without Node, Web Crypto, or timers, in all six file orders. This is NOT real GAS.
- The real vendor hash is checked against the integrity-verified upstream file.
- Sheet selection alone was corrected in Task 04; date/ID/email eligibility and
  column I semantics are unchanged. No production configuration,
  Sheet, email, deployment, or merge was performed.

## Repeatable isolated staging setup (manual, not executed here)

1. Sign into an authorized **test** Google account/profile. Create a new disposable
   spreadsheet named `FitZone AUTH STAGING ONLY`. Do not copy real member rows,
   production Script Properties, existing deployments, or production email triggers.
2. Keep its actual member tab name (`Sheet1` is valid), or rename it `Members`.
   Copy that exact name privately for configuration. Set columns A and C to Plain text before importing
   `staging/members.tsv`, preserving `001`/`002` and the all-zero synthetic phones.
   There must be exactly nine columns: ID, Name, Phone, Age, Weight, Membership Type,
   Start Date, End Date, Notified. Column I is Boolean FALSE. Use date values/formats
   for G/H, and Asia/Kolkata for the spreadsheet timezone. Dates may be adjusted to
   the test run; do not infer an expected Active status from an old fixed fixture.
3. From this disposable Sheet only, open Extensions > Apps Script. Confirm the
   parent Sheet is the disposable one. Copy the reviewed `Code.gs`, `Auth.gs`, and
   `Bcrypt.gs` into that new project without changing their implementations. Remove
   only the new project's empty starter code to avoid duplicate function names.
4. Show `appsscript.json` in Project Settings and verify V8 and `Asia/Kolkata`.
   Keep test-only project scopes; do not import a production manifest containing
   private IDs or libraries blindly. `openById` requires the Sheets OAuth scope
   `https://www.googleapis.com/auth/spreadsheets`, not only `spreadsheets.currentonly`.
   If explicit `oauthScopes` already exist, allow this scope in the test manifest;
   otherwise let Apps Script infer scopes. Authorize as the test account with access
   to the disposable Sheet. Do not add a trigger. Leave `ADMIN_EMAIL`
   unset, and never run `checkMembershipExpiries`, even with `testMode=true` (the
   uploaded function can still send email in test mode).
5. Run `node scripts/create-owner-config.mjs` in a private local terminal. Choose
   a disposable unique Owner ID and a temporary 12+ character password. Configure
   these properties in this test project's Project Settings > Script Properties:

   | Property | Test-only value |
   |---|---|
   | `OWNER_ID` | Generated temporary, case-sensitive Owner ID |
   | `OWNER_PASSWORD_HASH` | Complete generated bcrypt verifier |
   | `SPREADSHEET_ID` | Disposable spreadsheet ID, without a URL or surrounding spaces |
   | `MEMBER_SHEET_NAME` | Exact actual member tab name, e.g. `Sheet1` or `Members` |

   Obtain the Sheet ID from its browser URL:
   `https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit#gid=...`.
   Copy only the segment between `/d/` and `/edit`; `gid` is a tab number and is
   **not** the spreadsheet ID. Do not use a Script ID or deployment ID. No real
   identifier should be added to source, documentation, Git, or screenshots.

   Keep the temporary password in a private manager; do not put it in code, Git,
   command arguments, screenshots, CI variables, or this results document.
6. For optional editor diagnostics, add `staging/RuntimeChecks.gs` to this **test
   project only**. Set `STAGING_ONLY=true` and `STAGING_SHEET_ID` to the disposable
   Sheet ID privately. This helper has no API route, never writes member rows, and
   never sends email. Run `checkStagingFiles` from the editor: all six booleans must
   be true. `STAGING_SHEET_ID` must match `SPREADSHEET_ID`; selection uses the same
   helper as the web app, not the editor's active tab. Editor success still does
   not prove the deployed version, execution identity, redirects, or browser CORS.
7. In the test project, create a separate Web app deployment executing as the test
   owner and accessible to Anyone if that account's policy permits it. Confirm the
   project/Sheet are disposable before authorization. Do not update an existing
   deployment. Record its version and `/exec` URL privately; never use `/dev` for
   acceptance testing. If anonymous access is prohibited, record BLOCKED rather
   than weakening account policy or falling back to production.
8. Isolate the frontend by using a new browser profile/private window and a new
   loopback origin. From the feature branch run:

   ```powershell
   npm ci
   npm test
   npm run typecheck
   npm run lint
   npm run build
   npm run preview -- --host 127.0.0.1 --port 4187 --strictPort
   ```

   Open `http://127.0.0.1:4187/Gym-Membership/` and configure only the test `/exec`
   endpoint. A separate port/profile avoids replacing production localStorage.
9. Verify login and then **getAll through /exec**, not just an editor function.
   Expect exactly the synthetic rows from the configured tab. Select another blank
   tab in the editor (or close the Sheet) and repeat lookup/list/CRUD: the selected
   member tab must remain the target. If listing cannot resolve the Sheet, record
   FAIL/BLOCKED and the sanitized error; stop dependent CRUD checks. Verify private
   properties, test account sharing, OAuth scope, and the deployed source version.
   Never substitute an active-Sheet fallback.
10. On this disposable project only, temporarily remove `SPREADSHEET_ID`, then
    restore it and try a nonexistent ID, then a nonexistent `MEMBER_SHEET_NAME`.
    For each case, login may still succeed but lookup and authorized getAll must
    return `MEMBER_SHEET_UNAVAILABLE` without identifying details; no Sheet rows
    change. Restore valid settings. A protected request without a token must still
    return `UNAUTHORIZED`. Do not run an expiry check or trigger for this test.
11. Execute browser matrix rows 1�16 below through the test `/exec` endpoint,
    including synthetic add/edit/renew/delete. Confirm A:I after each change,
    I=false after add/edit/renew, and no tenth column. Record only sanitized
    status/code, row counts, timings, commit/version, viewport and pass/fail.
    Do not export request bodies, session records, private endpoints or HAR files.

## Real bcrypt and concurrency benchmark (manual; NOT RUN)

With all three files loaded in the disposable project, optionally run the staging
helper. Set `STAGING_BENCHMARK_PASSWORD` privately to the temporary test password,
then execute `benchmarkStagingAuthentication` in the Apps Script editor. It runs
five real `loginOwner_` calls, validates/revokes each resulting session, and emits
only cost, sample count, first/min/median/max milliseconds. It deletes the temporary
password property in `finally`. Confirm its removal even after an interrupted run.
Never log requests, response tokens, verifiers, or configuration values.

Record real editor timings separately from browser total login/redirect latency.
Mock helper timings use a frozen clock and are not measurements. Suggested initial
acceptance targets (not measured facts): cost-12 median server login <= 2 seconds,
maximum <= 5 seconds, and normal single-browser end-to-end login < 10 seconds, with
no 20-second client timeouts. If these fail, retain the measured evidence; do not
lower bcrypt strength automatically.

From two/three private staging browser contexts, submit three concurrent correct
logins. Record success/AUTH_BUSY counts and Network panel durations without saving
password/token bodies. No errors should expose secrets or hang indefinitely.
ScriptLock can wait up to 5 seconds, so higher cost/concurrency may cause AUTH_BUSY.
Run the five-wrong-login throttle test **last**, since it intentionally blocks new
logins for up to 15 minutes. Existing sessions should continue working. Do not
fabricate parallelism by counting sequential editor calls as concurrent requests.

## Browser acceptance matrix (real Google staging: all NOT RUN)

Run at 1366x900 and a real effective 375x812 CSS viewport; record actual
`document.documentElement.clientWidth`, not just the requested override. Use
mobile emulation for this task; a physical phone cannot reach laptop loopback.
Open browser DevTools Network with Preserve log. Inspect locally without exporting
an unredacted HAR: request/response bodies contain temporary passwords/bearer tokens.

| # | Case / exact action | Expected result | Actual Google staging |
|---|---|---|---|
| 1 | Submit correct temporary ID/password | Login success; dashboard/list request follows | NOT RUN |
| 2 | Try wrong ID, then wrong password, fewer than five attempts before valid login | Same generic rejection; no member read | NOT RUN |
| 3 | Inspect only the login response | success, sessionToken, expiresAt; no members, verifier, password | NOT RUN |
| 4 | Refresh authorized member list | Only the two synthetic fixture rows, from the intended Sheet | NOT RUN |
| 5 | Add STAGING ONLY Gamma with phone 0000000002, valid age/weight/plan/start | One new nine-cell row; I=false; no email | NOT RUN |
| 6 | Edit Gamma's name | Same ID; only expected row changes | NOT RUN |
| 7 | Renew Gamma | F/G/H updated, I=false; note existing undefined-end-date toast mismatch | NOT RUN |
| 8 | Delete Gamma after noting ID | Only disposable Gamma row removed | NOT RUN |
| 9 | POST each protected action without token and with a fabricated 64-hex token; GET getAll | All denied; Sheet values/row count unchanged | NOT RUN |
| 10 | Capture token privately, click Logout, then replay a protected POST with that token | UNAUTHORIZED; browser has no session or member list | NOT RUN |
| 11 | Keep a staging token privately, wait 31 minutes, then POST getAll with it | Server UNAUTHORIZED regardless of browser storage/activity | NOT RUN |
| 12 | Inspect login/list redirect chain from the local frontend | Browser follows ContentService redirect and reads JSON without CORS errors | NOT RUN |
| 13 | Lookup 001 while signed out | Approved keys only; phone XXXXXX0000; no age/weight/admin fields | NOT RUN |
| 14 | Inspect initial and redirected request URLs for every action | No submitted password or sessionToken in any URL | NOT RUN |
| 15 | In an isolated frontend, change endpoint through setApiUrl/reset setup | Local session invalidated; no token sent to the other endpoint | NOT RUN |
| 16 | Disable network, attempt login/logout, then restore network | Network/timeout error; no invalid-password mislabel; local logout clears data | NOT RUN |

For direct probes, use DevTools in the isolated frontend only. Read the configured
test endpoint and session into private variables without printing them:

```javascript
const stageEndpoint = localStorage.getItem('gymApiUrl');
const stageSession = JSON.parse(sessionStorage.getItem('gymOwnerSession') || 'null');
const postStage = async body => {
  const r = await fetch(stageEndpoint, {
    method: 'POST', redirect: 'follow', cache: 'no-store',
    headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body)
  });
  return r.json();
};
// Only synthetic IDs/data in this disposable Sheet. No token/password in the URL.
for (const action of ['getAll', 'addMember', 'updateMember', 'renewMember', 'deleteMember']) {
  const result = await postStage({ action });
  console.log(action, result.success, result.code);
}
// Capture stageSession before UI logout; after clicking Logout:
const replay = await postStage({ action: 'getAll', sessionToken: stageSession.sessionToken });
console.log('logout replay', replay.success, replay.code);
```

Also test fabricated tokens, malformed body/JSON, old password-only requests, and
missing configuration on the **disposable project**, restoring private settings
afterward. Never put credential probes in GET query strings. For expiry, keep the
reviewed 30-minute server duration unchanged; a manually edited session record is
a separate forced-expiry check and must not be called a real elapsed-TTL test.

Google documents the one-time `script.googleusercontent.com` ContentService
redirect: https://developers.google.com/apps-script/guides/content#redirects
The client already uses `redirect: 'follow'` and `text/plain` JSON POSTs. This is
code evidence, not proof of real browser CORS behavior. Do not use `no-cors`, JSONP,
an unauthenticated GET fallback, or browser security bypasses to make tests pass.

## Unrelated baseline issues for the next task (not fixed here)

1. `renewMember` returns `{success:true}` while the React success toast reads
   `newEndDate`, displaying `undefined`. This mismatch predates the review correction.
2. Raw numeric Sheet ID/phone cells can break frontend string searches. Fixtures
   must use Plain text, but normalization still needs its own reviewed correction.
3. Month-end arithmetic, ID reuse/concurrent writes, stale edits and manual Sheet
   reconciliation are unchanged.
4. Notification suppression checks `notified && days > 7` although alerts are for
   days <= 7, and flags are written before email sending. No real email tests ran.
5. Existing header overflow at phone widths, hidden first lookup validation errors,
   missing setup-guide links and old generated deployment assets remain outside auth.

## Evidence record and merge gate

- Initial PR head matched local `d298f8b`; PR was open/draft on the feature branch.
- Four new race/timeout regressions failed before correction and pass after it.
- Final local commands: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
  Their actual final totals and CI outcome are reported with the review commit.
- Local preview checks are separate from Google staging; no Google API was used.
- Local browser evidence: requested viewport overrides were adjusted for browser
  scaling and actual effective client widths were **375px** and **1367px**. In the
  login state, scrollWidth equalled clientWidth at both widths, Owner ID/password
  fields were present, the invalid-endpoint message was visible, and the password
  was cleared after rejection. Endpoint `https://example.invalid/exec` was rejected
  before a request, using only a temporary local origin on port 4187. This proves
  local form/error behavior only, not real login, CRUD, redirects, or Google CORS.
- Task 03 local suite: **58 passed, 0 failed**, including all six mock file-load
  orders and guarded staging diagnostics. Typecheck, lint and build pass; build
  retains the pre-existing stale Browserslist data warning. GitHub CI results must
  be checked against the pushed commit separately.
- GitHub Actions runs Node 24, locked installation, tests, typecheck, lint and build
  with read-only repository permission and no Google secrets or deployment step.

Task 04 local suite: **73 passed, 0 failed**. `npm run typecheck`, `npm run lint`,
and `npm run build` all passed (exit 0). Build retains the existing stale
Browserslist data warning; no dependencies were changed. The existing PR workflow repeats these checks; it cannot access Google.
Task 03 local browser observations above are historical, not a Task 04 browser rerun.

**GO for disposable staging preparation; NO-GO for a staging-validated merge.**
The active-Sheet source blocker is fixed, but real Google staging evidence is still
required for correct workbook/tab selection, the browser matrix, bcrypt timings,
execution identity, OAuth authorization and ContentService redirects. Do not merge or deploy merely because mocked CI is green.
