import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/auth.jsx'

const SPRACHEN = [
  { code: 'de', label: 'Deutsch' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'en', label: 'English' },
]

const RADIEN_KM = [2, 5, 10, 20]

// Abschnitt = Haarlinie, Versalien-Marke, Inhalt. Keine Kästen, keine
// verschachtelten Container - eine Ebene.
function Abschnitt({ titel, children, als: Tag = 'section' }) {
  const Titel = Tag === 'fieldset' ? 'legend' : 'h2'
  return (
    <div className="border-t border-linie pt-5 pb-3">
      <Tag>
        <Titel className="versalien">{titel}</Titel>
        {children}
      </Tag>
    </div>
  )
}

// Eine Reihe Textschalter. Die Auswahl wird unterstrichen, nicht umrandet;
// beim Tastaturfokus wird die Unterlinie gestrichelt.
function Textschalter({ name, optionen, wert, onWahl }) {
  return (
    <div className="mt-1 flex flex-wrap gap-x-6">
      {optionen.map((o) => (
        <label key={o.wert} className="min-h-touch flex items-end pb-2 cursor-pointer">
          <input
            type="radio"
            name={name}
            value={o.wert}
            checked={wert === o.wert}
            onChange={() => onWahl(o.wert)}
            className="peer sr-only"
          />
          <span
            lang={o.lang}
            className={`border-b-2 border-transparent pb-1 font-medium tracking-[-0.02em] text-muted peer-checked:border-ink peer-checked:font-bold peer-checked:text-ink peer-focus-visible:border-dashed peer-focus-visible:border-ink ${o.groesse || 'text-[0.944rem]'}`}
          >
            {o.label}
          </span>
        </label>
      ))}
    </div>
  )
}

export default function Settings() {
  const { t } = useTranslation()
  const { user, profile, updateProfile, logout } = useAuth()

  if (!profile) return null

  return (
    <div>
      <p className="versalien">{t('app.name')}</p>
      <h1 className="schlagzeile mt-2 mb-8">{t('settings.title')}</h1>

      <Abschnitt titel={t('settings.language')} als="fieldset">
        <Textschalter
          name="sprache"
          wert={profile.sprache}
          onWahl={(sprache) => updateProfile({ sprache })}
          optionen={SPRACHEN.map((s) => ({ wert: s.code, label: s.label, lang: s.code }))}
        />
      </Abschnitt>

      <Abschnitt titel={t('settings.fontSize')} als="fieldset">
        {/* Jede Option zeigt sich in ihrer eigenen Größe - die Einstellung erklärt sich selbst. */}
        <Textschalter
          name="schriftgroesse"
          wert={profile.schriftgroesse}
          onWahl={(schriftgroesse) => updateProfile({ schriftgroesse })}
          optionen={[
            { wert: 'klein', label: t('settings.fontSizeSmall'), groesse: 'text-[0.778rem]' },
            { wert: 'normal', label: t('settings.fontSizeNormal'), groesse: 'text-[0.944rem]' },
            { wert: 'gross', label: t('settings.fontSizeLarge'), groesse: 'text-[1.167rem]' },
          ]}
        />
      </Abschnitt>

      <Abschnitt titel={t('settings.radius')} als="fieldset">
        <Textschalter
          name="umkreis"
          wert={profile.umkreisKm}
          onWahl={(umkreisKm) => updateProfile({ umkreisKm })}
          optionen={RADIEN_KM.map((km) => ({ wert: km, label: `${km} km` }))}
        />
      </Abschnitt>

      <Abschnitt titel={t('settings.location')}>
        <dl className="mt-3 flex items-baseline justify-between gap-4 text-[0.944rem] tracking-[-0.02em]">
          <dt className="font-medium">{t('settings.city')}</dt>
          <dd className="font-bold">{profile.stadt}</dd>
        </dl>
      </Abschnitt>

      <Abschnitt titel={t('settings.account')}>
        <div className="mt-1 flex items-center justify-between gap-4 text-[0.944rem] tracking-[-0.02em]">
          <span className="min-w-0 truncate font-medium">{profile.email || user?.email}</span>
          <button
            type="button"
            onClick={logout}
            className="min-h-touch shrink-0 font-bold underline decoration-2 underline-offset-4"
          >
            {t('nav.logout')}
          </button>
        </div>
      </Abschnitt>

      <p className="border-t border-linie pt-5 text-[0.722rem] text-muted">{t('settings.autosave')}</p>
    </div>
  )
}
