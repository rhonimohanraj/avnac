import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { requestPasswordReset } from '../lib/avnac-server-api'

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const redirectTo = `${window.location.origin}/reset-password`
      await requestPasswordReset(email.trim(), redirectTo)
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-neutral-50 px-4 py-10">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl ring-1 ring-black/[0.05]">
        <h1 className="text-2xl font-semibold tracking-tight">Forgot password</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Enter your email and we'll send a reset link.
        </p>

        {sent ? (
          <div className="mt-6 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
            If an account exists for <span className="font-medium">{email}</span>, we just
            emailed a password-reset link. Check your inbox (and spam folder).
          </div>
        ) : (
          <form
            className="mt-6 space-y-3"
            onSubmit={e => {
              e.preventDefault()
              void submit()
            }}
          >
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-700">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-700 focus:outline-none"
                placeholder="you@tridenteventgroup.ca"
              />
            </label>

            {error ? (
              <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="mt-2 w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-60"
            >
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-neutral-500">
          Remembered it?{' '}
          <Link to="/sign-in" className="font-medium text-neutral-900 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
