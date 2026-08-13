import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'

export default function Login() {
  const { t } = useTranslation()
  const { user, login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | error

  if (user) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus('loading')
    try {
      await login(email, password)
    } catch (err) {
      console.error(err)
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white border-2 border-ink/10 rounded-lg p-6"
      >
        <h1 className="text-2xl font-bold mb-6 text-center">{t('login.title')}</h1>

        <label htmlFor="email" className="block font-medium mb-1">
          {t('login.email')}
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full min-h-touch px-3 py-2 mb-4 border-2 border-ink/20 rounded-lg text-lg"
        />

        <label htmlFor="password" className="block font-medium mb-1">
          {t('login.password')}
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full min-h-touch px-3 py-2 mb-4 border-2 border-ink/20 rounded-lg text-lg"
        />

        {status === 'error' && (
          <p role="alert" className="mb-4 text-accentDark font-medium">
            {t('login.error')}
          </p>
        )}

        <button
          type="submit"
          disabled={status === 'loading'}
          className="w-full min-h-touch bg-accent text-white font-bold rounded-lg py-3 text-lg disabled:opacity-60"
        >
          {status === 'loading' ? t('login.loading') : t('login.submit')}
        </button>
      </form>
    </div>
  )
}
