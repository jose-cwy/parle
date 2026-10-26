# Existing-user email verification rollout

This plan is documentation only. Do **not** set `PARLE_AUTH_GRACE_UNTIL`, do **not** set `PARLE_ADMIN_REQUIRE_VERIFIED_EMAIL`, do **not** email genuine users, do **not** delete accounts, and do **not** deploy until a named approval.

`PARLE_ANALYTICS_VERIFIED_FROM` stays `2026-10-20`. `NEXT_PUBLIC_PARLE_GOOGLE_SIGNIN` stays `false` on production until a separate Google approval.

## How access works now

| Person | Unverified access while grace is unset |
| --- | --- |
| Account `created_at` before `2026-10-23` UTC | Yes. Dashboard shows a confirmation notice. |
| Account `created_at` on/after `2026-10-23` UTC | No. Must confirm email first (pending screen). |
| Any account with `email_verified_at` set | Full access. |
| After `PARLE_AUTH_GRACE_UNTIL` has passed | Legacy unverified users see `/verify-email/required`. Data is kept. |

Cutoff env: `PARLE_AUTH_NEW_SIGNUP_FROM` (default `2026-10-23`). Invalid values fall back to that default so new accounts cannot accidentally inherit grace.

Grandfathering uses server-side `users.created_at` (set at INSERT; register ignores client body fields) plus the DB flag `email_verification_required`. After `0004` that flag is `TRUE` for every row. An explicit `FALSE` is a manual database override, not a client-provided value. Invalid `PARLE_AUTH_NEW_SIGNUP_FROM` falls back to `2026-10-23`.

### Accounts created during the auth rollout before this patch

Password signups on/after `2026-10-23` UTC were already supposed to verify, but while grace was unset they could still obtain `hs_session` via login. Those rows stay in the database with chats, journals, and memories intact.

After this patch:

- Leftover session cookies for those accounts are rejected on protected APIs (`403 pending_verification`) until the mailbox is confirmed.
- Login no longer issues `hs_session` for them.
- They are **not** treated as legacy; they are not deleted.

Pre-cutoff genuine users keep grace access until a named `PARLE_AUTH_GRACE_UNTIL` is set.

## What is preserved

Verification and email-change update `users.email` / `email_verified_at` only. They do not delete users, chats, journals, memories, or passwords. Recovery requires the current password and confirmation of the **new** mailbox before the login email changes. There is no merge into another existing account.

## Staged enforcement (when later approved)

### Stage 0 — local / preview (this work)

Ship the notice, required screen, recovery path, and cutoff logic. Keep production grace unset.

### Stage 1 — founder first

1. Founder confirms the mailbox on the founder account (real Resend mail, not `AUTH_TEST_MAIL`).
2. Confirm `/admin` still works with `PARLE_ADMIN_REQUIRE_VERIFIED_EMAIL` still **off**.
3. Only after the founder row has `email_verified_at`, consider turning admin verified-email on in a later approval.

### Stage 2 — notice genuine users

1. Inventory unverified production accounts with `scripts/auth-account-inventory.js --read-only` (never against a writable production session from a laptop script that can mutate).
2. Send a human notice from the founder mailbox (not a bulk product blast unless separately approved): confirm this email, or use “I can’t use this email” with the current password.
3. Leave `PARLE_AUTH_GRACE_UNTIL` unset during this window so genuine users keep their space open.

### Stage 3 — named deadline

1. Choose a UTC calendar date at least several days after Stage 2 mail.
2. Set `PARLE_AUTH_GRACE_UNTIL=YYYY-MM-DD` on Vercel only after named approval.
3. After that date, unverified legacy logins go to `/verify-email/required`. App APIs return `403 pending_verification`. Accounts stay.

### Stage 4 — lost mailbox

Users who still know the password use `/verify-email/recovery`. Users who have neither inbox nor password write `support.parle@gmail.com`. Support must not delete the space; recover by a later, named identity check.

## Rollback

Unset `PARLE_AUTH_GRACE_UNTIL` to reopen grace for legacy unverified users. Do not drop migration `0004`. Do not delete users to “fix” verification.
