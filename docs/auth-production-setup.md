# Parlé authentication production setup

Local implementation is provisionally approved. **Production migration and deployment are not authorized** until the founder completes the steps below and a later named approval is given.

This document is the configuration source of truth. Do not put client secrets, API keys, or tokens in git.

## Decision: GO / NO-GO

| Gate | Status |
| --- | --- |
| Local auth implementation | **GO** (with the checks in this file) |
| Apply `0004` on production Neon primary `br-morning-sun-apghun9g` | **NO-GO** until named approval |
| Deploy auth to Vercel `josz/parle` / `https://parle.chat` | **NO-GO** until Google + Resend work and `0004` is applied |
| Email real users (verification or marketing) | **NO-GO** without named approval |
| `PARLE_ADMIN_REQUIRE_VERIFIED_EMAIL` | **Keep off** until a founder account has `email_verified_at` |
| `PARLE_AUTH_GRACE_UNTIL` | **Keep unset** (grace stays on; no existing-user lockout) |
| `PARLE_ANALYTICS_VERIFIED_FROM` | **Do not change** (keep `2026-10-20`) |
| Automatic account cleanup / deletes | **Do not run** |
| AI, chat, memory, privacy settings | **Do not change** beyond the verified-identity gate |

**Overall: NO-GO for production deploy.** Founder configuration can proceed now. Stop after verification of this local work.

---

## 1. Google Cloud OAuth web client

Use a **Web application** OAuth 2.0 client. Do not use iOS, Android, or Desktop clients.

### 1.1 OAuth consent screen

1. Open [Google Cloud Console](https://console.cloud.google.com/) in the project that will own Parlé sign-in.
2. APIs & Services → **OAuth consent screen**.
3. User type: **External**.
4. App name: `parlé`.
5. User support email: founder Gmail / Workspace inbox.
6. App logo: optional.
7. Application home page: `https://parle.chat`
8. Privacy policy: `https://parle.chat/terms` (Parlé publishes terms and safety on this route; use it if there is no separate `/privacy` page).
9. Terms of service: `https://parle.chat/terms`.
10. Authorized domains: add `parle.chat` (do not add `vercel.app` unless you will also authorize preview callbacks).
11. Developer contact: founder email.
12. Publishing status for first tests: **Testing**, with the founder Google account (and any rehearsal testers) added as **Test users**.
13. Do not publish the app to Production until genuine Google login has been tested with a founder account.

### 1.2 Scopes

The app requests only:

- `openid`
- `email`

Do not add `profile`, calendar, Drive, or Gmail scopes.

Google still returns `email_verified` and, for Workspace, `hd`. Parlé treats email as trusted only when `email_verified` is true **and** the address is Gmail/Googlemail or has a Workspace `hd`.

### 1.3 Create the web client

1. APIs & Services → Credentials → **Create credentials** → OAuth client ID → **Web application**.
2. Name: `parlé production`.
3. **Authorized JavaScript origins** (exact, no trailing slash):

   - `https://parle.chat`
   - `https://www.parle.chat` (only if that host actually serves the app)
   - Local rehearsal only on a **separate** client or extra origin: `http://localhost:3000`

4. **Authorized redirect URIs** (exact):

   - Production: `https://parle.chat/api/auth/google/callback`
   - www, only if used: `https://www.parle.chat/api/auth/google/callback`
   - Local: `http://localhost:3000/api/auth/google/callback`

5. Preview deployments (`*.vercel.app`) are **not** enabled by default. Do not add them until you also set that preview’s `APP_URL` to the same origin. Mismatched `APP_URL` vs redirect URI will fail token exchange.

The server builds the redirect URI as:

`${APP_URL}/api/auth/google/callback`

`APP_URL` on Vercel production must be `https://parle.chat` with no trailing slash.

### 1.4 Client ID and secret handling

- **Client ID** is public in the browser redirect to Google. Still store it only in Vercel env, not in git.
- **Client secret** is server-only. Used on the token endpoint with PKCE (`code_verifier`). Never commit it, never put it in `NEXT_PUBLIC_*`, never paste it into chat logs.
- Rotate the secret in Google Cloud if it is ever exposed.
- Local `.env.local` is gitignored. Use it for rehearsal only.

### 1.5 Exact Vercel environment variable names

Set on the **Production** environment of `josz/parle` (and Preview only if that preview’s `APP_URL` and Google redirect URI match):

| Name | Required | Notes |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | yes, before enabling the button | Web client ID |
| `GOOGLE_CLIENT_SECRET` | yes, before enabling the button | Web client secret |
| `APP_URL` | yes | `https://parle.chat` |
| `NEXT_PUBLIC_PARLE_GOOGLE_SIGNIN` | staged | `false` until Google login is proven; then `true` |
| `AUTH_TEST_GOOGLE` | **must be unset** on Vercel | Local/mocked Google only |

Do **not** set `NEXT_PUBLIC_GOOGLE_CLIENT_SECRET`.

After changing `NEXT_PUBLIC_*`, redeploy so the client bundle picks up the flag.

### 1.6 How to test genuine Google login

Do this **after** secrets are on a private rehearsal or production-like deploy, **before** turning the public button on for everyone.

1. Add your Google account as an OAuth test user.
2. Confirm `APP_URL` matches an authorized redirect URI.
3. Set `NEXT_PUBLIC_PARLE_GOOGLE_SIGNIN=true` on that environment only.
4. Open `/register`, accept terms, click **Continue with Google**.
5. Choose the test Google account. Expect a round-trip to `/api/auth/google/callback` then `/welcome` or `/dashboard`.
6. Confirm the session cookie is `hs_session` (HttpOnly). Confirm a row in `user_auth_identities` for provider `google` (rehearsal DB only).
7. `/login` → Continue with Google with the same Google account should sign into the same user.
8. Negative cases:
   - Cancel on Google’s screen → `/login?auth=google_cancelled`
   - Existing Parlé email/password account, then Google with that same email while logged out → `/login?auth=link_required` (no silent merge)
   - Logged-in unverified password user trying to link Google → verify-email first
9. Unset `AUTH_TEST_GOOGLE` if it was ever set. Mock codes must never work in production.

Do not use a friend’s genuine account for the first test.

---

## 2. Resend email setup

Guest check-in mail already uses Resend with `PARLE_FROM_EMAIL` (`parlé <hello@parle.chat>`). Verification mail uses the same helper (`utils/resend.js`). **Do not send verification mail to real users until approved.**

### 2.1 Verified sending domain

1. Resend dashboard → Domains → `parle.chat` must show **Verified**.
2. If it is not verified, add the DNS records Resend shows (typically SPF, DKIM CNAMEs, optional DMARC) at the DNS host for `parle.chat`.
3. Wait until Resend marks the domain verified. Do not send from an unverified domain.

### 2.2 Sender address

Production sender:

```text
parlé <hello@parle.chat>
```

Vercel:

| Name | Value |
| --- | --- |
| `RESEND_API_KEY` | existing production key (do not rotate unless leaked) |
| `PARLE_FROM_EMAIL` | `parlé <hello@parle.chat>` |
| `APP_URL` | `https://parle.chat` (links in the email) |
| `AUTH_TEST_MAIL` | **must be unset** on Vercel |

Local tests set `AUTH_TEST_MAIL=1` so messages go to an in-memory bucket, not Resend.

### 2.3 DNS requirements

At the DNS host for `parle.chat`, keep Resend’s:

- SPF include for Resend
- DKIM CNAMEs
- DMARC (`p=none` is enough to start)

`hello@parle.chat` must be allowed by that domain. Do not use `no-reply@heartstrings.club`.

### 2.4 Verification email delivery

- Register does **not** create a session. It issues a hashed single-use token and emails `${APP_URL}/verify-email?token=...`
- The page does **not** consume the token on GET (safe for scanners). Confirm is POST.
- Token TTL: 24 hours.
- Token stored as SHA-256 hex; raw token is only in the email.
- Cooldown: 60 seconds per open challenge for that email + purpose.
- Delivery failure (no API key, Resend error): API returns `503` `delivery_failed` on resend. Register still returns a uniform `201` pending body so emails cannot be enumerated.

### 2.5 Expired and reused links

- Expired: POST confirm returns `expired`. User requests a new link from `/verify-email/pending`.
- Already used: `used`.
- Unknown: `invalid`.
- Consume is a single `UPDATE ... WHERE consumed_at IS NULL AND expires_at > now() RETURNING ...` so two concurrent POSTs cannot both succeed.

### 2.6 Production and preview callback URLs

Verification links use `APP_URL`, not the request Host header.

| Environment | `APP_URL` | Link |
| --- | --- | --- |
| Production | `https://parle.chat` | `https://parle.chat/verify-email?token=...` |
| Local | `http://localhost:3000` | localhost |
| Vercel preview | the preview origin, only if you intend to test mail there | must match that deployment |

If production `APP_URL` is wrong, users land on the wrong host and confirm will fail.

### 2.7 How to test mail without emailing real users

1. Local: `AUTH_TEST_MAIL=1` and the Playwright/unit path.
2. Optional Resend test: send **only** to a founder inbox you control, after domain verify, with named approval.
3. Do not use the five genuine user addresses.

---

## 3. Authentication security (this review)

Inspected independently against the local tree (not production data).

| Area | Finding |
| --- | --- |
| Token generation | 32-byte base64url; hashed SHA-256 before insert |
| Consume | Atomic SQL update; miss classified expired/used/invalid; compare of hashes is timing-safe |
| OAuth | `state` cookie vs query compared timing-safe; PKCE S256; `nonce` checked on id_token; `iss`/`aud` checked |
| Account collision | Google `sub` is the identity. Same email, no session → `link_required`. No silent merge |
| Linking | Logged-in user must already have `email_verified_at` and matching email |
| Stale reclaim | Only unverified, older than 24h, with no chat/diary/identities; DELETE also requires `email_verified_at IS NULL` and `created_at` cutoff |
| Concurrent register | Unique `LOWER(email)` after `0004`; `23505` maps to pending |
| Pending cookie | Set only for a newly created signup, not for an existing email (closes resend-as-owner) |
| Email uniqueness | `normalizeEmail` lowercases; `users_email_lower_idx` |
| Sessions | `hs_session` JWT `{id,email}` 7d; verify success issues session; unverified+grace-off login clears session |
| Admin gate | `PARLE_ADMIN_REQUIRE_VERIFIED_EMAIL` default false; 404 when on and unverified |
| Grace | Unset env = grace **on** (existing users keep access) |
| Chat after grace | `/api/chat/send` now 403 `pending_verification` when grace is off and email is unverified; legacy schemas without the column still allow send |

Remaining residual risks (accepted until later approval): other `requireAuth` APIs besides chat send are still gated mainly by the UI `mustVerify` redirect; reclaim is still check-then-delete (tightened with `RETURNING`); Google button visibility is a public env flag, not a secret.

---

## 4. Migration `0004` vs live app

File: `database/migrations/0004_auth_identities.sql`

Additive only:

- `users.email_verified_at`
- `users.email_verification_required DEFAULT TRUE`
- `password` DROP NOT NULL (required for Google-only users)
- unique index `users_email_lower_idx`
- tables `auth_challenges`, `user_auth_identities`

**Compatibility with production app `78a0776`:** extra columns are unused; the live app does not read them. The unique lower(email) index will **fail to create** if mixed-case duplicate emails exist. Preflight must show `case_insensitive_duplicate_email_groups = 0` before apply.

**Do not apply `0004` on production in this task.**

Read-only preflight (rehearsal):

```bash
node scripts/auth-migration-preflight.js --read-only --rehearsal --require-branch=br-misty-recipe-apcj8oyo
```

Production read-only (later named approval only):

```bash
node scripts/auth-migration-preflight.js --read-only --i-understand-read-only-production --require-branch=br-morning-sun-apghun9g
```

Safe rollback of a **future** apply: leave the schema in place and roll the Vercel deployment back to `78a0776`. Do not `DROP COLUMN`. Do not restore `password NOT NULL` if any Google-only (null password) rows exist.

Deploy order when later approved: **apply `0004` on primary, then deploy the app.** App-before-migrate makes register/verify fail (`42703`). Login has a legacy fallback.

---

## 5. Staged rollout checklist (preserve five genuine users + founder)

Do these in order. Do not skip.

### Stage A — Founder configuration (no user-facing change yet)

1. Complete Google Cloud steps 1.1–1.4. Keep the app in Testing.
2. Confirm Resend domain `parle.chat` is verified and `PARLE_FROM_EMAIL` is `parlé <hello@parle.chat>`.
3. On Vercel Production, confirm these are **unset or false**:
   - `PARLE_ADMIN_REQUIRE_VERIFIED_EMAIL` = `false` or unset
   - `PARLE_AUTH_GRACE_UNTIL` unset
   - `AUTH_TEST_GOOGLE` unset
   - `AUTH_TEST_MAIL` unset
   - `NEXT_PUBLIC_PARLE_GOOGLE_SIGNIN` = `false` until Stage C
4. Do **not** change `PARLE_ANALYTICS_VERIFIED_FROM`.
5. Do **not** run inventory deletes, wipe scripts, or `0004` on primary.

### Stage B — Schema (later named approval only)

1. Run production **read-only** preflight. `blocking` must be `[]`.
2. Apply `0004` on primary with the existing migrate authorization flags for additive primary work.
3. Re-run preflight; `migration_0004_recorded` must be true.
4. Do not delete or auto-verify existing accounts.

### Stage C — App deploy (later named approval only)

1. Deploy the auth build **after** `0004`.
2. Founder logs in with the existing password (grace is on).
3. Founder confirms email using a link sent **only** to the founder inbox.
4. Founder tests genuine Google login on the founder account (link after verified, or new Google-only on a throwaway).
5. Only then set `NEXT_PUBLIC_PARLE_GOOGLE_SIGNIN=true` and redeploy.
6. Only after founder `email_verified_at` is set, consider `PARLE_ADMIN_REQUIRE_VERIFIED_EMAIL=true`.
7. Leave `PARLE_AUTH_GRACE_UNTIL` unset until a separate approval to lock unverified existing users.

### Preserve

- Five genuine users: no password reset, no forced logout beyond normal cookie life, no auto-delete.
- Founder admin allowlist (`ADMIN_EMAILS`) unchanged.
- Chat, memory, and privacy toggles unchanged.

---

## Exact configuration the founder must complete now

These are the only production-adjacent actions that are safe **without** a deploy or migration:

1. Google Cloud: consent screen + web client origins/redirects/scopes as in §1. Store ID and secret in a password manager. Do not commit them.
2. Vercel (can save now, unused until deploy): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, keep `APP_URL=https://parle.chat`, set `NEXT_PUBLIC_PARLE_GOOGLE_SIGNIN=false`.
3. Resend: confirm `parle.chat` verified; confirm `RESEND_API_KEY` and `PARLE_FROM_EMAIL` already match §2. Do not send mail to genuine users.
4. Do not apply `0004` on production.
5. Do not enable admin verified-email enforcement.
6. Do not set `PARLE_AUTH_GRACE_UNTIL`.
7. Do not change analytics baseline.

When those are done, ask for a **named production approval** for migrate + deploy.
