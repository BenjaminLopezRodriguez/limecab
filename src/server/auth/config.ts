import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import type { Provider } from "next-auth/providers";
import Apple from "next-auth/providers/apple";
import Discord from "next-auth/providers/discord";
import Google from "next-auth/providers/google";

import { env } from "@/env";
import { db } from "@/server/db";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from "@/server/db/schema";

const useSecureCookies = process.env.NODE_ENV === "production";
const cookiePrefix = useSecureCookies ? "__Secure-" : "";
/** Apple POSTs the callback from appleid.apple.com; Lax cookies are not sent on that POST. */
const sameSite = useSecureCookies ? ("none" as const) : ("lax" as const);

function oauthCookie(name: string, maxAge?: number) {
  return {
    name,
    options: {
      httpOnly: true,
      sameSite,
      path: "/",
      secure: useSecureCookies,
      ...(maxAge != null ? { maxAge } : {}),
    },
  };
}

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

const linkByEmail = { allowDangerousEmailAccountLinking: true } as const;

function oauthProviders(): Provider[] {
  const list: Provider[] = [Apple(linkByEmail), Google(linkByEmail)];
  if (env.AUTH_DISCORD_ID && env.AUTH_DISCORD_SECRET) {
    list.push(
      Discord({
        clientId: env.AUTH_DISCORD_ID,
        clientSecret: env.AUTH_DISCORD_SECRET,
        ...linkByEmail,
      }),
    );
  }
  return list;
}

export const authProviders = oauthProviders();

export const providerMap = authProviders.map((provider) => {
  const resolved = typeof provider === "function" ? provider() : provider;
  return { id: resolved.id, name: resolved.name };
});

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
  providers: authProviders,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  pages: {
    signIn: "/signin",
  },
  trustHost: true,
  cookies: {
    pkceCodeVerifier: oauthCookie(
      `${cookiePrefix}authjs.pkce.code_verifier`,
      60 * 15,
    ),
    state: oauthCookie(`${cookiePrefix}authjs.state`, 60 * 15),
    nonce: oauthCookie(`${cookiePrefix}authjs.nonce`),
    csrfToken: oauthCookie(
      `${useSecureCookies ? "__Host-" : ""}authjs.csrf-token`,
    ),
  },
  callbacks: {
    session: ({ session, user }) => ({
      ...session,
      user: {
        ...session.user,
        id: user.id,
      },
    }),
  },
} satisfies NextAuthConfig;
