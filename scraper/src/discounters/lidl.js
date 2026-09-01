import { withPage } from '../lib/browser.js'

/**
 * Lidl-Scraper (Blätterkatalog-Bildseiten, Proof of Concept).
 *
 * Zweistufig, beide Stufen verifiziert (14.08.2026):
 *
 * 1) Übersichtsseite https://www.lidl.de/c/online-prospekte/s10005610 enthält
 *    ein <script type="application/ld+json"> mit einem schema.org
 *    OfferCatalog aller aktuell verfügbaren Prospekte (Aktionsprospekt,
 *    Reiseprospekte, Lidl Connect, ...), inklusive echtem Namen, URL und
 *    Gültigkeitszeitraum (startDate/endDate) pro Eintrag. Damit lässt sich
 *    der aktuell gültige Wochenprospekt automatisch finden statt die
 *    URL wöchentlich von Hand zu pflegen (siehe findAktuellenFlyer unten).
 *    Die dort verlinkte URL zeigt auf "/ar/0" (Artikel-Landingpage), wird
 *    hier zur eigentlichen Blätteransicht "/view/flyer/page/1" umgebaut.
 *
 * 2) Blätteransicht: jede Seite ist ein
 *    <li data-pageid="..." class="page page--current ..."> mit einem Bild
 *    der kompletten gescannten Prospektseite (kein Preis im HTML, nur im
 *    Bild eingebrannt) plus positionierten Hotspot-Buttons pro Produkt:
 *      <img class="img" src="https://imgproxy.leaflets.schwarz/.../page-01_...jpg"
 *           alt="Seite 1 - Aktionsprospekt - 31.08.2026 – 05.09.2026">
 *      <section class="mediagroup" style="top: ...%; left: ...%; ...">
 *        <button aria-label="PARKSIDE® 20V Akku 4 Ah »PAP 204 A1« wird in der Seitenleiste geöffnet.">
 *      </section>
 *    Manche mediagroup-Sections enthalten statt eines Buttons einen <a>-Link
 *    (z. B. zu einem Rezept, aria-label "Link wird in einem neuen Fenster
 *    geöffnet.") - die werden über den `button`-Selektor automatisch
 *    ausgeschlossen.
 *
 * WICHTIGE EINSCHRÄNKUNG: kein Preis im HTML, nur im Bild eingebrannt. Die
 * Hotspots öffnen beim Klick eine Seitenleiste, die vermutlich per AJAX den
 * Preis nachlädt - TODO, noch nicht geprüft. Bis dahin: Angebote ohne
 * preis/alterPreis, dafür mit dem echten Seitenbild als bildUrl und einem
 * echten Gültigkeitszeitraum (aus dem alt-Text der Seite geparst).
 *
 * branchConfig.sucheParam wird aktuell NICHT verwendet - die Übersichtsseite
 * war in den bisher gesehenen Daten nicht filialspezifisch (region_id=0,
 * store_id=0). Falls sich das als falsch herausstellt, müsste hier noch ein
 * Filial-/Regionsparameter ergänzt werden.
 * TODO NICHT verifiziert: ob der "Nächste Seite"-Button am Prospekt-Ende
 * zuverlässig disabled/aria-disabled wird - MAX_SEITEN ist die Sicherheitsgrenze.
 */
export const id = 'lidl'
export const name = 'Lidl'

const UEBERSICHT_URL = 'https://www.lidl.de/c/online-prospekte/s10005610'
const MAX_SEITEN = 40

// eslint-disable-next-line no-unused-vars
export async function scrape(branchConfig) {
  return withPage(UEBERSICHT_URL, async (page) => {
    const flyerUrl = await findAktuelleFlyerUrl(page)
    if (!flyerUrl) {
      throw new Error(
        'Kein aktuell gültiger "Aktionsprospekt" in der JSON-LD-Übersicht gefunden - ' +
          'Struktur der Übersichtsseite vermutlich geändert.',
      )
    }

    await page.goto(flyerUrl, { waitUntil: 'domcontentloaded' })

    const rohangebote = []

    for (let i = 0; i < MAX_SEITEN; i++) {
      await page.waitForSelector('li.page--current img.img', { timeout: 15_000 }).catch(() => {})

      const seite = await page.evaluate(() => {
        const aktuell = document.querySelector('li.page--current')
        if (!aktuell) return null

        const img = aktuell.querySelector('img.img')
        const alt = img?.getAttribute('alt') || ''
        const daten = alt.match(/\d{2}\.\d{2}\.\d{4}/g) || []

        const titel = Array.from(aktuell.querySelectorAll('.mediagroup button[aria-label]'))
          .map((btn) => btn.getAttribute('aria-label') || '')
          .filter((label) => label.endsWith('wird in der Seitenleiste geöffnet.'))
          .map((label) => label.replace(/\s*wird in der Seitenleiste geöffnet\.$/, '').trim())

        return {
          bildUrl: img?.getAttribute('src') || null,
          gueltigVon: daten[0] || null,
          gueltigBis: daten[1] || null,
          titel,
        }
      })

      if (!seite) break

      for (const titel of seite.titel) {
        rohangebote.push({
          titel,
          beschreibung: '',
          preis: null,
          alterPreis: null,
          einheit: null,
          gueltigVon: parseDatum(seite.gueltigVon),
          gueltigBis: parseDatum(seite.gueltigBis),
          bildUrl: seite.bildUrl,
        })
      }

      const weiterButton = await page.$('button[aria-label="Nächste Seite"]')
      if (!weiterButton) break
      const deaktiviert = await weiterButton
        .evaluate((el) => el.disabled || el.getAttribute('aria-disabled') === 'true')
        .catch(() => true)
      if (deaktiviert) break

      await weiterButton.click()
      await page.waitForTimeout(800) // Seitenwechsel/Bild-Ladezeit abwarten
    }

    if (rohangebote.length === 0) {
      throw new Error(
        'Keine Angebote gefunden - Prospekt-Struktur vermutlich geändert oder ' +
          'Navigation zwischen Seiten fehlgeschlagen. Siehe TODOs oben.',
      )
    }

    return rohangebote
  })
}

async function findAktuelleFlyerUrl(page) {
  const jsonLdRaw = await page
    .$eval('script[type="application/ld+json"]', (el) => el.textContent)
    .catch(() => null)
  if (!jsonLdRaw) return null

  let katalog
  try {
    katalog = JSON.parse(jsonLdRaw)
  } catch {
    return null
  }

  const jetzt = new Date()
  const aktuell = (katalog.itemListElement || []).find((item) => {
    if (item['@type'] !== 'SaleEvent') return false
    if (!item.name?.startsWith('Aktionsprospekt')) return false
    const von = new Date(item.startDate)
    const bis = new Date(item.endDate)
    return jetzt >= von && jetzt <= bis
  })

  return aktuell ? aktuell.url.replace('/ar/0', '/view/flyer/page/1') : null
}

function parseDatum(ddmmyyyy) {
  if (!ddmmyyyy) return null
  const [tag, monat, jahr] = ddmmyyyy.split('.')
  return `${jahr}-${monat}-${tag}` // ISO-Datum (YYYY-MM-DD)
}
