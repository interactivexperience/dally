import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'

const NEU_TAGE = 7

// Kurze Teile der Versalienzeile ("BIS 27.09.") nie in sich umbrechen; lange
// (z. B. ausführliche Grundpreis-Angaben) dürfen, sonst ragen sie aus der Spalte.
const UNTEILBAR_BIS_ZEICHEN = 24

// Eine Pastellfarbe pro Händler (Home.jsx verteilt sie), damit man die Liste nach
// Händler überfliegen kann, ohne die Versalienzeile zu lesen. Volle Klassennamen,
// damit Tailwind sie beim Build findet.
export const PASTELL_KLASSEN = [
  'bg-pastell-sand',
  'bg-pastell-mint',
  'bg-pastell-butter',
  'bg-pastell-himmel',
  'bg-pastell-blush',
  'bg-pastell-flieder',
  'bg-pastell-salbei',
  'bg-pastell-rose',
]

function istNeu(hinzugefuegtAm) {
  if (!hinzugefuegtAm) return false
  const datum = hinzugefuegtAm.toDate ? hinzugefuegtAm.toDate() : new Date(hinzugefuegtAm)
  const alterInTagen = (Date.now() - datum.getTime()) / (1000 * 60 * 60 * 24)
  return alterInTagen <= NEU_TAGE
}

function formatDatum(wert, locale) {
  if (!wert) return null
  const datum = wert.toDate ? wert.toDate() : new Date(wert)
  // Ohne Jahr: es geht immer um die laufende Prospektwoche, und die Zeile bleibt kurz.
  return datum.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })
}

function IconPreisschild() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-[1.2rem] h-[1.2rem] text-muted"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.5 12.2V5a1.5 1.5 0 0 1 1.5-1.5h7.2a1.5 1.5 0 0 1 1.06.44l7.3 7.3a1.5 1.5 0 0 1 0 2.12l-7.2 7.2a1.5 1.5 0 0 1-2.12 0l-7.3-7.3A1.5 1.5 0 0 1 3.5 12.2Z" />
      <circle cx="8.3" cy="8.3" r="1.4" />
    </svg>
  )
}

function Vorschau({ offer, pastell }) {
  const { t } = useTranslation()
  // Scharfes Quadrat, kein Radius - Pastell als Farbe, nicht als verspielte Form.
  const flaeche = `w-12 h-12 shrink-0 flex items-center justify-center overflow-hidden ${pastell}`

  if (!offer.bildUrl) {
    return (
      <div className={flaeche} aria-hidden="true">
        <IconPreisschild />
      </div>
    )
  }

  return (
    <a
      href={offer.bildUrl}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={flaeche}
      aria-label={t('offers.viewOriginal')}
    >
      {/* Hotlink zum Original-Bild beim Händler, keine eigene Kopie (konzept.md Punkt 16).
          multiply färbt den weißen Fotohintergrund in das Pastell ein. */}
      <img src={offer.bildUrl} alt="" loading="lazy" className="w-full h-full object-contain mix-blend-multiply" />
    </a>
  )
}

export default function OfferCard({ offer, discounterName, pastell }) {
  const { t, i18n } = useTranslation()
  const neu = istNeu(offer.hinzugefuegtAm)
  const gueltigBis = formatDatum(offer.gueltigBis, i18n.language)
  const zahl = new Intl.NumberFormat(i18n.language, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const hatRabatt = offer.preis != null && offer.alterPreis != null && offer.alterPreis > offer.preis
  // Echtes Minuszeichen statt des Bindestrichs, den Intl liefert.
  const rabatt = hatRabatt
    ? `−${new Intl.NumberFormat(i18n.language, { style: 'percent' }).format(1 - offer.preis / offer.alterPreis)}`
    : null

  const meta = [
    discounterName,
    offer.einheit,
    gueltigBis && t('offers.validUntil', { date: gueltigBis }),
  ]
    .filter(Boolean)
    .map((text) => ({ text }))
  if (neu) meta.push({ text: t('offers.new'), betont: true })

  return (
    <article className="flex items-center gap-4 py-4 border-t border-linie">
      <Vorschau offer={offer} pastell={pastell} />

      <div className="flex-1 min-w-0">
        <h3 className="text-[0.944rem] font-semibold leading-snug tracking-[-0.02em] break-words">{offer.titel}</h3>
        {offer.beschreibung && (
          <p className="mt-0.5 text-[0.833rem] leading-snug text-muted line-clamp-2 break-words">
            {offer.beschreibung}
          </p>
        )}
        <p className="versalien mt-1.5 break-words">
          {meta.map(({ text, betont }, i) => (
            <Fragment key={i}>
              {/* Geschütztes Leerzeichen vor dem Punkt: umbrochen wird nur danach,
                  eine Zeile beginnt also nie mit "·". */}
              {i > 0 && ' · '}
              <span
                className={[text.length <= UNTEILBAR_BIS_ZEICHEN && 'whitespace-nowrap', betont && 'text-ink']
                  .filter(Boolean)
                  .join(' ')}
              >
                {text}
              </span>
            </Fragment>
          ))}
        </p>
      </div>

      {offer.preis != null && (
        <div className="shrink-0 text-right">
          {/* Das Eurozeichen steht nur für Screenreader: optisch trägt die Ziffer allein. */}
          <p className="text-[1.222rem] font-bold leading-tight tracking-[-0.03em] tabular-nums">
            {zahl.format(offer.preis)}
            <span className="sr-only"> €</span>
          </p>
          {/* Untereinander statt "statt 1,99 · −44 %" in einer Zeile: hält die
              Preisspalte schmal, damit Titel und Versalienzeile Platz haben. */}
          {offer.alterPreis != null && (
            <p className="mt-0.5 text-[0.722rem] font-medium leading-snug text-muted tabular-nums">
              {t('offers.originalPriceLabel', { price: zahl.format(offer.alterPreis) })}
              {rabatt && <span className="block">{rabatt}</span>}
            </p>
          )}
        </div>
      )}
    </article>
  )
}
