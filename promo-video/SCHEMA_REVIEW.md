# Spreadsheet illustration and backend contract

The approved film depicts the existing **positional nine-column contract**, rather than a literal screenshot of the staging workbook. Its `Membership Plan` label matches the new-installation heading in [INSTALLATION.md](../INSTALLATION.md). Its shorter `ID` label matches the staging fixture. This is a presentation alias, not a backend column addition or rename.

| Position | Film illustration | Installation guide | Staging fixture/diagnostic | Backend meaning |
| --- | --- | --- | --- | --- |
| A | ID | Member ID | ID | Member identifier |
| B | Name | Name | Name | Name |
| C | Phone | Phone | Phone | Phone |
| D | Age | Age | Age | Age |
| E | Weight | Weight | Weight | Weight |
| F | Membership Plan | Membership Plan | Membership Type | `membershipType` |
| G | Start Date | Start Date | Start Date | `startDate` |
| H | End Date | End Date | End Date | `endDate` |
| I | Notified | Notified | Notified | Notification flag |

[backend/Code.gs](../backend/Code.gs) reads the plan from `row[5]` in `memberRecord_()`, writes `m.membershipType` to the sixth cell in `addMember()`, and renews columns F:I. Its member reader/writer uses positions and does not require a particular header spelling. The existing backend test fixture also uses `Plan`, `Start` and `End` as short labels.

[staging/members.tsv](../staging/members.tsv) and [staging/RuntimeChecks.gs](../staging/RuntimeChecks.gs) consistently use `Membership Type`; that optional staging diagnostic deliberately checks literal header strings. Keep that staging contract as supplied when running its diagnostics. The illustration is not a replacement setup fixture.

No application/backend, real Sheet, approved film source or rendered media was changed for this review. The regression test compares the actual staging headers, installation headings and `src/Premium.tsx` illustration through explicit ID/Member ID and Membership Plan/Membership Type aliases. It also exercises the real backend reader/writer in the existing in-memory test harness to check order and width without any Google access.

From `promo-video/`, run:

```powershell
node --test tests/schema.test.mjs
```

This confirms local semantic compatibility. It does not verify a deployed workbook or require a schema migration.
