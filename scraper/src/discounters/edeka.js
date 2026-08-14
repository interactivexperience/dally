import { withPage } from '../lib/browser.js'

/**
 * Edeka-Scraper (Grundgerüst, NICHT verifiziert).
 *
 * TODO vor der ersten Nutzung: Selektoren UND URL sind geraten, nicht gegen
 * die echte Seite geprüft (siehe rewe.js für den Verifizierungs-Ablauf:
 * echte HTML-Schnipsel einer Angebotskarte + der Marktauswahl liefern).
 *
 * TODO wichtig: Edeka ist genossenschaftlich organisiert, Angebote/Websites
 * können sich je nach regionalem Edeka-Verbund unterscheiden (z. B.
 * Edeka Rhein-Ruhr, Edeka Minden-Hannover für NRW/Münster) - eventuell
 * andere Domain/Struktur als edeka.de selbst.
 *
 * branchConfig.sucheParam wird vorerst als PLZ angenommen, siehe
 * scraper/config/branches.json.
 */
export const id = 'edeka'
export const name = 'Edeka'

export async function scrape(branchConfig) {
  const url = `https://www.edeka.de/angebote/index.jsp?searchterm=${encodeURIComponent(branchConfig.sucheParam)}` // TODO verifizieren

  return withPage(url, async (page) => {
    const kartenSelektor = '[data-testid="offer-tile"]' // TODO verifizieren, reine Vermutung

    await page.waitForSelector(kartenSelektor, { timeout: 15_000 }).catch(() => {})

    const rohangebote = await page.$$eval(kartenSelektor, (karten) =>
      karten.map((karte) => ({
        titel: karte.querySelector('[data-testid="offer-title"]')?.textContent?.trim() || '',
        beschreibung:
          karte.querySelector('[data-testid="offer-subtitle"]')?.textContent?.trim() || '',
        preisText: karte.querySelector('[data-testid="offer-price"]')?.textContent?.trim() || '',
        alterPreisText:
          karte.querySelector('[data-testid="offer-old-price"]')?.textContent?.trim() || '',
        einheit: karte.querySelector('[data-testid="offer-unit"]')?.textContent?.trim() || '',
        bildUrl: karte.querySelector('img')?.getAttribute('src') || null,
      })),
    )

    if (rohangebote.length === 0) {
      throw new Error(
        `Keine Angebote gefunden - Selektor "${kartenSelektor}" liefert nichts. ` +
          'Unverifizierter Platzhalter-Scraper, siehe TODOs oben.',
      )
    }

    return rohangebote
      .filter((o) => o.titel)
      .map((o) => ({
        titel: o.titel,
        beschreibung: o.beschreibung,
        preis: parsePreis(o.preisText),
        alterPreis: parsePreis(o.alterPreisText),
        einheit: o.einheit || null,
        gueltigVon: null,
        gueltigBis: null,
        bildUrl: o.bildUrl,
      }))
  })
}

function parsePreis(text) {
  if (!text) return null
  const bereinigt = text.replace(/[^\d,.-]/g, '').replace(',', '.')
  const wert = parseFloat(bereinigt)
  return Number.isFinite(wert) ? wert : null
}
