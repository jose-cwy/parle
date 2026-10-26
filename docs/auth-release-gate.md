# Authentication release gate

Do not mark a user journey PASS unless that journey was completed in the named environment.

Production Google Sign-In, admin verified-email enforcement, and the grace lockout deadline stay off until a separate named approval.

## MOCKED (required in CI / local isolated rehearsal)

Run against a rehearsal database or `AUTH_TEST_MAIL=1` / `AUTH_TEST_GOOGLE=1`. These must pass before any authentication deploy:

| Check | How |
| --- | --- |
| Fresh email registration creates a pending user and does not set `hs_session` | Unit + API + Playwright register → pending |
| Existing password login | API authed journeys with `testuser_a@parle.test` |
| Verification completion with a hashed single-use token | Isolated API/e2e with captured test mailbox tokens |
| Resend after a failed send (no `last_sent_at` until success) | Unit interpret + isolated resend |
| Used and expired links | Unit `classifyConsumeMiss` + confirm UI |
| Authenticated-session signup does not yank to Login/Dashboard | Playwright register signed-in card; pending hides Login CTA |
| Google collision does not silent-merge | Unit `googleAccountDecision` |
| Guest chat still works | Existing guest API/e2e |
| Mobile signup/login layout | Playwright `mobile` project |
| Existing-user data preservation | Integrity fingerprints; no DELETE in auth migrations |
| New signup vs legacy grace | Unit `authUpgrade` cutoff tests; new accounts cannot `sessionAllowsApp` while unverified |
| Post-grace required + recovery UI | Playwright required/recovery screens; recovery copy forbids deletion |

## REAL PROVIDER (manual / controlled preview — not CI)

Repeat these with a founder-controlled mailbox and the authorized personal Gmail **before** public enablement:

| Check | Status rule |
| --- | --- |
| Resend accepts the send (`id` present, not an error object) | FAIL if only `{ ok: true }` without provider id |
| Real verification email arrives | FAIL if inbox empty after a successful `id` |
| Confirm URL host is the intended `APP_URL` | FAIL if localhost or a preview host leaks to production users |
| Confirm button consumes the token once | FAIL if GET auto-consumes |
| Account `email_verified_at` set; password login works | Required |
| Google OAuth on an isolated preview whose redirect URI matches `APP_URL` | Required before `NEXT_PUBLIC_PARLE_GOOGLE_SIGNIN=true` |
| Returning Google login, password-account collision, founder/admin untouched | Required |
| OAuth consent publishing status allows the intended testers | Required |

## Public enablement

| Flag | Public GO only when |
| --- | --- |
| Email signup | Real Resend delivery + pending screen stability verified |
| `NEXT_PUBLIC_PARLE_GOOGLE_SIGNIN=true` | Real Google OAuth on preview **and** production redirect URIs, consent screen testers added, no silent merge |
| `PARLE_ADMIN_REQUIRE_VERIFIED_EMAIL` | Founder account verified |
| `PARLE_AUTH_GRACE_UNTIL` | Existing users warned; **keep unset** until the staged plan in `docs/auth-verification-rollout.md` |
| `PARLE_AUTH_NEW_SIGNUP_FROM` | Default `2026-10-23`; new accounts must verify even while grace is on |

## Environments

- Isolated: `REHEARSAL_DATABASE_URL`, never production `DATABASE_URL`.
- `AUTH_TEST_*` must stay unset on Vercel production.
- Do not email the five genuine users.
