import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'

function IconPreisschild() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="tabbar-icon"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.5 12.2V5a1.5 1.5 0 0 1 1.5-1.5h7.2a1.5 1.5 0 0 1 1.06.44l7.3 7.3a1.5 1.5 0 0 1 0 2.12l-7.2 7.2a1.5 1.5 0 0 1-2.12 0l-7.3-7.3A1.5 1.5 0 0 1 3.5 12.2Z" />
      <circle cx="8.3" cy="8.3" r="1.4" />
    </svg>
  )
}

function IconRegler() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="tabbar-icon"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="4" y1="8" x2="20" y2="8" />
      <circle cx="15" cy="8" r="2.4" fill="currentColor" stroke="none" />
      <line x1="4" y1="16" x2="20" y2="16" />
      <circle cx="9" cy="16" r="2.4" fill="currentColor" stroke="none" />
    </svg>
  )
}

const TABS = [
  { to: '/', labelKey: 'nav.offers', Icon: IconPreisschild },
  { to: '/einstellungen', labelKey: 'nav.settings', Icon: IconRegler },
]

// Wie lange die Auswahl nach einem Tab-Wechsel noch als Linse schwebt,
// bevor sie sich wieder zur ruhigen Kapsel absenkt.
const LINSE_NACH_WECHSEL_MS = 380

export default function TabBar() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const aktiv = Math.max(
    0,
    TABS.findIndex((tab) => tab.to === pathname),
  )

  // Finger/Maus unten oder Tastaturfokus auf einem Tab: die Linse steht schon
  // dort, bevor die Navigation passiert - wie bei Apple.
  const [beruehrt, setBeruehrt] = useState(null)
  const [wechselt, setWechselt] = useState(false)
  const vorherAktiv = useRef(aktiv)
  const loslassTimer = useRef(null)

  useEffect(() => {
    if (vorherAktiv.current === aktiv) return undefined
    vorherAktiv.current = aktiv
    setWechselt(true)
    const timer = setTimeout(() => setWechselt(false), LINSE_NACH_WECHSEL_MS)
    return () => clearTimeout(timer)
  }, [aktiv])

  useEffect(() => () => clearTimeout(loslassTimer.current), [])

  // Beim Loslassen nicht sofort zurücksetzen: der Klick, der navigiert, kommt
  // erst danach. Setzt der Klick zurück, landet die Kapsel ohne Zwischenstopp
  // am neuen Tab; kommt kein Klick (Finger weggezogen), senkt der Timer die Linse ab.
  function loslassen() {
    clearTimeout(loslassTimer.current)
    loslassTimer.current = setTimeout(() => setBeruehrt(null), 150)
  }

  function abbrechen() {
    clearTimeout(loslassTimer.current)
    setBeruehrt(null)
  }

  const ziel = beruehrt ?? aktiv
  const linse = beruehrt !== null || wechselt

  return (
    <nav aria-label={t('nav.main')} className="tabbar">
      <span
        aria-hidden="true"
        className={`tabbar-auswahl${linse ? ' ist-linse' : ''}`}
        style={{ '--ziel': ziel }}
      />
      {TABS.map(({ to, labelKey, Icon }, index) => (
        <Link
          key={to}
          to={to}
          aria-current={index === aktiv ? 'page' : undefined}
          className={[
            'tabbar-tab',
            index === ziel && 'ist-ziel',
            linse && index === ziel && 'unter-linse',
          ]
            .filter(Boolean)
            .join(' ')}
          onPointerDown={() => {
            clearTimeout(loslassTimer.current)
            setBeruehrt(index)
          }}
          onPointerUp={loslassen}
          // Touch-Zeiger verlassen das Element erst beim Anheben, noch vor dem
          // Klick - dort übernimmt loslassen(). Nur die Maus kann wirklich weggehen.
          onPointerLeave={(e) => {
            if (e.pointerType === 'mouse') abbrechen()
          }}
          onPointerCancel={abbrechen}
          // Im selben Durchlauf zurücksetzen, in dem der Router navigiert - sonst
          // springt die Kapsel für einen Frame zum alten Tab zurück.
          onClick={abbrechen}
          onFocus={(e) => {
            if (e.currentTarget.matches(':focus-visible')) setBeruehrt(index)
          }}
          onBlur={abbrechen}
        >
          <span className="tabbar-inhalt">
            <Icon />
            <span className="tabbar-label">{t(labelKey)}</span>
          </span>
        </Link>
      ))}
    </nav>
  )
}
