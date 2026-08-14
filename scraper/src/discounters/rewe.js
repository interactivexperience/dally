import { withPage } from '../lib/browser.js'

/**
 * REWE-Scraper (Proof of Concept, Phase 1).
 *
 * URL-Struktur verifiziert (14.08.2026, per Marktsuche-Dialog auf rewe.de):
 *   https://www.rewe.de/angebote/<stadt-slug>/<markt-id>/<markt-slug>/
 * branchConfig.sucheParam enthält genau diesen Pfad OHNE führenden/folgenden
 * Slash, z. B. "muenster-centrum/1940225/rewe-markt-wolbecker-str-44" - kein
 * einzelner PLZ-Parameter wie ursprünglich angenommen. Pro neuer Filiale:
 * auf rewe.de die Marktsuche benutzen, Markt auswählen, den Pfad aus der
 * resultierenden URL hier eintragen (siehe scraper/config/branches.json).
 *
 * Angebotskarten-Struktur verifiziert (14.08.2026, echte Karte von der
 * Angebotsseite REWE Markt Wolbecker Str. 44, Münster):
 *   <div data-testid="sos-offer-span" class="sos-offer" data-offer-id="..." data-category="markt-topangebote">
 *     <article class="cor-offer-renderer-tile">
 *       <img data-testid="offer-image" src="...">
 *       <a data-testid="offer-title-link">Produktname</a>
 *       <span class="cor-offer-information__additional">je 200-g-Glas</span>
 *       <span class="cor-offer-information__additional">, (1 kg = 9,95 €)</span>
 *       <div class="cor-offer-price__tag-price">1,99 €</div>
 *     </article>
 *   </div>
 * Kein Element für einen alten/durchgestrichenen Preis in dieser Kartenvariante
 * gesehen - REWE zeigt hier nur einen Aktionspreis samt Label ("Knaller" o.ä.),
 * keinen Vorher-Preis. alterPreis bleibt deshalb vorerst immer null.
 * data-category unterscheidet Abschnitte auf der Seite (z. B. "markt-topangebote")
 * - der Selektor unten ignoriert das bewusst, um alle Abschnitte zu erfassen.
 *
 * TODO: gueltigVon/gueltigBis stehen nicht auf der Karte selbst, vermutlich im
 * Seitenkopf/Zeitraum-Filter - noch nicht eingesehen.
 */
export const id = 'rewe'
export const name = 'REWE'

export async function scrape(branchConfig) {
  const url = `https://www.rewe.de/angebote/${branchConfig.sucheParam}/`

  return withPage(url, async (page) => {
    // TODO: Cookie-Banner ggf. wegklicken, falls er die Seite blockiert:
    // await page.getByRole('button', { name: /akzeptieren/i }).click().catch(() => {})

    const kartenSelektor = '[data-testid="sos-offer-span"]'

    await page.waitForSelector(kartenSelektor, { timeout: 15_000 }).catch(() => {})

    const rohangebote = await page.$$eval(kartenSelektor, (karten) =>
      karten.map((karte) => ({
        titel: karte.querySelector('[data-testid="offer-title-link"]')?.textContent?.trim() || '',
        einheit:
          karte.querySelector('.cor-offer-information__additional')?.textContent?.trim() || '',
        preisText: karte.querySelector('.cor-offer-price__tag-price')?.textContent?.trim() || '',
        bildUrl: karte.querySelector('[data-testid="offer-image"]')?.getAttribute('src') || null,
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
        beschreibung: '',
        preis: parsePreis(o.preisText),
        alterPreis: null,
        einheit: o.einheit || null,
        gueltigVon: null, // TODO: Gültigkeitszeitraum steht vermutlich im Seitenkopf, nicht pro Karte
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
