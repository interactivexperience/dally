import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/auth.jsx'
import TabBar from './TabBar.jsx'

export default function Layout({ children }) {
  const { i18n } = useTranslation()
  const { profile } = useAuth()

  // Sprache und Schriftgröße kommen aus dem Nutzerprofil (konzept.md Punkt 13 + 14).
  useEffect(() => {
    if (profile?.sprache && profile.sprache !== i18n.language) {
      i18n.changeLanguage(profile.sprache)
    }
  }, [profile?.sprache, i18n])

  useEffect(() => {
    document.documentElement.setAttribute('data-font-size', profile?.schriftgroesse || 'normal')
    // Auch für die automatische Silbentrennung der großen Überschriften nötig.
    document.documentElement.lang = profile?.sprache || 'de'
  }, [profile?.schriftgroesse, profile?.sprache])

  return (
    <div className="min-h-screen">
      {/* Kein Kopfbalken: jede Seite beginnt mit ihrer eigenen Schlagzeile.
          Unten Platz lassen, damit die schwebende Tab-Leiste nichts verdeckt. */}
      <main className="max-w-xl mx-auto w-full px-5 pt-[calc(env(safe-area-inset-top)+2.5rem)] pb-[calc(env(safe-area-inset-bottom)+7.5rem)]">
        {children}
      </main>
      <TabBar />
    </div>
  )
}
