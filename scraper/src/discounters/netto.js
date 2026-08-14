import { withPage } from '../lib/browser.js'

/**
 * Netto-Scraper (Grundgerüst, NICHT verifiziert).
 *
 * TODO vor der ersten Nutzung: Selektoren UND URL sind geraten, nicht gegen
 * die echte Seite geprüft (anders als rewe.js/dm.js, siehe dort für den
 * Verifizierungs-Ablauf: echte HTML-Schnipsel einer Angebotskarte + der
 * Marktauswahl liefern, dann hier eintragen).
 *
 * TODO wichtige Klärung VOR dem Verifizieren: "Netto" ist in Deutschland
 * doppelt vergeben - Netto Marken-Discount (schwarz-gelb, Hund-Logo,
 * netto-online.de) und Netto (rot-gelb, zu Edeka gehörend, Marktkauf-nah,
 * www.netto-online.de vs. www.netto.de). Muss geklärt werden, welcher der
 * beiden gemeint ist, bevor URL/Selektoren verifiziert werden.
 *
 * branchConfig.sucheParam wird vorerst als PLZ angenommen, siehe
 * scraper/config/branches.json.
 */
export const id = 'netto'
export const name = 'Netto'

export async function scrape(branchConfig) {
  const url = `https://www.netto-online.de/angebote/${encodeURIComponent(branchConfig.sucheParam)}` // TODO verifizieren

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
