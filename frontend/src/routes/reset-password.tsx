import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { resetPassword } from '../lib/avnac-server-api'

type ResetSearch = {
  token?: string
  error?: string
}

export const Route = createFileRoute('/reset-password')({
  validateSearch: (raw: Record<string, unknown>): ResetSearch => ({
    token: typeof raw.token === 'string' ? raw.token : undefined,
    error: typeof raw.error === 'string' ? raw.error : undefined,
  }),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (search.error) {
      setError(decodeURIComponent(search.error))
    }
  }, [search.error])

  const submit = async () => {
    if (!search.token) {
      setError('Missing reset token in URL.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await resetPassword(search.token, password)
      setDone(true)
      setTimeout(() => {
        void navigate({ to: '/sign-in' as never })
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-neutral-50 px-4 py-10">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl ring-1 ring-black/[0.05]">
        <h1 className="text-2xl font-semibold tracking-tight">Reset password</h1>
        <p className="mt-1 text-sm text-neutral-500">Choose a new password.</p>

        {done ? (
          <div className="mt-6 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
            Password updated. Redirecting to sign-in…
          </div>
        ) : !search.token ? (
          <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            This link is missing or invalid. Request a fresh reset link from{' '}
            <Link to="/forgot-password" className="font-medium underline">
              Forgot password
            </Link>
            .
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
              <span className="mb-1 block text-xs font-medium text-neutral-700">
                New password
              </span>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-700 focus:outline-none"
                placeholder="••••••••"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-700">
                Confirm password
              </span>
              <input
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                autoComplete="new-password"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-700 focus:outline-none"
                placeholder="••••••••"
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
              {busy ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-neutral-500">
          <Link to="/sign-in" className="font-medium text-neutral-900 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
