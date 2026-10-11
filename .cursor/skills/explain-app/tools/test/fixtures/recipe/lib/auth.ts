import NextAuth, { getServerSession, type NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";

export const authOptions: NextAuthOptions = {
  providers: [EmailProvider({ server: process.env.EMAIL_SERVER, from: process.env.EMAIL_FROM })],
  session: { strategy: "jwt" },
};

export const handler = NextAuth(authOptions);

export function getSession() {
  return getServerSession(authOptions);
}
