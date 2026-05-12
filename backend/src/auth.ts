import { APIError } from 'better-auth/api'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { env } from './config/env'
import { db } from './db'

const ALLOWED_EMAIL_DOMAINS = (env.ALLOWED_EMAIL_DOMAINS ?? '')
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean)

const isHttps = env.BETTER_AUTH_URL.startsWith('https://')

export const auth = betterAuth({
  appName: 'Avnac',
  baseURL: env.BETTER_AUTH_URL,
  basePath: '/auth',
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  emailAndPassword: {
    enabled: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  advanced: isHttps
    ? {
        crossSubDomainCookies: { enabled: true },
        defaultCookieAttributes: { sameSite: 'lax', secure: true },
      }
    : undefined,
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (ALLOWED_EMAIL_DOMAINS.length === 0) return { data: user }
          const domain = user.email.split('@')[1]?.toLowerCase()
          if (!domain || !ALLOWED_EMAIL_DOMAINS.includes(domain)) {
            throw new APIError('BAD_REQUEST', {
              message: `Registration restricted to: ${ALLOWED_EMAIL_DOMAINS.join(', ')}`,
            })
          }
          return { data: user }
        },
      },
    },
  },
})
