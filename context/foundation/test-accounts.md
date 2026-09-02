# Test Accounts

Isolation tests (`npm test` integration) need two confirmed managers on the
same cloud project as `.dev.vars`. Copy emails and passwords into `.env` as
`TEST_MANAGER_*` (see `.env.example`). Do not commit `.env` / `.dev.vars`.

## Manager A

- Email: `phase2test1785833353@mailinator.com`
- Password: `Phase2Test!12345`
- Purpose: isolation tests / Phase 1
- Notes:
  - Reused from earlier manual/API verification (`create-team-and-employee`).
  - If sign-in fails with "Email not confirmed", set `auth.users.email_confirmed_at` for this email in Supabase.

## Manager B

- Email: `isolation-manager-b@mailinator.com`
- Password: `IsoManagerB!12345`
- Purpose: isolation tests / Phase 1
- Notes:
  - Second cookie session on the same cloud project as Manager A. Must not see Manager A's people, meetings, notes, or tasks.
  - Email was confirmed at creation. If sign-in fails with "Email not confirmed", set `auth.users.email_confirmed_at` for this email in Supabase.
