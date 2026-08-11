import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/db";
import { users, activityLog } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { decryptSecret, verifyToken } from "@/lib/totp";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        token: { label: "Authentication code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db.query.users.findFirst({
          where: eq(users.email, credentials.email as string),
        });

        if (!user || !user.isActive) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValid) return null;

        // Second factor: if the user has TOTP enabled, require a valid code.
        if (user.totpEnabled && user.totpSecret) {
          const code = (credentials.token as string) || "";
          let ok = false;
          try { ok = verifyToken(decryptSecret(user.totpSecret), code); } catch { ok = false; }
          if (!ok) return null;
        }

        // Audit: record the sign-in (never block login if logging fails)
        try {
          await db.insert(activityLog).values({
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            action: "login",
            entity: "auth",
            entityLabel: user.email,
            createdAt: new Date().toISOString(),
          });
        } catch { /* ignore */ }

        return {
          id: String(user.id),
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as unknown as { role: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        (session.user as unknown as { role: string }).role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
