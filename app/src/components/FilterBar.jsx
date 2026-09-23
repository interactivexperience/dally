import { useTranslation } from 'react-i18next'

export default function FilterBar({
  query,
  onQueryChange,
  discounters,
  selectedDiscounterId,
  onDiscounterChange,
}) {
  const { t } = useTranslation()
  const optionen = [{ id: '', name: t('offers.allDiscounters') }, ...discounters]

  return (
    <div className="mt-7">
      <label htmlFor="offer-search" className="sr-only">
        {t('offers.searchLabel')}
      </label>
      {/* Suchfeld ohne Kasten, nur eine Unterlinie; beim Fokus wird sie dunkel und doppelt so stark. */}
      <div className="flex items-center gap-2.5 min-h-touch border-b border-feld focus-within:border-ink focus-within:shadow-[0_1px_0_0_theme(colors.ink)]">
        <svg
          viewBox="0 0 24 24"
          className="w-[0.9rem] h-[0.9rem] shrink-0 text-muted"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.8" y2="16.8" />
        </svg>
        <input
          id="offer-search"
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t('offers.searchPlaceholder')}
          // Mindestens 16px, sonst zoomt iOS Safari beim Antippen ins Feld.
          className="flex-1 min-w-0 bg-transparent py-2 text-[max(16px,0.944rem)] font-medium tracking-[-0.018em] placeholder:font-normal placeholder:text-muted focus:outline-none"
        />
      </div>

      {/* Umbrechen statt seitlich scrollen: Wischen darf nie der einzige Weg zu
          einem Händler sein (konzept.md Punkt 13). */}
      <div role="group" aria-label={t('offers.discounterLabel')} className="mt-3 flex flex-wrap gap-x-5">
        {optionen.map((d) => {
          const gewaehlt = d.id === selectedDiscounterId
          return (
            <button
              key={d.id || 'alle'}
              type="button"
              aria-pressed={gewaehlt}
              onClick={() => onDiscounterChange(d.id)}
              className="group min-h-touch flex items-end pb-2 focus-visible:outline-none"
            >
              <span
                className={`border-b-2 pb-1 text-[0.944rem] tracking-[-0.02em] group-focus-visible:border-dashed group-focus-visible:border-ink ${
                  gewaehlt ? 'border-ink font-bold text-ink' : 'border-transparent font-medium text-muted'
                }`}
              >
                {d.name}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
