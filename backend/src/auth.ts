import { APIError } from 'better-auth/api'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { env } from './config/env'
import { db } from './db'
import { isMailerConfigured, sendMail } from './lib/mailer'

const ALLOWED_EMAIL_DOMAINS = (env.ALLOWED_EMAIL_DOMAINS ?? '')
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean)

const isHttps = env.BETTER_AUTH_URL.startsWith('https://')

const TRUSTED_ORIGINS = env.CORS_ORIGIN
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

export const auth = betterAuth({
  appName: 'Avnac',
  baseURL: env.BETTER_AUTH_URL,
  basePath: '/auth',
  secret: env.BETTER_AUTH_SECRET,
  // BetterAuth rejects requests whose Origin header isn't in this list
  // ("Invalid origin"). Frontend deployments live on a different subdomain
  // than the API, so the API origin alone is not enough.
  trustedOrigins: TRUSTED_ORIGINS,
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  emailAndPassword: {
    enabled: true,
    sendResetPassword: isMailerConfigured()
      ? async ({ user, url }: { user: { email: string; name?: string }; url: string }) => {
          // BetterAuth's `url` points at the API; rewrite it to the public frontend
          // /reset-password page so the browser-side flow handles the token exchange.
          const frontend = env.FRONTEND_URL ?? env.CORS_ORIGIN.split(',')[0]?.trim() ?? ''
          let resetLink = url
          try {
            const u = new URL(url)
            const token = u.searchParams.get('token') ?? ''
            resetLink = `${frontend.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`
          } catch {
            // fall back to raw URL on parse failure
          }
          await sendMail({
            to: user.email,
            subject: 'Reset your Avnac password',
            text: `Hi ${user.name ?? 'there'},\n\nClick the link below to reset your Avnac password. It expires in 1 hour.\n\n${resetLink}\n\nIf you didn't request this, you can ignore this email.\n\n— Avnac`,
            html: `<p>Hi ${user.name ?? 'there'},</p><p>Click the link below to reset your Avnac password. It expires in 1 hour.</p><p><a href="${resetLink}">Reset password</a></p><p>If you didn't request this, you can ignore this email.</p><p>— Avnac</p>`,
          })
        }
      : undefined,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  advanced: isHttps
    ? {
        crossSubDomainCookies: { enabled: true },
        // sameSite must be 'none' for the cookie to be sent on cross-origin XHRs
        // from avnac.tridenteventgroup.ca to avnac-api.tridenteventgroup.ca.
        // 'lax' would only attach the cookie on top-level navigation.
        defaultCookieAttributes: { sameSite: 'none', secure: true, partitioned: false },
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
