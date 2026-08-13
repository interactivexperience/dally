import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { collection, getDocs, orderBy, query, limit } from 'firebase/firestore'
import { db } from '../lib/firebase.js'
import FilterBar from '../components/FilterBar.jsx'
import OfferCard from '../components/OfferCard.jsx'

export default function Home() {
  const { t } = useTranslation()
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

  const gefiltert = useMemo(() => {
    const suchbegriff = queryText.trim().toLowerCase()
    return offers.filter((offer) => {
      if (discounterId && offer.discounterId !== discounterId) return false
      if (!suchbegriff) return true
      const haystack = `${offer.titel || ''} ${offer.beschreibung || ''}`.toLowerCase()
      return haystack.includes(suchbegriff)
    })
  }, [offers, queryText, discounterId])

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">{t('offers.newThisWeek')}</h1>
      <p className="text-ink/70 mb-4">{t('app.tagline')}</p>

      <FilterBar
        query={queryText}
        onQueryChange={setQueryText}
        discounters={discounters}
        selectedDiscounterId={discounterId}
        onDiscounterChange={setDiscounterId}
      />

      {loading && <p className="text-lg">{t('offers.loading')}</p>}

      {!loading && gefiltert.length === 0 && <p className="text-lg">{t('offers.empty')}</p>}

      <div className="flex flex-col gap-4">
        {gefiltert.map((offer) => (
          <OfferCard key={offer.id} offer={offer} discounterName={discounterName(offer.discounterId)} />
        ))}
      </div>
    </div>
  )
}
