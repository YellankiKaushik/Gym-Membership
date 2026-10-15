> Current membership rules with historical implementation notes. The no-publication statements below describe that development stage; the frontend is now live. See [current status](../README.md) and [the documentation index](README.md).

# Membership correctness — Task 05

Authentication and membership work is now integrated into `main`. The 15 October
completion changes supersede historical notification/privacy/session details below;
see [release report](RELEASE_REPORT.md) and [notifications](NOTIFICATIONS.md).
No production Sheet, Apps Script deployment, frontend publication or real email was changed.

## IDs and existing installations

**Disposable staging prerequisite:** ID `3` was already issued and deleted.
Before adopting this backend, privately ensure `MEMBER_ID_HIGH_WATER_MARK` is
at least `3` (or the higher trusted historical maximum). Never lower or reset it.

- New IDs are plain strings `1`, `2`, `3`, … in column A and API responses.
  Existing `001` and numeric `1` are both read/matched as `1`; existing ID cells
  are not rewritten. Old public lookup links still work. If both occur as separate
  rows, operations fail with `DUPLICATE_MEMBER_ID` rather than select the wrong person.
- `MEMBER_ID_HIGH_WATER_MARK` is a persistent server-side Script Property, shared
  by this installation. The backend seeds it from the current maximum and reserves
  each new number **before** writing the member. A failed write can leave a gap.
  Consecutive numbers are not promised after failures or deletions; reuse is forbidden.
- Creation, edit, renewal and deletion share a ScriptLock. Creation reserves/writes
  within that lock; deletion records the current maximum before removing a row,
  including deletion before the first creation on this version. Pending Sheet writes
  are flushed before releasing the lock. Busy writes return `MEMBER_BUSY`, not a
  silent retry of a mutation. Requests still require the existing owner session.
- **Before first adoption**, determine the highest ID ever issued from a trusted
  backup/history. Privately seed `MEMBER_ID_HIGH_WATER_MARK` with at least that
  value (a nonnegative integer without padding). The current Sheet cannot reveal
  IDs deleted before this mechanism existed. If that history is unavailable,
  historical non-reuse cannot be certified. Do not remove, lower or reset this
  property when rotating credentials, copying/restoring an installation or deleting
  rows. Preserve it with private configuration backups; never commit customer data.
- A manual higher ID raises the counter on the next create/delete. Manually
  deleting a row after the counter has observed it cannot permit reuse. A row
  manually added and removed entirely between API operations cannot be observed;
  operators must advance the counter before such edits. ScriptLock cannot lock
  human Sheet edits or another Apps Script project. Use one writer project and
  pause manual editing during writes. Stale simultaneous edits remain last-write-wins.

## Plans, dates and renewal policy

- Supported exact plan names: `1 Month`, `3 Months`, `6 Months`, `1 Year`.
  Backend rejects other values. Frontend types, add/edit/renew selectors and the
  public plan card configuration include all four.
- Dates must be real `YYYY-MM-DD` calendar dates between 1900 and 9999. API inputs
  reject rollover dates, timestamps, blank dates and locale-ambiguous strings.
  Real Google Sheet Date objects and ISO text cells are supported; raw numeric
  date serials/ambiguous text are rejected, not guessed. Format G/H as Date or use
  ISO text. Invalid records cause a controlled read error so they can be corrected
  directly in the Sheet; the API does not silently omit members.
- Interpret calendar dates in **Asia/Kolkata**. Use this timezone for both the
  Sheet and Apps Script manifest in staging. New writes use real midnight-in-India
  Date objects and a `yyyy-mm-dd` number format; responses use date-only strings.
  Day counts use calendar ordinals rather than host-local time or elapsed-hour rounding.
- Add the plan's calendar months to the entered start, clamping the day to the
  target month's last day: Jan 31 + 1 month = Feb 28/29; Feb 29 + 1 year = Feb 28;
  Aug 31 + 6 months = Feb 28/29. End dates remain **inclusive**. These rules do not
  subtract a day from the computed anniversary, and do not rewrite existing rows.
- Renewal initially suggests `max(today in India, current expiry + 1 day)`.
  An owner may select a later date (creating a gap) or backdate an expired renewal
  as long as it starts after the old expiry. The backend always re-reads the current
  expiry under lock and rejects starts on/before it with `RENEWAL_OVERLAP`, including
  stale browser forms. It never silently substitutes a date. There is no overlap
  override; a genuine date correction belongs in the edit workflow.
- Renewal returns `{success:true,newEndDate:'YYYY-MM-DD'}`. It writes F:I only,
  keeps the ID/contact details and resets I to false. A future renewal overwrites
  the stored term's start; this nine-column model does not retain term history.
  Active/Expired continues to be based on end date, including remaining paid time
  before a future renewal start; there is no new future/scheduled status.
- Contact-only edits preserve the existing expiry, including manually extended
  dates. An explicit change to start date or plan recalculates the end date; the UI
  explains this. Edit remains an owner correction tool and may shorten a term.

## Phone and nine-column compatibility

A:I remain ID, Name, Phone, Age, Weight, Plan, Start, End, **Notified**. No column,
database, trigger, or migration was added. New phone/ID cells are formatted Plain
text before writing. Phone API values are strings. Existing text preserves internal
formatting, plus signs and zeros. Numeric phones use explicit Sheet display padding
when it unambiguously represents the same digits (for example `09876 54321`).
Scientific notation is not returned in place of the actual stored digits.

If Sheets already converted `0123456789` to numeric `123456789` and there is no
explicit zero-padding format, the missing zero cannot be inferred. Restore the
phone from a trusted source as Plain text; the API does not invent padding.
Numbers beyond safe integer precision are rejected and need restoration too.
Writes accept 10 local digits, optionally prefixed by country code 91, with
presentation spaces, parentheses, `+` and hyphens. WhatsApp separately validates
Indian mobile prefixes; other international numbers are not supported.
Public lookup still excludes age/weight and exposes only the last four phone digits.

## Verification and real-Google boundary

Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
Tests use only synthetic data and mocked Google services. Competing requests are
simulated with two VM executions sharing properties, rows and a mutual-exclusion
mock, with an interleaved second creation during allocation. This checks lock usage
and retry/non-reuse behavior, **not** Google's actual parallel execution/quotas.

For an authorized disposable staging installation, follow
[the existing staging setup](AUTH_STAGING_VALIDATION.md), using this branch's three
backend files. Then verify all four plans, Jan 31/leap dates, early/expired renewal,
contact-only edits, invalid manual entries, deletion of the highest ID and a new
creation after a fresh request. From two browsers add different synthetic members
at the same time: verify unique unpadded IDs and exactly nine cells per row. A busy
request may require a deliberate retry. Test formatted/numeric phone cells and the
India midnight boundary. Never run expiry triggers or send real email.

The completion pass replaces the historical email writer with shared locking and journaled retries; contact-only edits preserve I. See [NOTIFICATIONS.md](NOTIFICATIONS.md). Human Sheet edits remain outside ScriptLock; the owner UI detects stale records before writing when possible.

Real Google Sheet writes, browser redirects/CORS, actual lock contention and
deployment compatibility remain **NOT RUN**. Remaining authentication/server-session
acceptance requirements are tracked separately in
[SERVER_SESSION_VERIFICATION.md](SERVER_SESSION_VERIFICATION.md).

### Local results — 2026-10-15, Asia/Kolkata

| Command/check | Result |
|---|---|
| `npm test` | 105 passed, 0 failed (including existing auth tests) |
| `npm run typecheck` | PASS, exit 0 |
| `npm run lint` | PASS, exit 0 |
| `npm run build` | PASS, exit 0; existing stale Browserslist warning |
| `node --test --test-name-pattern=clamps\|Asia/Kolkata tests/membership.test.mjs` with process TZ UTC, America/Los_Angeles, Asia/Kolkata | 9 passed in each zone, 0 failed |
| Auth.gs / Bcrypt.gs / frontend session transport source comparison | Unchanged from the authentication base branch |
| Real Google/browser staging and actual parallel runtime | NOT RUN |

The timezone command was executed with a Node child process setting `env.TZ`
for each run, not by changing the computer's timezone. Mock Gmail never sends mail.
