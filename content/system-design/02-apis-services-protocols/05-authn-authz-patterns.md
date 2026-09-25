---
title: "AuthN/AuthZ Patterns: OAuth2, JWT, and Session-Based Auth"
short_title: "AuthN/AuthZ Patterns"
tags: ["authentication", "authorization", "oauth2", "jwt", "system-design"]
sources:
  - "RFC 6749 — The OAuth 2.0 Authorization Framework"
  - "RFC 7519 — JSON Web Token (JWT)"
  - "RFC 6750 — OAuth 2.0 Bearer Token Usage"
  - "OWASP Authentication Cheat Sheet"
---

## Authentication vs. authorization

**Authentication (AuthN)** answers "who is this?" — verifying an identity claim. **Authorization (AuthZ)** answers "what can they do?" — checking permissions once identity is established. Systems conflate these constantly (a JWT that's valid proves *who*, not automatically *what*), and most real security bugs live in that gap: a service that trusts a valid token's claims without separately checking whether that identity is allowed to perform the specific action on the specific resource.

## Session-based auth

The traditional model: on login, the server creates a session record (server-side state, usually in Redis or a database) and hands the client an opaque **session ID** in a cookie. Every subsequent request sends the cookie; the server looks up the session ID to recover identity and state.

- **Pros**: trivially revocable (delete the session record — access is gone instantly), no sensitive data in the token itself, well-understood cookie security model (`HttpOnly`, `Secure`, `SameSite` flags mitigate XSS/CSRF).
- **Cons**: requires server-side state, which complicates horizontal scaling (sessions need a shared store, not per-instance memory) and doesn't fit stateless, cross-domain API consumers well.

This is still the right default for traditional server-rendered web apps where the client and auth server are the same system.

## Token-based auth: JWT

A **JWT** (RFC 7519) is a self-contained, signed token: base64url-encoded header, payload (claims), and signature, joined by dots (`header.payload.signature`). The payload carries claims like `sub` (subject/user ID), `exp` (expiration), and application-specific data (roles, tenant ID). Because the signature (HMAC or RSA/ECDSA, per the `alg` header) lets any service verify authenticity without a database round trip, JWTs are the standard for stateless, distributed authentication — a downstream microservice validates the signature locally instead of calling back to an auth service for every request.

The trade-off is the mirror image of sessions: **revocation is hard**. A JWT is valid until it expires, full stop — there's no server-side record to delete. Mitigations, each with real cost:

- **Short expiry (minutes) + refresh tokens.** The access token is short-lived; a longer-lived refresh token (which *is* revocable, since it's checked against a store) is exchanged for new access tokens. This is the standard pattern in OAuth2 flows.
- **Token blocklists.** Defeats the "no DB lookup" benefit for revoked tokens specifically, but keeps it for the common case.
- **`alg: none` and algorithm confusion are the classic JWT vulnerabilities** — a library that trusts the `alg` header from an untrusted token can be tricked into skipping signature verification entirely, or into verifying an RSA-signed token as if it were HMAC-signed using the public key as the HMAC secret. Production JWT libraries mitigate this by requiring the verifier to pin the expected algorithm rather than trusting the token's own header.

## OAuth2: delegated authorization

**OAuth2** (RFC 6749) is not an authentication protocol — it's a framework for **delegated authorization**: letting a third-party application act on a user's behalf against a resource server, without that app ever seeing the user's credentials. The canonical example: "Sign in with Google" granting a calendar app read access to your Google Calendar.

Key roles: **resource owner** (the user), **client** (the third-party app), **authorization server** (issues tokens, e.g., Google's OAuth endpoint), **resource server** (the API being accessed).

The relevant grant types:

- **Authorization Code** (with PKCE for public clients like SPAs and mobile apps) — the standard flow. The client redirects the user to the authorization server, gets back a short-lived code via redirect, and exchanges that code (plus a client secret, or a PKCE code verifier) for tokens via a back-channel request. This keeps tokens out of the browser history/redirect URL.
- **Client Credentials** — machine-to-machine auth with no user involved; a service authenticates as itself using its own client ID/secret.
- **Implicit grant** — returned tokens directly in the redirect fragment, no code exchange. Deprecated by the OAuth2 Security Best Current Practice (BCP) in favor of Authorization Code + PKCE, because tokens in a URL fragment are exposed to browser history and referrer leaks.

A common point of confusion: **OpenID Connect (OIDC)** is a thin identity layer *on top of* OAuth2 that adds the missing authentication piece — an `id_token` (itself a JWT) that asserts who the user is, distinct from OAuth2's `access_token`, which only grants delegated access to resources.

## Common mistakes

- **Using OAuth2 access tokens as proof of identity.** An access token authorizes API calls; it doesn't reliably assert who the user is unless the flow is actually OIDC and you're validating the `id_token`.
- **Storing JWTs in `localStorage`.** Accessible to any JavaScript on the page, making them vulnerable to XSS-based theft; an `HttpOnly` cookie is safer for browser clients.
- **Trusting the JWT `alg` header instead of pinning the expected algorithm** at verification time — the root cause of most JWT library CVEs.
- **No token expiry, or excessively long-lived access tokens**, which turns any leak (logs, browser history, a compromised client) into standing, hard-to-revoke access.
