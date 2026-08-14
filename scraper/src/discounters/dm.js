import { withPage } from '../lib/browser.js'

/**
 * dm-Scraper (Proof of Concept, Phase 1).
 *
 * Produktkarten-Struktur verifiziert (14.08.2026, echte Karte von dm.de):
 *   <div data-dmid="product-tile" data-dan="<produkt-id>">
 *     <a href="/p/d/<id>/<slug>"><img data-dmid="product-image-container" src="..."></a>
 *     <div data-dmid="product-description">
 *       <span data-dmid="product-brand">MARKE</span>
 *       <a href="/p/d/<id>/<slug>">Produktname</a>
 *     </div>
 *     <ins data-dmid="price-localized">1,55&nbsp;€</ins>
 *     <del data-dmid="price-sellout">2,45&nbsp;€</del>
 *     <div data-dmid="price-infos"><span>60 St (0,03 € je 1 St)</span></div>
 *   </div>
 * WICHTIG: [data-dmid="product-tile"] ist eine generische Produktkarte, die dm
 * für JEDES Produkt verwendet (Suche, Kategorien, Angebote) - nicht nur für
 * Angebote. Nur Karten mit einem [data-dmid="price-sellout"]-Element (alter,
 * durchgestrichener Preis) sind wirklich reduziert; alle anderen werden unten
 * bewusst rausgefiltert, sonst landen normal bepreiste Produkte in der App.
 *
 * URL-Herkunft (14.08.2026): Die Beispielkarte stammt von
 *   https://www.dm.de/search?query=angebote&searchProviderType=dm-products
 * also einer normalen Produktsuche nach dem Wort "Angebote" - KEINE
 * dedizierte Wochenangebote-/Prospekt-Seite. Das ist fürs Datenmodell aus
 * konzept.md problematisch: die Suche ist nicht filial-/PLZ-spezifisch (kein
 * erkennbarer Store-Parameter in der URL) und "alle reduzierten Produkte, die
 * zum Suchwort 'Angebote' passen" ist etwas anderes als "der aktuelle
 * Wochenprospekt dieser Filiale". branchConfig.sucheParam als Filial-/PLZ-
 * Parameter ist deshalb weiterhin unbestätigt - fraglich, ob dm.de für den
 * gewählten Markt überhaupt anders filterbare Angebote anzeigt, oder ob dafür
 * eine andere, noch nicht gefundene Seite nötig ist. Vor dem ersten echten
 * Lauf klären, ob es eine echte filialbezogene Angebotsseite gibt.
 * TODO: gueltigVon/gueltigBis nicht auf der Karte vorhanden, Quelle unbekannt.
 */
export const id = 'dm'
export const name = 'dm'

export async function scrape(branchConfig) {
  const url = `https://www.dm.de/search?query=angebote&searchProviderType=dm-products&marketNumber=${encodeURIComponent(branchConfig.sucheParam)}` // TODO: marketNumber-Parametername unbestätigt geraten

  return withPage(url, async (page) => {
    const kartenSelektor = '[data-dmid="product-tile"]'

    await page.waitForSelector(kartenSelektor, { timeout: 15_000 }).catch(() => {})

    const rohangebote = await page.$$eval(kartenSelektor, (karten) =>
      karten
        // Nur echte Angebote: Karten ohne durchgestrichenen Vorher-Preis sind
        // regulär bepreiste Produkte, keine Angebote.
        .filter((karte) => karte.querySelector('[data-dmid="price-sellout"]'))
        .map((karte) => ({
          titel:
            karte.querySelector('[data-dmid="product-description"] a')?.textContent?.trim() ||
            '',
          beschreibung: karte.querySelector('[data-dmid="product-brand"]')?.textContent?.trim() || '',
          preisText: karte.querySelector('[data-dmid="price-localized"]')?.textContent?.trim() || '',
          alterPreisText:
            karte.querySelector('[data-dmid="price-sellout"]')?.textContent?.trim() || '',
          einheit: karte.querySelector('[data-dmid="price-infos"]')?.textContent?.trim() || '',
          bildUrl:
            karte.querySelector('[data-dmid="product-image-container"]')?.getAttribute('src') ||
            null,
        })),
    )

    if (rohangebote.length === 0) {
      throw new Error(
        `Keine Angebote gefunden - Selektor "${kartenSelektor}" liefert nichts (oder keine ` +
          'reduzierten Karten dabei). Markup vermutlich geändert, Scraper muss angepasst werden.',
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
        gueltigVon: null, // TODO: Quelle für Gültigkeitszeitraum noch unbekannt
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
