# Deploy to Vercel (with optional accounts)

Accounts are optional. Without any auth env vars the site is fully readable and the Sign in button is hidden; progress stays in the browser.

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
`AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `NEXT_PUBLIC_SITE_URL` (for example `https://architectlens.com`). `DATABASE_URL` comes from Neon.

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

## 7. Redeploy
Redeploy after adding env vars (they apply to new deployments only).

## Troubleshooting
- **`MissingSecret` / 500 on `/api/auth/*`**: `AUTH_SECRET` is not set in this environment. Add it and redeploy.
- **`redirect_uri_mismatch` (Google) or "redirect_uri is not associated" (GitHub)**: the callback URL registered with the provider does not exactly match `https://<domain>/api/auth/callback/<provider>`. Check scheme, domain (no trailing slash) and provider name.
- **`vercel env pull` gives empty values**: variables marked Sensitive cannot be pulled. Copy `DATABASE_URL` from the Neon dashboard into `.env.local`, or unmark it as sensitive.
- **`drizzle-kit` says url is undefined / fails to connect**: `DATABASE_URL` is missing in the shell and `.env.local`. `db:generate` also reads the config, so set any placeholder URL for it.
- **Sign in button missing**: no provider has both ID and secret set, or `/api/auth/providers` returns an error.
