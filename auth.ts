import NextAuth, { type DefaultSession } from "next-auth";
import type { Provider } from "next-auth/providers";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { getDb } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

const providers: Provider[] = [];
if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) providers.push(GitHub);
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) providers.push(Google);

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
