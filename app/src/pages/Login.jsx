import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'

// Feld ohne Kasten, nur Unterlinie - wie das Suchfeld. Mindestens 16px Schrift,
// sonst zoomt iOS Safari beim Antippen hinein.
const FELD =
  'mt-1 w-full min-h-touch bg-transparent border-b border-feld text-[max(16px,0.944rem)] font-medium tracking-[-0.018em] focus:outline-none focus:border-ink focus:shadow-[0_1px_0_0_theme(colors.ink)]'

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
    <main className="min-h-screen px-5 pt-[calc(env(safe-area-inset-top)+3.5rem)] pb-10">
      <div className="max-w-sm mx-auto">
        <p className="versalien">{t('app.name')}</p>
        <h1 className="schlagzeile mt-2">{t('login.title')}</h1>

        <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-6">
          <div>
            <label htmlFor="email" className="versalien">
              {t('login.email')}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={FELD}
            />
          </div>

          <div>
            <label htmlFor="password" className="versalien">
              {t('login.password')}
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={FELD}
            />
          </div>

          {status === 'error' && (
            <p role="alert" className="text-[0.944rem] font-semibold">
              {t('login.error')}
            </p>
          )}

          <button
            type="submit"
            disabled={status === 'loading'}
            className="mt-2 w-full min-h-touch rounded-full bg-ink py-3 text-[0.944rem] font-bold text-paper disabled:opacity-60"
          >
            {status === 'loading' ? t('login.loading') : t('login.submit')}
          </button>
        </form>
      </div>
    </main>
  )
}
