> This is a disposable-installation test procedure, not the current release-status report. The frontend is already live; keep existing production settings and schedules unchanged. See [the developer index](README.md) for verified versus owner-reported evidence.

# Final manual acceptance — disposable staging only

Use main and synthetic records. No production Sheet/deployment changes, actual
email/WhatsApp sends, production triggers, or Vercel deployment are part of this
checklist. Record real Google results separately; mocked tests do not prove them.

1. **Prepare the test backend.** In the existing disposable Apps Script project,
   replace `Code.gs` with `backend/Code.gs` from main. Retain matching `Auth.gs`
   and `Bcrypt.gs`; if they are absent/outdated, install those source files too.
   Remove duplicate old handler definitions from that test project. Use V8 and
   Asia/Kolkata. Do not install the untracked ten-column backend draft.
2. **Check private properties.** Retain correct `OWNER_ID`, `OWNER_PASSWORD_HASH`,
   `SPREADSHEET_ID`, and `MEMBER_SHEET_NAME`. The test ID counter must be
   `MEMBER_ID_HIGH_WATER_MARK >= 3`, because ID 3 was issued and deleted; use a
   higher historical maximum if applicable. Never lower/reset it. Leave
   `EXPIRY_EMAIL_ENABLED` absent/false and staging email triggers absent.
3. **Prepare the frontend.** Copy `.env.example` to `.env.local`, set
   `VITE_APPS_SCRIPT_URL` to the disposable `/exec` URL and customize branding.
   Run `npm ci`, then `npm run dev`; open `http://localhost:5173/`. Confirm a new
   browser opens on Member Lookup, with no technical setup screen. Updating a
   disposable web-app deployment version is a manual acceptance action; do not
   replace the real customer deployment.
4. **Owner login.** Confirm correct Owner ID/password succeeds, incorrect/case
   variants fail safely, the password clears after submission, and login itself
   returns no member list. Use the private generator guide for credential setup.
5. **Unauthorized API calls.** Test getAll/add/update/renew/delete with no token,
   a fake token, and the obsolete password-only body. All must fail without Sheet
   access/writes. GET must not dispatch admin actions. Keep request bodies private.
6. **Session lifetime and logout.** Capture a test token privately. Logout must
   clear the owner UI and revoke that token; replay must fail. Reload requires
   login because tokens are in memory. Wait past the real 30-minute lifetime and
   verify server rejection. Rotate temporary test credentials and verify old
   sessions fail. Test the five-failure throttle last; it lasts up to 15 minutes.
7. **Member lookup/privacy.** Search `1` and legacy `001`; both identify the same
   synthetic member. Verify pseudonym, ID, plan, status, inclusive expiry and days
   remaining. Inspect JSON: no real name, phone, start date, age, weight, version
   token or owner data. Empty/unknown IDs and network failure must show a readable
   message. Predictable IDs still reveal limited plan/expiry information.
8. **Add and four plans.** Create synthetic members for 1 Month, 3 Months,
   6 Months and 1 Year. Verify all nine columns A:I, plain-text phone/ID, real
   date cells, generated unpadded IDs, and I=false. Verify invalid dates, empty
   names, invalid measurements and unsupported plans are rejected.
9. **Edit.** Change contact details without changing term. Verify ID, custom
   expiry and Notified stay unchanged. Change plan/start deliberately and verify
   recalculation and I reset. Check weight decimals remain intact.
10. **Direct Sheets refresh/stale edits.** Edit a synthetic name/phone/expiry in
    Sheets, then Refresh. Verify new values and statistics. Open Edit, change that
    row in Sheets, then Save: expect the stale-record warning. Close, Refresh,
    and reopen to continue. Human edits during an API write still need coordination.
11. **Renewal/paid time.** Renew an active member before expiry. The suggested
    start is the day after inclusive expiry, or today if expired. Enter a later
    date and verify that exact date is used. An overlapping date must be rejected.
    Verify the returned/newly displayed expiry and reset I. Future-start terms
    retain the existing expiry-based Active status convention.
12. **Dates.** Verify Jan 31 + one month = Feb 28/29, Feb 29 + one year = Feb 28,
    Aug 31 + six months = Feb 28/29, and Dec/Jan rollover. Feb 31 and ambiguous
    dates must fail. Test expiry at Kolkata 23:59/00:00: expiry day is Active with
    zero remaining days; the next day is Expired.
13. **Delete and IDs.** Cancel deletion first and verify the row survives. Confirm
    deletion, then create another member: the deleted ID must not be reused.
    Delete the highest ID and repeat after a new request. Verify the persistent
    counter never decreases. Simultaneous synthetic writes should yield unique
    IDs or a controlled busy response. Do not fabricate missing phone digits.
14. **Dashboard.** Use dates yesterday, today, tomorrow, +7 and +8 days. Expected
    counts are Total 5, Active 4, Expiring Soon 3, Expired 1. Verify all four
    filters, ascending expiry order, ID/name/phone searches (including formatted
    phones), pagination, empty states and Refresh/loading/error messages.
15. **Email dry run.** Run `previewSyntheticExpiryNotifications()` in the editor.
    Exactly today/tomorrow/+7 should qualify; yesterday/+8 should not. Verify zero
    Sheet reads/writes and zero Gmail calls in its source path. Keep delivery off.
    Failure, repeated-run, contact-edit and concurrency behavior is exercised with
    mocks by `node --test tests/notifications.test.mjs`; actual Gmail submission,
    delivery, quotas and scheduler behavior require separate authorization later.
16. **WhatsApp.** Verify valid Indian 10-digit and +91 numbers produce `wa.me`
    links with the actual member name, gym name and expiry. For invalid/missing
    phones, verify the visible correction message. Opening the link manually
    should prepare the text on phone/desktop; **do not press Send** during this
    acceptance pass. No paid API or automatic sender is used.
17. **Responsive/accessibility checks.** Check 320, 375, 390, 768, 1024 and 1440px.
    Verify no horizontal overflow, 44px action targets, readable input labels,
    open/close all four dialogs, keyboard Tab/Shift+Tab containment, Escape,
    restored focus, scrollable forms and delete confirmation. Check a real phone
    keyboard, browser zoom and WhatsApp handoff manually too.
18. **Record the boundary.** Run the final commands in the release report. Record
    the exact main commit, test `/exec` deployment version and sanitized Google
    outcomes. Keep production/Vercel deployment and actual sends pending explicit
    authorization; do not publish credentials, tokens, real records or private logs.
