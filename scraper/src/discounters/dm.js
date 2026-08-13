import { withPage } from '../lib/browser.js'

/**
 * dm-Scraper (Proof of Concept, Phase 1).
 *
 * TODO vor dem ersten echten Lauf: Selektoren unten gegen die aktuelle
 * Live-Seite prüfen (Browser-DevTools). dm.de ist wie rewe.de JS-gerendert
 * und ändert Markup regelmäßig (konzept.md Punkt 4) - Startpunkt, keine
 * verifizierte Implementierung.
 *
 * branchConfig.sucheParam wird als Filial-/PLZ-Parameter der dm-Angebotsseite
 * erwartet, siehe scraper/config/branches.json.
 */
export const id = 'dm'
export const name = 'dm'

export async function scrape(branchConfig) {
  const url = `https://www.dm.de/angebote?searchParam=${encodeURIComponent(branchConfig.sucheParam)}`

  return withPage(url, async (page) => {
    const kartenSelektor = '[data-dmid="product-tile"]' // TODO verifizieren

    await page.waitForSelector(kartenSelektor, { timeout: 15_000 }).catch(() => {})

    const rohangebote = await page.$$eval(kartenSelektor, (karten) =>
      karten.map((karte) => ({
        titel: karte.querySelector('[data-dmid="product-title"]')?.textContent?.trim() || '',
        beschreibung:
          karte.querySelector('[data-dmid="product-description"]')?.textContent?.trim() || '',
        preisText: karte.querySelector('[data-dmid="price"]')?.textContent?.trim() || '',
        alterPreisText:
          karte.querySelector('[data-dmid="price-old"]')?.textContent?.trim() || '',
        bildUrl: karte.querySelector('img')?.getAttribute('src') || null,
      })),
    )

    if (rohangebote.length === 0) {
      throw new Error(
        `Keine Angebote gefunden - Selektor "${kartenSelektor}" liefert nichts. ` +
          'Markup vermutlich geändert, Scraper muss angepasst werden.',
      )
    }

    return rohangebote
      .filter((o) => o.titel)
      .map((o) => ({
        titel: o.titel,
        beschreibung: o.beschreibung,
        preis: parsePreis(o.preisText),
        alterPreis: parsePreis(o.alterPreisText),
        einheit: null,
        gueltigVon: null, // TODO: Gültigkeitszeitraum aus Seitenkopf ergänzen
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
