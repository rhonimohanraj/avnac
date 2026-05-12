import nodemailer, { type Transporter } from 'nodemailer'
import { env } from '../config/env'

let cachedTransport: Transporter | null = null

function buildTransport(): Transporter | null {
  if (cachedTransport) return cachedTransport
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) return null
  const port = env.SMTP_PORT ?? 587
  cachedTransport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD,
    },
  })
  return cachedTransport
}

export type SendMailInput = {
  to: string
  subject: string
  text: string
  html?: string
}

export async function sendMail(input: SendMailInput): Promise<void> {
  const transport = buildTransport()
  if (!transport) {
    throw new Error(
      'SMTP not configured. Set SMTP_HOST + SMTP_PORT + SMTP_USER + SMTP_PASSWORD.',
    )
  }
  const from = env.SMTP_FROM ?? env.SMTP_USER!
  await transport.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  })
}

export function isMailerConfigured(): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD)
}
