import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'

import { supabase } from '@/shared/lib/supabase'

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginValues = z.infer<typeof loginSchema>

const fieldClasses =
  'w-full rounded-md border border-gray-100 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gold focus:ring-1 focus:ring-gold'

export function LoginPage() {
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    })
    if (error) {
      setFormError(error.message)
      return
    }
    navigate('/dashboard', { replace: true })
  })

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy px-4">
      <div className="w-full max-w-md rounded-lg border-2 border-gold bg-white p-8 shadow-xl">
        <h1 className="mb-8 text-center font-sans text-3xl font-bold text-gold">
          Revploy
        </h1>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className={fieldClasses}
              {...register('email')}
            />
            {errors.email && (
              <p className="mt-1 text-sm text-danger">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className={fieldClasses}
              {...register('password')}
            />
            {errors.password && (
              <p className="mt-1 text-sm text-danger">
                {errors.password.message}
              </p>
            )}
          </div>

          {formError && (
            <p className="text-sm text-danger" role="alert">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy-light disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
