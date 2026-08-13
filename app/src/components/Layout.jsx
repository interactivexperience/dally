import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'

export default function Layout({ children }) {
  const { t, i18n } = useTranslation()
  const { profile, logout } = useAuth()

  // Sprache und Schriftgröße kommen aus dem Nutzerprofil (konzept.md Punkt 13 + 14).
  useEffect(() => {
    if (profile?.sprache && profile.sprache !== i18n.language) {
      i18n.changeLanguage(profile.sprache)
    }
  }, [profile?.sprache, i18n])

  useEffect(() => {
    document.documentElement.setAttribute('data-font-size', profile?.schriftgroesse || 'normal')
    document.documentElement.lang = profile?.sprache || 'de'
  }, [profile?.schriftgroesse, profile?.sprache])

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-ink text-paper border-b-4 border-accent">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <span className="text-xl font-bold">{t('app.name')}</span>
          <nav className="flex items-center gap-2" aria-label={t('nav.offers')}>
            <Link
              to="/"
              className="min-h-touch min-w-touch px-3 py-2 rounded flex items-center hover:bg-white/10 focus-visible:bg-white/10"
            >
              {t('nav.offers')}
            </Link>
            <Link
              to="/einstellungen"
              className="min-h-touch min-w-touch px-3 py-2 rounded flex items-center hover:bg-white/10 focus-visible:bg-white/10"
            >
              {t('nav.settings')}
            </Link>
            <button
              type="button"
              onClick={logout}
              className="min-h-touch min-w-touch px-3 py-2 rounded flex items-center hover:bg-white/10 focus-visible:bg-white/10"
            >
              {t('nav.logout')}
            </button>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6">{children}</main>
    </div>
  )
}
