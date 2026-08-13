import { withPage } from '../lib/browser.js'

/**
 * REWE-Scraper (Proof of Concept, Phase 1).
 *
 * TODO vor dem ersten echten Lauf: Selektoren unten gegen die aktuelle
 * Live-Seite prüfen (Browser-DevTools, Rechtsklick > Untersuchen auf einer
 * Angebotskarte). rewe.de ist eine JS-gerenderte Seite und ändert Markup +
 * URL-Struktur regelmäßig (konzept.md Punkt 4) - das hier ist ein plausibler
 * Startpunkt, keine verifizierte Implementierung.
 *
 * branchConfig.sucheParam wird als Marktauswahl-Parameter erwartet
 * (z. B. PLZ oder Markt-ID), siehe scraper/config/branches.json.
 */
export const id = 'rewe'
export const name = 'REWE'

export async function scrape(branchConfig) {
  const url = `https://www.rewe.de/angebote/${encodeURIComponent(branchConfig.sucheParam)}/`

  return withPage(url, async (page) => {
    // TODO: Cookie-Banner ggf. wegklicken, falls er die Seite blockiert:
    // await page.getByRole('button', { name: /akzeptieren/i }).click().catch(() => {})

    const kartenSelektor = '[data-testid="offer-tile"]' // TODO verifizieren

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
        einheit: o.einheit || null,
        gueltigVon: null, // TODO: Gültigkeitszeitraum steht meist im Seitenkopf, nicht pro Karte
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
