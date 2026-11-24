'use client'

import { useFormAction } from '@/components/use-form-action'
import { login } from '@/app/actions/admin-auth'

export function LoginForm() {
  const { state, onSubmit, pending } = useFormAction(login)
  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      {state?.error && (
        <p role="alert" className="text-sm font-semibold text-rose">
          {state.error}
        </p>
      )}
      <div>
        <label htmlFor="l-email" className="field-label">
          Email
        </label>
        <input id="l-email" name="email" type="email" autoComplete="username" required className="field" />
      </div>
      <div>
        <label htmlFor="l-password" className="field-label">
          Password
        </label>
        <input
          id="l-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="field"
        />
      </div>
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
