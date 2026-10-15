# Expiry reminders

The dashboard's Expiring Soon window is **0–7 Asia/Kolkata calendar days**,
inclusive. These memberships also count as Active. Expired members are separate.
Lists sort by expiry ascending. Memberships remain active on their inclusive end date.

`checkMembershipExpiries()` sends one owner email per eligible member/term. It
excludes already expired memberships and dates more than seven days away.
Delivery is off unless `EXPIRY_EMAIL_ENABLED` is exactly `true`. A valid
`ADMIN_EMAIL` is required. No trigger is created by the application.

Use **`runDailyExpiryNotifications`** as the daily trigger handler. This
parameterless entry point ignores the event supplied by Apps Script and calls
`checkMembershipExpiries(false)`. The sender's Boolean-only dry-run API and all
delivery safeguards remain unchanged.

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

## Daily scheduling (manual setup)

After installing the updated backend in the gym's Apps Script project, run the
synthetic preview first. Keep existing authentication/spreadsheet properties,
member counters and notification journal records. The existing disposable test
gym's counter must remain at least **3**, or its higher historical value.
`GYM_NAME`/`GYM_LOCATION` optionally customize email branding.

When the owner is ready for real delivery, configure their private `ADMIN_EMAIL`,
authorize Gmail and set `EXPIRY_EMAIL_ENABLED` to `true`. After confirming the
owner's delivery test, create the schedule manually:

1. In **Project Settings**, confirm the time zone is **Asia/Kolkata**.
2. Open **Triggers** (the clock icon), then **Add Trigger**.
3. Select **runDailyExpiryNotifications** as the function and **Head** as the deployment.
4. Choose **Time-driven → Day timer**, then choose the daily time window and save.
5. Check **Executions** after the first scheduled run for failures.

Keep just one daily expiry trigger. If an old trigger selects
`checkMembershipExpiries`, manually replace it with the handler above. The sender
accepts only a Boolean flag, so passing a trigger event directly to it fails.
Do not schedule a preview function. Google runs daily triggers within a time
window; they are not guaranteed to run at an exact minute. Setting
`EXPIRY_EMAIL_ENABLED=false` disables delivery even while the trigger exists.
Initial installation/testing leaves delivery disabled and creates no trigger.

Implementation references: [Google ScriptLock and flush](https://developers.google.com/apps-script/reference/lock/lock),
[Gmail submission API](https://developers.google.com/apps-script/reference/gmail/gmail-app#sendEmail(String,String,String)),
[trigger event arguments](https://developers.google.com/apps-script/guides/triggers/events),
[time-driven triggers](https://developers.google.com/apps-script/guides/triggers/installable#time-driven_triggers).
Tests use mocked Google services; they do not verify Google's real scheduler,
OAuth, locking, quotas, delivery, or eventual persistence.
