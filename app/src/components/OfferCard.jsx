import { useTranslation } from 'react-i18next'

const NEU_TAGE = 7

function istNeu(hinzugefuegtAm) {
  if (!hinzugefuegtAm) return false
  const datum = hinzugefuegtAm.toDate ? hinzugefuegtAm.toDate() : new Date(hinzugefuegtAm)
  const alterInTagen = (Date.now() - datum.getTime()) / (1000 * 60 * 60 * 24)
  return alterInTagen <= NEU_TAGE
}

function formatDatum(wert, locale) {
  if (!wert) return null
  const datum = wert.toDate ? wert.toDate() : new Date(wert)
  return datum.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function OfferCard({ offer, discounterName }) {
  const { t, i18n } = useTranslation()
  const neu = istNeu(offer.hinzugefuegtAm)
  const gueltigBis = formatDatum(offer.gueltigBis, i18n.language)

  return (
    <article className="bg-white border-2 border-ink/10 rounded-lg overflow-hidden flex gap-4 p-4">
      {offer.bildUrl && (
        <a
          href={offer.bildUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="shrink-0"
          aria-label={t('offers.viewOriginal')}
        >
          {/* Hotlink zum Original-Bild beim Händler, keine eigene Kopie (konzept.md Punkt 16) */}
          <img
            src={offer.bildUrl}
            alt={offer.titel}
            loading="lazy"
            className="w-24 h-24 object-cover rounded"
          />
        </a>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-bold leading-snug">{offer.titel}</h3>
          {neu && (
            <span className="shrink-0 bg-accent text-white text-sm font-bold px-2 py-1 rounded">
              {t('offers.new')}
            </span>
          )}
        </div>
        {discounterName && <p className="text-sm text-ink/70">{discounterName}</p>}
        {offer.beschreibung && <p className="mt-1">{offer.beschreibung}</p>}
        <div className="mt-2 flex items-baseline gap-2 flex-wrap">
          {offer.preis != null && (
            <span className="text-xl font-bold text-accentDark">
              {offer.preis.toFixed(2)} €
            </span>
          )}
          {offer.alterPreis != null && (
            <span className="line-through text-ink/50">
              {t('offers.originalPriceLabel', { price: offer.alterPreis.toFixed(2) })}
            </span>
          )}
          {offer.einheit && (
            <span className="text-ink/70">{t('offers.perUnit', { unit: offer.einheit })}</span>
          )}
        </div>
        {gueltigBis && (
          <p className="mt-1 text-sm text-ink/70">
            {t('offers.validUntil', { date: gueltigBis })}
          </p>
        )}
      </div>
    </article>
  )
}
