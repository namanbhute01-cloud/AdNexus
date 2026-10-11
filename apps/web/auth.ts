import 'server-only';
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "@vaart/database"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { checkLoginRateLimit } from "@/lib/gallery/login-rate-limit"

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = z.object({
          email: z.string().email(),
          password: z.string().min(6),
        }).safeParse(credentials)

        if (!parsed.success) return null

        // T10: brute-force limiter, keyed on IP + email. Best-effort in-memory
        // (DECISIONS D8) — the event deployment is a single process.
        const limited = checkLoginRateLimit(parsed.data.email)
        if (!limited.allowed) return null

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email }
        })
        if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return null

        // Admin-only sign-in. The CAMPAIGNER enum value, its seeded rows and
        // CampaignerEVAccess are all deliberately left intact in the database
        // (INSTRUCTIONS T10) — they simply cannot obtain a session.
        if (user.role !== "ADMIN") return null

        return { id: user.id, email: user.email, name: user.name, role: user.role }
      }
    })
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) { 
        token.role = user.role; 
        token.id = user.id;
      }
      return token
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.role = token.role as typeof session.user.role
        session.user.id = token.id as string
      }
      return session
    }
  }
})
