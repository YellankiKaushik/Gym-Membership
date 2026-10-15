# Expiry reminders

The dashboard's Expiring Soon window is **0–7 Asia/Kolkata calendar days**,
inclusive. These memberships also count as Active. Expired members are separate.
Lists sort by expiry ascending. Memberships remain active on their inclusive end date.

`checkMembershipExpiries()` sends one owner email per eligible member/term. It
excludes already expired memberships and dates more than seven days away.
Delivery is off unless `EXPIRY_EMAIL_ENABLED` is exactly `true`. A valid
`ADMIN_EMAIL` is required. No trigger is created by the application.

## Safe dry runs

Run **`previewSyntheticExpiryNotifications()`** in the Apps Script editor for
the acceptance test. It generates only non-contactable synthetic examples and
returns a preview: seven days away, tomorrow and today qualify; yesterday and
eight days away do not. It never opens a Sheet, reads/writes Script Properties,
or calls Gmail. `checkMembershipExpiries(true)` separately previews configured
Sheet records without writing anything or sending email. Do not use it against
customer data for this release's synthetic-only testing.

## Journal and retries

All scheduled sends and CRUD use the same ScriptLock. The journal lives in
Script Properties at `EXPIRY_NOTICE_<canonical member ID>`; there are no extra
member columns or tabs. Each record contains a SHA-256 fingerprint of ID, plan,
start and expiry, status, attempt count and timestamp. Only the latest term's
record is retained per member. Contact edits preserve Column I and the term key.
Real renewal resets I and changes the key. A changed term in a direct Sheet edit
also differs from an existing journal; a legacy true flag without a journal is
honored and must be reviewed manually if its term is unknown.

The sender records `pending` before Gmail, `sent` after successful submission,
then sets Column I. A `sent` record suppresses repeats even if the Sheet flag
write failed. A Gmail exception records `failed`; the next attempt waits at least
one hour, with at most three total submissions for that term. A daily trigger
therefore retries on subsequent days while the membership is still eligible.
Invalid records are counted/skipped; duplicate IDs stop the run safely.

**Exactly-once delivery is not guaranteed.** Gmail and Properties/Sheets are not
one transaction, and successful submission does not prove inbox delivery. A crash
after Gmail but before recording `sent` leaves `pending` and blocks automatic
resending. A Gmail exception may also have an ambiguous external result, so even
bounded retries carry a duplicate risk. Review Sent mail before retrying uncertain
deliveries. `reviewRequired` lists pending, malformed or exhausted records.

After checking Sent mail, an editor-only wrapper may call
`resolveExpiryNotification('1', 'sent')` to confirm submission, or
`resolveExpiryNotification('1', 'retry')` to explicitly allow another attempt.
This does not send email itself. The retry decision can duplicate a message if
the earlier result was misunderstood. No public/admin HTTP action exposes this
editor utility. If only the Sheet flag failed, resolving `sent` repairs it.

Journal properties use storage proportional to issued members. Retain them during
normal operations; before Script Properties quota is approached, export a trusted
backup and archive deleted-member journal entries privately. Never remove active
term entries just to retry, and never change the member ID high-water mark.

## Later staging setup (not performed)

In the disposable project only, retain the authentication/spreadsheet properties,
ensure the historical member counter is at least **3**, and optionally set
`GYM_NAME`/`GYM_LOCATION` for email branding. Run the synthetic preview first.
For a separately authorized delivery test, set a controlled test `ADMIN_EMAIL`,
authorize Gmail, set `EXPIRY_EMAIL_ENABLED=true`, and manually create a daily
time-based trigger for `checkMembershipExpiries`, using project timezone
Asia/Kolkata. Do not create a trigger for a preview function. Leave delivery
disabled and triggers absent during the current manual acceptance work.

Implementation references: [Google ScriptLock and flush](https://developers.google.com/apps-script/reference/lock/lock),
[Gmail submission API](https://developers.google.com/apps-script/reference/gmail/gmail-app#sendEmail(String,String,String)).
Tests use mocked Google services; they do not verify Google's real scheduler,
OAuth, locking, quotas, delivery, or eventual persistence.
