# Install FitZone for a new gym

**You paste just one file:** [FitZone_Complete.gs](backend/generated/FitZone_Complete.gs).
Keep this guide open while you set up the gym. You do not need to combine or edit
any code. Each gym gets its own Google Sheet, Apps Script project and frontend
configuration.

These steps are for a **new installation**. Your currently working gym does not
need to be changed. Try a new installation with made-up members before using it
for real members. Do not paste the combined file alongside the three original
files: installing both copies causes duplicate names.

## 1. Create the gym's Google Sheet

Sign in with the Google account that will own this gym's data. Create a blank
Google Sheet and give it a useful name, such as **My Gym Members**.

Rename the bottom sheet tab to **Members**. Click cell **A1** and paste this line;
it fills the nine column headings from A to I:

```text
Member ID	Name	Phone	Age	Weight	Membership Plan	Start Date	End Date	Notified
```

Keep these nine columns in exactly this order. Do not add a password column.
Select column **A**, then choose **Format → Number → Plain text**. Do the same for
column **C** so Google Sheets keeps phone numbers as text. Leave member rows empty;
you will add members through the owner dashboard.

In the Sheet's **File → Settings**, choose the India/Kolkata time zone.

You will need the **spreadsheet ID** later: in the Sheet's address, it is the text
between `/d/` and `/edit`. Copy just that part, not the entire address or the `gid`.
Keep the Sheet private; customers do not need access to it.

## 2. Create one Apps Script project

From this Sheet, choose **Extensions → Apps Script**. Give the project a useful
name, such as **My Gym FitZone**. This is the only script project this gym needs.

Open **Project Settings** (the gear icon). Set the project time zone to
**Asia/Kolkata**. Use the **V8** runtime, which new projects normally use already.

## 3. Paste the single installation file

Open [backend/generated/FitZone_Complete.gs](backend/generated/FitZone_Complete.gs)
from the downloaded project in a text editor. If reading it on GitHub, use **Raw**
to copy the file's contents, not the web page. Select all and copy everything.

Back in Apps Script, open the default **Code.gs**, select all of its starter text,
and replace it with what you copied. Save. You may rename that editor file to
**FitZone_Complete**; keeping the default name **Code.gs** also works.

That is all the code to paste. Do **not** also add `Auth.gs`, `Bcrypt.gs`, another
copy of `Code.gs`, a library, or any old backend draft. The combined file already
contains the authentication library and all membership/notification functions.

## 4. Set the gym's private settings

First choose an Owner ID and password. On the computer with the downloaded
FitZone project, open a terminal in the project folder. Install Node.js 24 if it
is not already installed, then run:

```powershell
npm ci
node scripts/create-owner-config.mjs
```

Type your chosen Owner ID and password when asked. The password is hidden while
you type. The tool prints two settings: `OWNER_ID` and `OWNER_PASSWORD_HASH`.
The second is a secure password verifier. **Do not use the plain password in its
place**, paste these settings into the script code, or share the terminal output.

In Apps Script, open **Project Settings → Script Properties → Add script property**.
Add each name and value below, then save:

| Property name | What to enter |
| --- | --- |
| `OWNER_ID` | The Owner ID printed by the tool |
| `OWNER_PASSWORD_HASH` | The complete verifier printed by the tool |
| `SPREADSHEET_ID` | The ID you copied from the gym's Sheet address |
| `MEMBER_SHEET_NAME` | `Members` (must match the bottom Sheet tab exactly) |
| `MEMBER_ID_HIGH_WATER_MARK` | `0` **only for a brand-new, empty installation** |
| `EXPIRY_EMAIL_ENABLED` | `false` for initial setup and testing |
| `GYM_NAME` | The gym's display name, for email branding |
| `GYM_LOCATION` | The gym's city/location, for email branding |

For an **existing** installation, keep all existing Script Properties, sessions
and notification records; do not initialize it as a new gym. In particular,
**never lower or reset `MEMBER_ID_HIGH_WATER_MARK`**. It must cover every ID ever
issued, including deleted members. The existing disposable FitZone test gym must
keep a value of **at least 3**, or its higher current/historical value.

Email is optional. Leave it disabled while testing. If the owner later chooses
to enable it, configure their private `ADMIN_EMAIL` and follow
[the notification setup instructions](docs/NOTIFICATIONS.md). Initial setup
creates no email trigger and sends no messages.

After the owner has confirmed a real email delivery test and chosen to enable
daily reminders, set `EXPIRY_EMAIL_ENABLED` to `true`. Confirm the project time
zone is **Asia/Kolkata**, open **Triggers** (clock icon) → **Add Trigger**, and
select **runDailyExpiryNotifications → Head → Time-driven → Day timer**. Choose
a daily time window and save. Keep only one daily expiry trigger; replace an old
one if needed. Do not select `checkMembershipExpiries` or a preview function.
The daily handler safely ignores Google's trigger event. These are manual steps;
installing the code does not create a trigger.

## 5. Deploy the Web App

In Apps Script, choose **Deploy → New deployment**. Select **Web app** as the type.
Choose:

- **Execute as:** Me (the gym's Google account, which owns the Sheet).
- **Who has access:** Anyone, so the public member lookup can work.

Click **Deploy**. Review the permissions and authorize the project with the gym's
Google account. Public web access does not make the Sheet or script editor public;
owner actions still require the FitZone Owner ID/password and a valid session.
If your Google Workspace account does not allow the required access setting,
ask its administrator rather than changing the code to bypass authentication.

Copy the resulting **Web app URL**. It must be the complete HTTPS address ending
in **`/exec`**. Do not copy the Library URL, Deployment ID by itself, or a `/dev`
address. Do not append passwords or other query parameters.

## 6. Connect the frontend

In the downloaded FitZone project, make a file named **.env.local** by copying
**.env.example**. If `.env.local` already exists, edit it rather than replacing
its branding. Set its `VITE_APPS_SCRIPT_URL` line to the new gym's complete Web app
URL, on one line with no spaces before/after the address.

Set `VITE_GYM_NAME`, the trainer, address, contacts, logo and gallery settings as
needed in the same file. Match the gym name to the Script Property above.
**Never add owner passwords, password hashes, Sheet IDs or session tokens to the
frontend settings.** The Web app URL and branding are public frontend configuration;
`.env.local` is ignored by Git and must not be committed.

In the project terminal, run:

```powershell
npm run dev
```

Open the local URL printed in the terminal, normally `http://localhost:5173/`.
If you change `.env.local`, restart this command. A published frontend must be
rebuilt after its public configuration changes; publishing is a separate step.
This guide does not deploy to Vercel.

## 7. Check it with made-up members

Open **Owner Dashboard**, sign in and add a made-up member. Confirm that a new row
appears in the Sheet and its ID is a plain number. Check that ID on **Member
Lookup**, then try Edit, Renew, Refresh and a cancelled Delete. Log out and verify
that the dashboard asks for login again.

For a safe notification check, select **previewSyntheticExpiryNotifications** in
the Apps Script editor's function dropdown and click **Run**. It only returns
made-up notification examples; it does not open a Sheet, change settings or send
email. Do not run the actual email sender while setting up the gym.

Use the [full manual checklist](docs/FINAL_ACCEPTANCE.md) for the remaining
calendar, session and mobile checks. The same functionality is available whether
the backend is installed as one generated file or the three original source files.

## Updating the installation file — for the person maintaining the code

Edit only `backend/Bcrypt.gs`, `backend/Auth.gs` and `backend/Code.gs` as needed.
Never merge them by hand or edit the generated copy. Run:

```powershell
npm run generate:backend
npm run check:backend
npm test
npm run typecheck
npm run lint
npm run build
```

`npm run build` also regenerates the installation file automatically. CI and the
tests reject a missing/stale generated copy. Keep the regenerated file with the
source update. The generator preserves the bcrypt library/license, uses a fixed
order, checks syntax and duplicate global names, and never reads `.env.local`.

Tests run the regression suite against both installation forms using an Apps
Script-like V8 context without Node imports, timers or browser APIs. They mock
Google services: they do **not** prove real Google OAuth, redirects, quotas or
delivery. Test a fresh disposable Google project before adopting an update.
For a later authorized update, replace the existing installed code rather than
adding a second copy, keep all private properties/counters, and update the Web App
deployment version. Nothing in this generator changes an existing Google project.

Google references: [Web app deployment](https://developers.google.com/apps-script/guides/web),
[Script Properties](https://developers.google.com/apps-script/guides/properties),
[V8 runtime](https://developers.google.com/apps-script/guides/v8-runtime).
