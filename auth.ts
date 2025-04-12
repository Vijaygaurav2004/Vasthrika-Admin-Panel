import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { adminAuth } from "./lib/firebase/admin";

export const authConfig: NextAuthConfig = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      try {
        // Verify if the user's email is in the allowed admins list
        const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
        if (!adminEmails.includes(user.email!)) {
          return false;
        }

        // Create or update the user in Firebase Auth
        try {
          await adminAuth.getUserByEmail(user.email!);
        } catch (error) {
          // If the user doesn't exist in Firebase, create them
          await adminAuth.createUser({
            email: user.email!,
            displayName: user.name!,
            photoURL: user.image!,
          });
        }

        return true;
      } catch (error) {
        console.error('Error in signIn callback:', error);
        return false;
      }
    },
    async session({ session, token }) {
      if (session?.user) {
        session.user.id = token.sub!;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig); 