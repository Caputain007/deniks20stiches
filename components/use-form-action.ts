'use client'

import { useState, useTransition } from 'react'

type State = { ok?: boolean; message?: string; error?: string } | null

/**
 * Submits a form to a Server Action without React's automatic form reset, so a
 * rejected form keeps what the person typed. Pass resetOnSuccess to clear it
 * after a successful save (e.g. password fields).
 */
export function useFormAction<S extends State>(
  action: (prev: S, formData: FormData) => Promise<S>,
  options: { resetOnSuccess?: boolean } = {},
) {
  const [state, setState] = useState<S>(null as S)
  const [pending, startTransition] = useTransition()

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    startTransition(async () => {
      const result = await action(state, formData)
      setState(result)
      if (options.resetOnSuccess && result?.ok) form.reset()
    })
  }

  return { state, onSubmit, pending }
}
