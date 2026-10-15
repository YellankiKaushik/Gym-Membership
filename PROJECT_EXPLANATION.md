# How FitZone currently works

This explains the shipped implementation, checked against source on 16 October
2026. The frontend is live on [Vercel](https://fitzone-gym-mu.vercel.app).
[README](README.md) is the starting point; [the developer index](docs/README.md)
maps code to maintenance tasks. The previous, partly aspirational explanation is
preserved in [Git history at the redesign release](https://github.com/YellankiKaushik/Gym-Membership/blob/795153b8614c3dcd867db2cac2b28b63d6afde68/PROJECT_EXPLANATION.md).

## 1. Explain it to a new developer

The browser is the reception desk, Apps Script is the trusted clerk, and the
private Sheet is the filing cabinet. The browser asks for a membership or submits
an owner's action. Apps Script checks permission and input before touching the
Sheet. The browser displays the result. Changing the page's appearance cannot
replace the server's permission checks.

Each gym owns an independent installation. Frontend branding and the public API
address are build settings; owner credentials, Sheet selection and operational
state stay in private Apps Script Properties. This is not a multi-tenant SaaS.

## 2. Frontend modules

| Module | Responsibility |
| --- | --- |
| `src/App.tsx` | Header, root state navigation between member/owner views, footer and skip link |
| `src/pages/MemberLookup.tsx` | Numeric ID form, read-only results, errors, race guard and gym gallery |
| `src/pages/Adminpanel.tsx` | Owner state, authenticated fetching, CRUD handlers, search/filter/pagination and forms |
| `src/components/OwnerLogin.tsx` | Login presentation and password visibility; receives handlers from the panel |
| `src/components/DashboardSummary.tsx` | Four counts from existing membership utilities |
| `src/components/MemberList.tsx` | Desktop rows, tablet action strips and mobile cards |
| `src/components/MemberDialog.tsx` | Body portal, inert background, focus trap/restoration, scroll lock, busy-close protection |
| `src/components/ui.tsx` | Shared Button, StatusBadge, Alert and EmptyState |
| `src/components/WhatsAppReminder.tsx` | Validated prepared link, never an automatic sender |
| `src/api/gymApi.ts` | Endpoint validation, request timeouts, memory-only session and API calls |
| `src/config/gymConfig.ts` | One public branding source, bundled-photo fallback |
| `src/utils/membership.ts` | Calendar validation, Kolkata today/status, renewal constraints, summary and filtering |
| `src/utils/presentation.ts` | Readable dates only; no membership arithmetic |
| `src/utils/whatsapp.ts` | Indian phone normalization and encoded reminder text |
| `src/index.css`, `tailwind.config.js` | Shared design tokens, responsive layouts, interaction/focus/reduced-motion styles |

Navigation is state-based at the root URL, not React Router. No customer API setup
screen exists. There is no realtime subscription, optimistic member write or new
authentication provider. CSS supplies transitions/loading motion; no animation
package is needed by current components.

## 3. Request flow

```mermaid
sequenceDiagram
    participant UI as React browser
    participant GAS as Apps Script
    participant Props as Script Properties
    participant Sheet as Google Sheet
    UI->>GAS: POST login (Owner ID and password)
    GAS->>Props: Read owner verifier; apply throttle
    GAS-->>UI: Session token and absolute expiry
    Note over UI: Keep token only in memory
    UI->>GAS: POST protected action with token
    GAS->>Props: Validate token digest, expiry and current owner configuration
    GAS->>Sheet: Read or validate/write under ScriptLock
    GAS-->>UI: JSON result
    UI->>GAS: POST getAll after successful mutation
    GAS-->>UI: Current member list
```

Public lookup instead uses GET with `action=lookup` and a numeric ID. GET cannot
dispatch owner actions. Owner calls use POST `text/plain` containing JSON, avoiding
a JSON content-type preflight requirement for the Apps Script request. Google's
ContentService redirects and browser CORS behavior still need real runtime checks.

Read retries are bounded; mutations are not automatically retried because a
network timeout does not establish whether Google committed the change. A 20-second
abort deadline covers response-body consumption. Request-version checks prevent
late responses from restoring a logged-out owner view or overwriting newer work.

## 4. Authentication boundary

[Auth.gs](backend/Auth.gs) reads case-sensitive `OWNER_ID` and a bcrypt cost-12–14
verifier. The local [setup tool](scripts/create-owner-config.mjs) creates a random
salt and cost-12 verifier; plaintext passwords are never stored in configuration.
[Bcrypt.gs](backend/Bcrypt.gs) adapts the vendored synchronous library for Apps
Script V8 without Node/browser timers. Its payload and license have integrity tests.

Successful login creates a 30-minute, absolute-expiry session. Raw tokens remain
only in browser memory. The server indexes records by a SHA-256 token digest,
binds them to the current owner configuration, caps active sessions and rejects
expired/revoked/rotated-credential sessions. Logout clears the client immediately
and requests server revocation. If revocation cannot be confirmed, the UI explains
the remaining expiry window. Reload requires login.

A shared installation-wide five-failure/15-minute throttle is serialized with
ScriptLock. It is not a distributed abuse-defense system; legitimate owners can
also encounter the lockout. Every protected action is validated server-side before
Sheet access. Browser hiding, URL secrecy and client storage do not authorize writes.

## 5. Spreadsheet and member lifecycle

The nine columns A:I hold ID, Name, Phone, Age, Weight, Plan, Start, End and Notified.
`getMemberSheet_()` opens the privately configured Sheet ID/tab, with no active-Sheet
fallback. Missing/inaccessible configuration produces a sanitized error.

- **Create:** validate fields/plan/date, reserve a canonical numeric ID in persistent
  `MEMBER_ID_HIGH_WATER_MARK`, calculate expiry, write the nine cells and flush.
- **Read:** validate records and return either the owner list or a strict public
  allowlist. Duplicate canonical IDs fail closed rather than selecting a person.
- **Edit:** compare the supplied row version. Contact-only changes retain expiry
  and notification state; a changed plan/start recalculates the current term.
- **Renew:** reject overlap with the current inclusive expiry; use the explicit
  chosen start, calculate the new end and reset the notification flag.
- **Delete:** compare row version, preserve the high-water mark, then remove the row.
  Later creation never intentionally reuses the deleted ID.

CRUD and scheduled notifications share a ScriptLock. This coordinates this script's
executions, not human Sheet edits or other projects. Stale checks protect changes
made before a write begins; operators must coordinate direct edits during writes.
Lost phone digits, deleted historical IDs and ambiguous records cannot be invented.

## 6. Dates, statuses and dashboard

Plans are exactly 1 Month, 3 Months, 6 Months and 1 Year. Calendar arithmetic clamps
month-end/leap boundaries. For example, 31 January 2026 plus one month ends on
28 February 2026. End dates are inclusive and compared by Asia/Kolkata calendar day.

A membership with at least zero days left is Active; a negative remainder is Expired.
Expiring Soon is an Active subset with 0–7 days remaining. Thus Active and Expiring
Soon counts overlap deliberately. Lists sort by expiry, then numeric ID. Search
matches ID, name or phone; pages contain ten members.

Renewal suggests the later of today and the day after the current end. A later
explicit start creates a gap; overlap is rejected. The nine-column model stores
only the latest term and derives status from expiry even before a future start.
It is not a full history of paid terms, attendance or payments.

The dashboard reads a snapshot and displays the last successful refresh time.
Direct Sheet changes appear after Refresh. It does not promise live synchronization
or automatically write a stored status into the Sheet each day.

## 7. Public lookup privacy

Canonical `1` and legacy `001` identify the same member. Public JSON contains ID,
pseudonym (`Member #1`), plan, end date, status and days remaining. The public UI
does not render names, phones, age, weight, start date or row-version fingerprints.

Numeric IDs are predictable: enumeration can disclose limited membership facts.
This is not member authentication or verified identity. No public lookup rate
limiter is implemented. Sensitive deployments need an explicitly reviewed privacy
solution before rollout; merely hiding the endpoint or masking a phone is inadequate.

## 8. Reminders are a separate workflow

An owner may manually schedule `runDailyExpiryNotifications` as a daily trigger.
The parameterless wrapper drops Google's event argument and calls the existing
Boolean-only sender in normal mode. Installation creates no trigger.

Delivery requires `EXPIRY_EMAIL_ENABLED=true` and a valid private `ADMIN_EMAIL`.
Only active terms expiring in 0–7 days qualify. A fingerprint of member ID/plan/start/end
identifies the term. Private journal states record intent before Gmail, completion
after submission, then Column I. Completed journal entries suppress duplicate sends
even if the flag write fails. Failed submissions have bounded retry/backoff;
pending/ambiguous outcomes require explicit reconciliation. Gmail submission is
not inbox delivery, and exactly-once delivery across these services is not promised.

Synthetic preview never opens a Sheet or sends email. The configured-Sheet dry run
is a separate read-only helper. [The notification reference](docs/NOTIFICATIONS.md)
explains operational setup and recovery. WhatsApp uses an owner-clicked prepared
link; there is no backend messaging action, API subscription or automatic Send.

## 9. Source, generated installation and deployments

Maintain `backend/Code.gs`, `Auth.gs` and `Bcrypt.gs`. The generator combines them
in fixed Bcrypt/Auth/Code order, retains licenses/provenance, and checks syntax and
global declarations. The ready-to-paste file is
[FitZone_Complete.gs](backend/generated/FitZone_Complete.gs). Choose that single
file OR the original three files in a Google project, never both.

Vercel serves `dist/` produced from the current source and public build settings.
Main is linked to the existing production project; PR branches get previews when
Vercel permits them. GitHub CI tests source/bundle/browser behavior before release.
Pushing frontend code does not update Google's saved script/deployment version.
Each gym follows [INSTALLATION.md](INSTALLATION.md) with independent private settings.

The legacy `gh-pages` branch and `docs/index.html`/`docs/assets` represent older
static snapshots. They are preserved, not maintenance source or the current Vercel
build. Optional `staging/` helpers belong only in a marked disposable project and
are never included in the generated installer. Do not publish customer data or
install local untracked draft backend files.

## 10. Evidence versus future ideas

The redesign release verified the production UI and a read-only backend lookup.
The owner reports manual testing and a successful real Gmail test. The current
source/bundle and browser suites use synthetic Google services; they do not prove
private production credential rotation, real-time session expiry, Google quotas,
concurrent human edits, scheduler timing, actual delivery or disaster recovery.
Record such acceptance separately and privately for each installation.

No availability SLA, zero-cost guarantee, measured cold-start promise or commercial
compliance certification is claimed. Browser/physical-device acceptance, backups,
private property recovery, quota monitoring, privacy/retention decisions and
operational ownership remain maintenance responsibilities. Existing small photos
also limit gallery sharpness on large displays. Development-tool advisories are
tracked in [the handoff](docs/README.md#maintenance-findings-16-october-2026).

AI retention, payments, turnstiles, new authentication providers and new databases
were ideas in the old narrative, not shipped functionality or this maintenance task.
