import { withPage } from '../lib/browser.js'

/**
 * dm-Scraper (Proof of Concept, Phase 1).
 *
 * Bewusst reduzierter Umfang: dm.de hat keine flache "Produkt X kostet Y €"-
 * Angebotsseite wie REWE. Die Seite https://www.dm.de/neu/aktionen zeigt
 * stattdessen ein Raster aus Marketing-Kampagnen-Kacheln (z. B. "Viss- oder
 * Domestos-Produkt bis 31.08. geschenkt"), die auf eigene Kampagnen-
 * Unterseiten verlinken - meist ohne einen einzelnen, klaren Produktpreis
 * (z. B. "2 kaufen, 1 geschenkt"). Für Phase 1 werden diese Kacheln deshalb
 * nur als Info-Angebote ohne Preis übernommen (preis/alterPreis bleiben
 * leer) - kein Produktvergleich, nur "es gibt gerade diese Aktion bei dm".
 * Echte Preis-Angebote pro Kampagne wären ein deutlich größerer Umbau (jede
 * Kampagnen-Unterseite einzeln auswerten, siehe konzept.md-Notiz dazu).
 *
 * Teaser-Kachel-Struktur verifiziert (14.08.2026, echte Kachel von
 * dm.de/neu/aktionen):
 *   <div data-dmid="teaser">
 *     <a aria-label="Viss- oder Domestos-Produkt bis 31.08. geschenkt" href="/neu/aktionen/...">
 *       <img src="...">
 *     </a>
 *   </div>
 *
 * Bisher NICHT verifiziert: ob dm.de/neu/aktionen filial-/PLZ-spezifisch
 * ist. Marketing-Kampagnen sind typischerweise bundesweit einheitlich -
 * branchConfig wird deshalb nur für die branchIds-Zuordnung im Datenmodell
 * verwendet, nicht für die URL. Falls sich dm.de doch filialspezifisch
 * verhält, muss das hier nachgezogen werden.
 */
export const id = 'dm'
export const name = 'dm'

const AKTIONEN_URL = 'https://www.dm.de/neu/aktionen'

// eslint-disable-next-line no-unused-vars
export async function scrape(branchConfig) {
  return withPage(AKTIONEN_URL, async (page) => {
    const kartenSelektor = '[data-dmid="teaser"]'

    await page.waitForSelector(kartenSelektor, { timeout: 15_000 }).catch(() => {})

    const rohangebote = await page.$$eval(kartenSelektor, (karten) =>
      karten.map((karte) => {
        const link = karte.querySelector('a[aria-label]')
        return {
          titel: link?.getAttribute('aria-label')?.trim() || link?.textContent?.trim() || '',
          bildUrl: karte.querySelector('img')?.getAttribute('src') || null,
        }
      }),
    )

    if (rohangebote.length === 0) {
      throw new Error(
        `Keine Aktionen gefunden - Selektor "${kartenSelektor}" liefert nichts. ` +
          'Markup vermutlich geändert, Scraper muss angepasst werden.',
      )
    }

    return rohangebote
      .filter((o) => o.titel)
      .map((o) => ({
        titel: o.titel,
        beschreibung: '',
        preis: null,
        alterPreis: null,
        einheit: null,
        gueltigVon: null,
        gueltigBis: null, // TODO: manche Titel enthalten ein Datum im Text (z. B. "bis 31.08.") - bisher nicht geparst
        bildUrl: o.bildUrl,
      }))
  })
}
