# Deploy to Vercel (with optional accounts)

Accounts are optional. The Sign in button is always shown. Without `DATABASE_URL` its dialog says accounts are being set up and disables the form; the site stays fully readable and progress stays in the browser. Email + password accounts need only the database and `AUTH_SECRET`; GitHub/Google buttons appear only when their keys are set.

Limitations: there is no email verification yet and password reset is not implemented.

The GitHub Pages static export (`GITHUB_ACTIONS` / `STATIC_EXPORT=true`) cannot include API routes, so accounts only work on Vercel (or any Node host). Keep Pages as a read-only mirror if you like.

## 1. Create the project
1. Push the repo to GitHub.
2. Vercel dashboard, Add New, Project, import the repo. Framework preset: Next.js. Defaults are fine (`npm run build` runs velite first).

## 2. Add Neon Postgres
1. Project, Storage tab, Create Database, choose Neon (Marketplace).
2. Connect it to the project for **Production** and **Preview** (and Development if offered). Vercel injects `DATABASE_URL`.

## 3. Auth secret
```
npx auth secret
```
Copy the generated `AUTH_SECRET` value into Vercel (Settings, Environment Variables). For local dev, put it in `.env.local`.

## 4. OAuth apps
Callback URLs (replace `<domain>`; add the localhost ones for dev):

| Provider | Where | Callback URL |
|---|---|---|
| GitHub | Settings, Developer settings, OAuth Apps, New | `https://<domain>/api/auth/callback/github` and `http://localhost:3000/api/auth/callback/github` |
| Google | Cloud Console, APIs and Services, Credentials, OAuth client ID (Web application), Authorized redirect URIs | `https://<domain>/api/auth/callback/google` and `http://localhost:3000/api/auth/callback/google` |

GitHub allows one callback per app, so create a second OAuth App for localhost (or swap the URL while developing). Preview deployments have changing URLs and will not match; test sign-in on the production domain or localhost.

## 5. Environment variables
Set in Vercel (Production and Preview as needed); see `.env.example`:
`AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ADMIN_EMAILS` (comma-separated emails allowed to manage coupons), `NEXT_PUBLIC_SITE_URL` (for example `https://architectlens.com`). `DATABASE_URL` comes from Neon.

A provider button only shows when both its ID and secret are set.

## 6. Run migrations (once, and after every schema change)
`npm run db:migrate` runs `drizzle-kit migrate` and applies the SQL files committed in `./drizzle`. It reads `DATABASE_URL` from the shell or `.env.local`.
```
npm i -g vercel
vercel link
vercel env pull .env.local --environment=production
npm run db:migrate
```
After changing `db/schema.ts`: `npm run db:generate`, commit the new SQL in `./drizzle`, then migrate again.

To migrate automatically later, change the build script to `"build": "drizzle-kit migrate && next build"` (needs `DATABASE_URL` at build time, which the Neon integration provides). Not enabled now so builds work with no env vars.

## 7. Coupons and entitlements
Coupon admin endpoints work only for signed-in users whose email is in `ADMIN_EMAILS`. Create the first coupon from the browser console on the site while signed in as an admin:
```
fetch("/api/admin/coupons", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ code: "LAUNCH50", kind: "percent", value: 50, description: "Launch offer", maxRedemptions: 100 }),
}).then((r) => r.json()).then(console.log)
```
With curl, copy the `authjs.session-token` (or `__Secure-authjs.session-token`) cookie from the browser and send `-H "Cookie: __Secure-authjs.session-token=<value>"` with `curl -X POST https://<domain>/api/admin/coupons -H "Content-Type: application/json" -d '{"code":"FREEYEAR","kind":"free_access","grantsPlan":"pro","grantDays":365,"maxRedemptions":10}'`.

`kind` is `percent` (value 1-100), `fixed` (value in minor units plus a 3-letter `currency`) or `free_access` (redeemed via `POST /api/coupons/redeem`, creates an entitlement). `PATCH /api/admin/coupons` with `{ "code": "...", "active": false }` deactivates one. `hasActivePlan(userId, plan)` in `lib/entitlements.ts` is ready for paywalls; no content is gated yet. Run `npm run db:migrate` to apply the coupon, entitlement and auth-attempt tables before use.

## 8. Redeploy
Redeploy after adding env vars (they apply to new deployments only).

## Troubleshooting
- **`MissingSecret` / 500 on `/api/auth/*`**: `AUTH_SECRET` is not set in this environment. Add it and redeploy.
- **`redirect_uri_mismatch` (Google) or "redirect_uri is not associated" (GitHub)**: the callback URL registered with the provider does not exactly match `https://<domain>/api/auth/callback/<provider>`. Check scheme, domain (no trailing slash) and provider name.
- **`vercel env pull` gives empty values**: variables marked Sensitive cannot be pulled. Copy `DATABASE_URL` from the Neon dashboard into `.env.local`, or unmark it as sensitive.
- **`drizzle-kit` says url is undefined / fails to connect**: `DATABASE_URL` is missing in the shell and `.env.local`. `db:generate` also reads the config, so set any placeholder URL for it.
- **Dialog says accounts are being set up**: `DATABASE_URL` is not set in this environment, or `/api/auth/status` failed.
- **No GitHub/Google buttons**: that provider does not have both ID and secret set.
