import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { collection, getDocs, orderBy, query, limit } from 'firebase/firestore'
import { db } from '../lib/firebase.js'
import { useAuth } from '../lib/auth.jsx'
import FilterBar from '../components/FilterBar.jsx'
import OfferCard, { PASTELL_KLASSEN } from '../components/OfferCard.jsx'

// ISO-8601-Kalenderwoche, wie in Deutschland üblich: die Woche beginnt montags,
// KW 1 ist die Woche mit dem 4. Januar.
function kalenderwoche(datum) {
  const d = new Date(Date.UTC(datum.getFullYear(), datum.getMonth(), datum.getDate()))
  const wochentag = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - wochentag)
  const jahresbeginn = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d - jahresbeginn) / 86400000 + 1) / 7)
}

export default function Home() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [offers, setOffers] = useState([])
  const [discounters, setDiscounters] = useState([])
  const [loading, setLoading] = useState(true)
  const [queryText, setQueryText] = useState('')
  const [discounterId, setDiscounterId] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [offersSnap, discountersSnap] = await Promise.all([
        // "Diese Woche neu"-Startansicht: neueste zuerst (konzept.md Punkt 5).
        // Themen-Hervorhebung nach Interessen folgt in Phase 2 mit Gemini-Kategorisierung.
        getDocs(query(collection(db, 'offers'), orderBy('hinzugefuegtAm', 'desc'), limit(200))),
        getDocs(collection(db, 'discounters')),
      ])
      setOffers(offersSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setDiscounters(discountersSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }
    load()
  }, [])

  const discounterName = useMemo(() => {
    const map = new Map(discounters.map((d) => [d.id, d.name]))
    return (id) => map.get(id) || id
  }, [discounters])

  // Farben nach sortierter ID vergeben statt per Hash: so bekommen bis zu acht
  // Händler garantiert verschiedene Pastelltöne, und die Zuordnung bleibt stabil.
  const pastellFuer = useMemo(() => {
    const ids = discounters.map((d) => d.id).sort()
    const map = new Map(ids.map((id, i) => [id, PASTELL_KLASSEN[i % PASTELL_KLASSEN.length]]))
    return (id) => map.get(id) || PASTELL_KLASSEN[0]
  }, [discounters])

  const gefiltert = useMemo(() => {
    const suchbegriff = queryText.trim().toLowerCase()
    return offers.filter((offer) => {
      if (discounterId && offer.discounterId !== discounterId) return false
      if (!suchbegriff) return true
      const haystack = `${offer.titel || ''} ${offer.beschreibung || ''}`.toLowerCase()
      return haystack.includes(suchbegriff)
    })
  }, [offers, queryText, discounterId])

  const kopfzeile = [profile?.stadt, t('offers.week', { week: kalenderwoche(new Date()) })].filter(Boolean)

  return (
    <div>
      <p className="versalien">{kopfzeile.join(' · ')}</p>
      <h1 className="schlagzeile mt-2">{t('offers.title')}</h1>

      <FilterBar
        query={queryText}
        onQueryChange={setQueryText}
        discounters={discounters}
        selectedDiscounterId={discounterId}
        onDiscounterChange={setDiscounterId}
      />

      <section aria-labelledby="angebote-anzahl" className="mt-8">
        <h2 id="angebote-anzahl" className="versalien" aria-live="polite">
          {loading ? t('offers.loading') : t('offers.count', { count: gefiltert.length })}
        </h2>

        {!loading && gefiltert.length === 0 && (
          <p className="mt-4 border-t border-linie pt-4 text-muted">{t('offers.empty')}</p>
        )}

        <ul className="mt-3">
          {gefiltert.map((offer) => (
            <li key={offer.id}>
              <OfferCard
                offer={offer}
                discounterName={discounterName(offer.discounterId)}
                pastell={pastellFuer(offer.discounterId)}
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
