import { withPage } from '../lib/browser.js'

/**
 * Edeka-Scraper (verifiziert, bewusst grober Umfang).
 *
 * Verifiziert (14.08.2026, echte Marktseite EDEKA HafenMarkt, Münster):
 *   https://www.edeka.de/maerkte/<marketid>/prospekte/
 * Diese Seite listet Prospekt-Teaser (z. B. "Angebote der Woche",
 * "SUUPER Angebote"), jeweils mit Titel, Vorschaubild und einem Link, der
 * ein Dialog-Fenster mit einem <iframe> zu blaetterkatalog.edeka.de öffnet.
 *
 * WICHTIGE EINSCHRÄNKUNG: Der Blätterkatalog selbst (blaetterkatalog.edeka.de)
 * ist eine rein Canvas-gerenderte Software - schlechter als bei Netto/Lidl,
 * denn hier gibt es NICHT EINMAL einen OCR-Text im alt-Attribut, nur nackte
 * Seitenbild-URLs ohne jede Beschriftung. Auf Nutzerentscheidung hin wird der
 * Katalog deshalb GAR NICHT geöffnet - stattdessen wird direkt von der
 * Marktseite je Prospekt-Teaser EIN Angebot übernommen ("wie es ist"): Titel
 * des Teasers, Vorschaubild (bk_1.jpg = erste Seite) als bildUrl, und der
 * auf der Marktseite angegebene Gültigkeitszeitraum. Keine einzelnen
 * Produkte/Preise, kein Durchblättern der Katalogseiten.
 *
 * TODO unklar: der Gültigkeitszeitraum steht nur EINMAL oben auf der Seite,
 * nicht pro Prospekt-Teaser - wird hier auf alle Teaser derselben Marktseite
 * angewendet, könnte bei mehreren Prospekten mit unterschiedlichen Zeiträumen
 * ungenau sein (bei den zwei gesehenen Teasern nicht überprüfbar, da nur ein
 * Zeitraum angegeben war).
 *
 * branchConfig.sucheParam wird als EDEKA-Markt-ID angenommen (z. B. "074952"),
 * siehe scraper/config/branches.json.
 */
export const id = 'edeka'
export const name = 'Edeka'

export async function scrape(branchConfig) {
  const url = `https://www.edeka.de/maerkte/${encodeURIComponent(branchConfig.sucheParam)}/prospekte/`

  return withPage(url, async (page) => {
    const rohangebote = await page.evaluate(() => {
      const gueltigP = Array.from(document.querySelectorAll('p')).find((p) =>
        p.textContent.includes('Gültig vom'),
      )
      const daten = gueltigP ? Array.from(gueltigP.querySelectorAll('strong')).map((el) => el.textContent.trim()) : []

      return Array.from(document.querySelectorAll('ul.grid > li')).map((li) => ({
        titel: li.querySelector('.autoformat h2, .autoformat h3')?.textContent?.trim() || '',
        beschreibung: li.querySelector('.autoformat p')?.textContent?.trim() || '',
        bildUrl: li.querySelector('img[alt^="Vorschau des Prospekts"]')?.getAttribute('src') || null,
        gueltigVonRoh: daten[0] || null,
        gueltigBisRoh: daten[1] || null,
      }))
    })

    if (rohangebote.length === 0) {
      throw new Error(
        'Keine Prospekt-Teaser auf der Marktseite gefunden - Struktur vermutlich geändert.',
      )
    }

    return rohangebote
      .filter((o) => o.titel)
      .map((o) => ({
        titel: o.titel,
        beschreibung: o.beschreibung,
        preis: null,
        alterPreis: null,
        einheit: null,
        gueltigVon: parseDatum(o.gueltigVonRoh),
        gueltigBis: parseDatum(o.gueltigBisRoh),
        bildUrl: o.bildUrl,
      }))
  })
}

function parseDatum(ddmmyyyy) {
  if (!ddmmyyyy) return null
  const [tag, monat, jahr] = ddmmyyyy.split('.')
  return `${jahr}-${monat}-${tag}` // ISO-Datum (YYYY-MM-DD)
}
