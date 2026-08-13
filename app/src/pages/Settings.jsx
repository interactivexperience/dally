import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/auth.jsx'

const SPRACHEN = [
  { code: 'de', label: 'Deutsch' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'en', label: 'English' },
]

const RADIEN_KM = [2, 5, 10, 20]

export default function Settings() {
  const { t } = useTranslation()
  const { profile, updateProfile } = useAuth()

  if (!profile) return null

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-bold mb-6">{t('settings.title')}</h1>

      <fieldset className="mb-6">
        <legend className="font-medium mb-2">{t('settings.language')}</legend>
        <div className="flex flex-col gap-2">
          {SPRACHEN.map((s) => (
            <label key={s.code} className="flex items-center gap-3 min-h-touch">
              <input
                type="radio"
                name="sprache"
                value={s.code}
                checked={profile.sprache === s.code}
                onChange={() => updateProfile({ sprache: s.code })}
                className="w-6 h-6"
              />
              <span className="text-lg">{s.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mb-6">
        <legend className="font-medium mb-2">{t('settings.fontSize')}</legend>
        <div className="flex flex-col gap-2">
          {[
            ['klein', t('settings.fontSizeSmall')],
            ['normal', t('settings.fontSizeNormal')],
            ['gross', t('settings.fontSizeLarge')],
          ].map(([wert, label]) => (
            <label key={wert} className="flex items-center gap-3 min-h-touch">
              <input
                type="radio"
                name="schriftgroesse"
                value={wert}
                checked={profile.schriftgroesse === wert}
                onChange={() => updateProfile({ schriftgroesse: wert })}
                className="w-6 h-6"
              />
              <span className="text-lg">{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mb-6">
        <legend className="font-medium mb-2">{t('settings.radius')}</legend>
        <div className="flex gap-2 flex-wrap">
          {RADIEN_KM.map((km) => (
            <button
              key={km}
              type="button"
              onClick={() => updateProfile({ umkreisKm: km })}
              className={`min-h-touch min-w-touch px-4 rounded-lg border-2 text-lg font-medium ${
                profile.umkreisKm === km
                  ? 'bg-accent text-white border-accent'
                  : 'border-ink/20'
              }`}
            >
              {km} km
            </button>
          ))}
        </div>
      </fieldset>

      <p className="text-ink/70">
        {t('settings.city')}: {profile.stadt}
      </p>
    </div>
  )
}
