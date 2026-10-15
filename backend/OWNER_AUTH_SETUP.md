> Current setup reference with historical staging notes. The frontend is live; do not interpret older “future cutover” wording as permission to modify an existing Google installation. See [current release/evidence boundaries](../docs/README.md).

# Owner authentication setup

This change preserves React, Apps Script, Sheets, and one installation per gym.
The uploaded `Code.gs` is the baseline, not proof of what production currently runs.

**Staging review:** See [the staging procedure and evidence](../docs/AUTH_STAGING_VALIDATION.md).
Task 04 replaces active-Sheet access with a configured workbook and tab for every
member operation and expiry check. Real web-app access still requires the disposable
Google staging procedure; editor-only and mocked checks are not runtime evidence.

## Files and nine-column compatibility

For a new gym, use the [simple one-file installation guide](../INSTALLATION.md)
and paste only `generated/FitZone_Complete.gs`. The original three-file installation
(`Code.gs`, `Auth.gs`, `Bcrypt.gs`) remains supported for maintainability and existing
projects. **Choose one installation form; never paste both into the same project.**
Do not install `docs/BACKEND_SCRIPT_MODIFIED.gs`: it is an older, incompatible ten-column draft.
Use project timezone Asia/Kolkata. Leave delivery disabled and staging triggers absent during this acceptance pass; production schedules are unchanged. `openById` needs
`https://www.googleapis.com/auth/spreadsheets`; if the manifest explicitly limits
scopes to `spreadsheets.currentonly`, the full Sheets scope and reauthorization
are required. Validate this in staging before any future production cutover.
The private production manifest has not been supplied or reconstructed here.

The Sheet layout is unchanged: A ID, B Name, C Phone, D Age, E Weight, F Plan,
G Start, H End, **I Notified**. All work is integrated into main; see [membership rules](../docs/MEMBERSHIP_CORRECTNESS.md).
Public lookup uses a pseudonym and excludes all contact data, start date, age and weight.
[Expiry notifications](../docs/NOTIFICATIONS.md) now use a term journal, shared locking and a master enable switch.

## Configure privately

In a private, interactive terminal using Node 24+, run:

```powershell
node scripts/create-owner-config.mjs
```

The password is entered twice without terminal echo. Do not pass it in command
arguments, paste it into source, record the terminal, or share the generated output.
Use a unique password of at least 12 characters and at most 72 UTF-8 bytes.
The bundled bcrypt library generates a random salt using Node's Web Crypto and a
cost-12 verifier. The backend accepts cost 12–14; benchmark any higher cost on a
disposable Apps Script project before changing it. No bcrypt salt/hash generation
is performed inside Apps Script, where browser/Node random APIs are unavailable.

In Apps Script **Project Settings > Script Properties**, set:

| Property | Meaning |
| --- | --- |
| `OWNER_ID` | Case-sensitive ID, 1–128 characters, no surrounding whitespace |
| `OWNER_PASSWORD_HASH` | Complete bcrypt verifier printed by the local tool |
| `SPREADSHEET_ID` | ID between `/d/` and `/edit` in the intended Sheet URL (not `gid`, a Script ID or a full URL) |
| `MEMBER_SHEET_NAME` | Exact actual member tab name, including case/spaces; `Sheet1` and `Members` are valid |
| `ADMIN_EMAIL` | Owner's private notification recipient, configured manually |

Both Sheet properties are required. The helper opens only that workbook/tab with
no active-Sheet fallback. A missing, malformed or inaccessible ID, blank tab setting,
or nonexistent tab produces `MEMBER_SHEET_UNAVAILABLE` without private identifiers.
Login/logout do not require Sheet access; lookup and authorized member operations do.
Check sharing with the web app's execution account and the Sheets OAuth scope if
valid-looking settings fail. No configuration value is hardcoded in source.

Missing, empty, or invalid owner configuration disables login and protected actions.
`ADMIN_EMAIL` is notification configuration, not a login requirement. Missing/invalid recipients cannot mark notifications complete. `setAdminEmail()` now validates a privately
configured recipient; it no longer embeds or sets an email address in source.
Remove the obsolete `ADMIN_PASSWORD` property after a reviewed future cutover.
Do not put secrets or production Sheet/Script/deployment IDs in Git.

Before any future deployment, verify this source against the actual deployed
project, install it first into an isolated test project/Sheet, and configure the
real frontend with a trusted HTTPS `https://script.google.com/macros/s/.../exec`
endpoint. The API client rejects arbitrary destinations and query-bearing URLs
before sending owner credentials. Updating an endpoint clears the local session.
The frontend and backend contracts must be released together; old clients fail closed.
This task does not deploy or change any real configuration.

## API and session behavior

- POST `login`: `{ action: 'login', ownerId, password }` returns
  `{ success: true, sessionToken, expiresAt }`. `expiresAt` is epoch milliseconds.
  Login does not return member records. The password is sent once over HTTPS and
  is never persisted by the client or stored in Script Properties as plaintext.
- Protected POST `getAll`, `addMember`, `updateMember`, `renewMember`, `deleteMember`
  retain their payloads but require `sessionToken` instead of `password`.
- POST `logout` revokes the supplied session. The browser clears local state even
  when a network outage prevents server confirmation. A network warning explains
  that an unconfirmed server session may remain usable until its absolute expiry.
- GET supports **only lookup**. GET admin actions are rejected even with a valid
  password or session token. Lookup never receives owner credentials from the client.
- Session tokens concatenate two platform random UUIDs (244 random bits after UUID
  version/variant bits), have a fixed 30-minute absolute lifetime, and cannot be
  extended by activity or changing browser storage. Google documents `getUuid()`
  as equivalent to Java `UUID.randomUUID()`:
  https://developers.google.com/apps-script/reference/utilities/utilities#getUuid()
- Only SHA-256 digests of tokens are used as Script Property keys; raw tokens are
  not stored server-side. Records bind sessions to the current ID/verifier. Up to
  20 active sessions are retained; a new login evicts the oldest at the limit.
  Expired and old-credential sessions are pruned on login and rejected on access.
  Properties, not an evictable cache, are the source of session/revocation truth.
- Five failed login attempts lock logins for the remainder of a 15-minute window.
  This installation-wide limiter is serialized using ScriptLock and survives
  separate requests. It covers wrong IDs too, and is basic throttling rather than
  network-level abuse prevention. An attacker can intentionally cause temporary
  login denial; already valid sessions remain usable.
- Tokens are held only in page memory, bound to the endpoint, and sent
  only in JSON POST bodies. Reload requires login. Legacy browser credentials are erased and never restored.
  XSS or a compromised shared device can still steal a bearer token. No secrets,
  hashes, tokens, or payloads are logged; exception responses use generic errors.
- Only reads and logout are retried automatically. Add/edit/renew/delete and login
  are not retried after a lost response; the backend has no mutation idempotency layer.
- Pending logins are invalidated by logout, endpoint changes, or a newer login.
  A late returned token is revoked best-effort at the original endpoint and never
  replaces the current browser session. If the response is permanently lost or cleanup
  fails, an unclaimed server session can remain until its absolute expiry.
- Request timeouts cover both response headers and JSON body consumption. Timers
  remain active through ContentService redirect/body processing.

## Credential rotation and emergency revocation

1. Generate a fresh verifier locally with the same tool and a new unique password.
2. Update `OWNER_PASSWORD_HASH` privately; optionally change `OWNER_ID` too.
3. Existing sessions become invalid because their stored credential fingerprint no
   longer matches. A fresh salted hash revokes sessions even if the password repeats.
4. Confirm the new credentials on the isolated test installation before a planned
   production change. Do not retain plaintext credentials in setup notes.
5. For emergency fail-closed access, remove `OWNER_PASSWORD_HASH`. All protected
   access stops until valid configuration is restored. Privately deleting properties
   whose names start with `OWNER_SESSION_` also revokes those individual sessions.

Never expose a public initializer, reset-password endpoint, or configuration dump.
Only trusted project editors should be able to change Script Properties or source.

## Verification and scope limits

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

Tests use synthetic data and mocked Google services, including an Apps Script-like
VM without Node modules, Web Crypto, or timers for the backend. They exercise the
actual API client against the actual Apps Script dispatch in memory. No test calls
production, writes a real Sheet, or sends a real email.

The upstream bcrypt UMD payload references a timer during initialization. A small
outer adapter supplies a deliberately unavailable async scheduler, allowing the
synchronous verification API to load in Apps Script. Crypto algorithms are unmodified.

Remaining limitations: historical deleted-ID recovery, direct human edits during an API write, predictable-ID membership enumeration, and older production assets. Stale dashboard forms now reject changed records; they cannot lock human Sheet edits. See the release report for current verification and development dependency advisories.
Google runtime behavior, real browser cross-origin redirects, quota behavior,
bcrypt timing, real trigger delivery, and actual deployment identity still require
an authorized staging acceptance test. Do not describe this as production-secure yet.
