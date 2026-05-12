import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import {
  signInWithEmail,
  signUpWithEmail,
} from '../lib/avnac-server-api'

type Mode = 'sign-in' | 'sign-up'

type SignInSearch = {
  mode?: Mode
  next?: string
}

export const Route = createFileRoute('/sign-in')({
  validateSearch: (raw: Record<string, unknown>): SignInSearch => ({
    mode: raw.mode === 'sign-up' ? 'sign-up' : 'sign-in',
    next: typeof raw.next === 'string' ? raw.next : undefined,
  }),
  component: SignInPage,
})

function SignInPage() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const [mode, setMode] = useState<Mode>(search.mode ?? 'sign-in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      if (mode === 'sign-up') {
        if (name.trim().length === 0) {
          setError('Name is required.')
          return
        }
        await signUpWithEmail({ name: name.trim(), email: email.trim(), password })
      } else {
        await signInWithEmail(email.trim(), password)
      }
      const dest = search.next || '/library'
      void navigate({ to: dest as never })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-neutral-50 px-4 py-10">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl ring-1 ring-black/[0.05]">
        <h1 className="text-2xl font-semibold tracking-tight">
          {mode === 'sign-up' ? 'Join the TEG library' : 'Sign in'}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {mode === 'sign-up'
            ? 'Use your @tridenteventgroup.ca email.'
            : 'Welcome back.'}
        </p>

        <form
          className="mt-6 space-y-3"
          onSubmit={e => {
            e.preventDefault()
            void submit()
          }}
        >
          {mode === 'sign-up' ? (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-700">Name</span>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                autoComplete="name"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-700 focus:outline-none"
                placeholder="Rhoni Mohanraj"
              />
            </label>
          ) : null}
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
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-700">Password</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-700 focus:outline-none"
              placeholder="••••••••"
            />
          </label>

          {mode === 'sign-in' ? (
            <p className="text-right text-xs">
              <Link
                to="/forgot-password"
                className="text-neutral-600 hover:text-neutral-900 hover:underline"
              >
                Forgot password?
              </Link>
            </p>
          ) : null}

          {error ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="mt-2 w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-60"
          >
            {busy
              ? mode === 'sign-up'
                ? 'Creating account…'
                : 'Signing in…'
              : mode === 'sign-up'
                ? 'Create account'
                : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-neutral-500">
          {mode === 'sign-in' ? (
            <>
              No account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('sign-up')
                  setError(null)
                }}
                className="font-medium text-neutral-900 hover:underline"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('sign-in')
                  setError(null)
                }}
                className="font-medium text-neutral-900 hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </p>

        <p className="mt-4 text-center text-xs text-neutral-400">
          <Link to="/" className="hover:underline">
            ← Back home
          </Link>
        </p>
      </div>
    </main>
  )
}
