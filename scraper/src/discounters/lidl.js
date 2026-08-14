import { withPage } from '../lib/browser.js'

/**
 * Lidl-Scraper (Grundgerüst, NICHT verifiziert).
 *
 * TODO vor der ersten Nutzung: Selektoren UND URL sind geraten, nicht gegen
 * die echte Seite geprüft (siehe rewe.js für den Verifizierungs-Ablauf:
 * echte HTML-Schnipsel einer Angebotskarte + der Marktauswahl liefern).
 *
 * TODO wichtige Warnung VOR dem Verifizieren: Lidl zeigt Angebote vielerorts
 * als interaktiven "Prospekt"/Blätterkatalog (bildbasiert, oft über einen
 * eingebetteten Drittanbieter-Viewer statt normalem HTML), nicht zwingend
 * als einfache Kartenliste wie bei REWE. Falls das zutrifft, funktioniert
 * der CSS-Selektor-Ansatz hier vermutlich gar nicht und Lidl bräuchte einen
 * grundsätzlich anderen Ansatz (z. B. eine separate API des Viewers, falls
 * vorhanden) - das zuerst prüfen, bevor Zeit in Selektor-Feintuning geht.
 *
 * branchConfig.sucheParam wird vorerst als PLZ angenommen, siehe
 * scraper/config/branches.json.
 */
export const id = 'lidl'
export const name = 'Lidl'

export async function scrape(branchConfig) {
  const url = `https://www.lidl.de/c/angebote/${encodeURIComponent(branchConfig.sucheParam)}` // TODO verifizieren

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
          'Unverifizierter Platzhalter-Scraper, siehe TODOs oben (evtl. Blätterkatalog statt HTML-Liste).',
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
