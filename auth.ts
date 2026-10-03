import NextAuth, { CredentialsSignin, type DefaultSession } from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { clientIp, throttled } from "@/lib/throttle";
import { isValidEmail, normaliseEmail, verifyDummy, verifyPassword } from "@/lib/password";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

class RateLimited extends CredentialsSignin {
  code = "rate_limited";
}

const providers: Provider[] = [];
if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) providers.push(GitHub);
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) providers.push(Google);
if (process.env.DATABASE_URL) {
  providers.push(
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials, request) {
        const { email, password } = credentials;
        if (typeof email !== "string" || typeof password !== "string") return null;
        const normalised = normaliseEmail(email);
        if (!isValidEmail(normalised)) return null;
        if (await throttled([`login-ip:${clientIp(request)}`, `login-email:${normalised}`])) throw new RateLimited();
        const [user] = await getDb().select().from(users).where(eq(users.email, normalised)).limit(1);
        if (!user?.passwordHash) return verifyDummy(password);
        return (await verifyPassword(password, user.passwordHash)) ? { id: user.id, name: user.name, email: user.email, image: user.image } : null;
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  providers,
  adapter: process.env.DATABASE_URL
    ? DrizzleAdapter(getDb(), { usersTable: users, accountsTable: accounts, sessionsTable: sessions, verificationTokensTable: verificationTokens })
    : undefined,
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub!;
      return session;
    },
  },
}));
