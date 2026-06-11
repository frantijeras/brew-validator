import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth config used by middleware.
 * No PrismaAdapter, no bcrypt — only pages + callbacks.
 * The providers array is empty here; Credentials provider is added in auth.ts.
 */
export const authConfig: NextAuthConfig = {
  // Self-hosted (next start tras build de producción): Auth.js no confía en el
  // host por defecto fuera de `next dev`, lo que provoca UntrustedHost al
  // servir por localhost o por la IP de la LAN. Confiamos en el host del deploy.
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.isAdmin = (user as { isAdmin?: boolean }).isAdmin ?? false;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.isAdmin = (token.isAdmin as boolean) ?? false;
      }
      return session;
    },
  },
  providers: [],
};
