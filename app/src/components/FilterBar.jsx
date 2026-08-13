import { useTranslation } from 'react-i18next'

export default function FilterBar({
  query,
  onQueryChange,
  discounters,
  selectedDiscounterId,
  onDiscounterChange,
}) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <div className="flex-1">
        <label htmlFor="offer-search" className="block font-medium mb-1">
          {t('offers.searchLabel')}
        </label>
        <input
          id="offer-search"
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t('offers.searchPlaceholder')}
          className="w-full min-h-touch px-3 py-2 border-2 border-ink/20 rounded-lg text-lg"
        />
      </div>
      <div>
        <label htmlFor="offer-discounter" className="block font-medium mb-1">
          {t('offers.discounterLabel')}
        </label>
        <select
          id="offer-discounter"
          value={selectedDiscounterId}
          onChange={(e) => onDiscounterChange(e.target.value)}
          className="w-full sm:w-56 min-h-touch px-3 py-2 border-2 border-ink/20 rounded-lg text-lg"
        >
          <option value="">{t('offers.allDiscounters')}</option>
          {discounters.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
