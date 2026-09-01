import { withPage } from '../lib/browser.js'

/**
 * Netto-Scraper (Grundgerüst, teilweise verifiziert).
 *
 * Geklärt (14.08.2026, nach kurzem Hin und Her): gemeint ist **Netto
 * Marken-Discount** (schwarz-gelb, netto-online.de) - NICHT das rot-gelbe,
 * zu Edeka gehörende Netto, wie zwischenzeitlich angenommen. Auf
 * netto-online.de steht im Logo-Alt-Text explizit "Netto Marken-Discount
 * Logo", das war der entscheidende Hinweis.
 *
 * Echte Filiale bekannt: "Wolbecker Str. 11, 48155 Münster" (aus dem
 * Filialfinder-Link im Seitenheader), siehe branches.json.
 *
 * SCHRITT 1 (URL-Auffindung) VERIFIZIERT: Die Übersichtsseite
 *   https://www.netto-online.de/ueber-netto/Online-Prospekte.chtm?stores_id=<storeid>
 * listet mehrere ".prospekt-teaser-item"-Kacheln (Filial-Angebote,
 * Preissenkung, Online-Angebote, Reise-Angebote, ...). Die für uns relevante
 * Kachel hat als Titel exakt "Filial-Angebote" und enthält einen Link
 * "a[data-catalog='true']" zur aktuellen Wochen-Blätteransicht, z. B.
 *   https://wochenprospekt.netto-online.de/hz36_hasb/?storeid=6199
 * Der Ausgabe-Code ("hz36_hasb") ändert sich wöchentlich (war "hz34_hasb"
 * eine Woche zuvor) - deshalb wird er hier live aus der Übersichtsseite
 * gelesen statt fest einprogrammiert (analog zum JSON-LD-Ansatz bei Lidl,
 * nur über einen anderen Mechanismus, da Netto kein JSON-LD hat).
 *
 * SCHRITT 2 (Angebotskarten/Blätteransicht) NICHT verifiziert: Es liegt noch
 * KEIN HTML einer echten Angebotskarte/Prospektseite von
 * wochenprospekt.netto-online.de vor (nur Seitenkopf/Übersicht gesehen).
 * Laut Seitentext ("Statt- und durchgestrichene Preise...", anklickbare
 * Artikel-Hotspots) vermutlich ein ähnliches Blätterkatalog-Konzept wie bei
 * Lidl, aber eine andere technische Plattform (eigene netto-online.de-
 * Subdomain statt leaflets.schwarz) - Selektoren unten sind komplett
 * geraten. Siehe rewe.js/lidl.js für den Verifizierungs-Ablauf.
 *
 * branchConfig.sucheParam wird als storeid angenommen, siehe
 * scraper/config/branches.json.
 */
export const id = 'netto'
export const name = 'Netto Marken-Discount'

const UEBERSICHT_URL = (storeid) =>
  `https://www.netto-online.de/ueber-netto/Online-Prospekte.chtm?stores_id=${encodeURIComponent(storeid)}`

export async function scrape(branchConfig) {
  return withPage(UEBERSICHT_URL(branchConfig.sucheParam), async (page) => {
    const flyerUrl = await findFilialAngeboteUrl(page)
    if (!flyerUrl) {
      throw new Error(
        'Keine "Filial-Angebote"-Kachel auf der Prospekt-Übersichtsseite gefunden - ' +
          'Struktur der Übersichtsseite vermutlich geändert.',
      )
    }

    await page.goto(flyerUrl, { waitUntil: 'domcontentloaded' })

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
          'Unverifizierter Platzhalter-Scraper (Schritt 2), siehe TODOs oben.',
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

async function findFilialAngeboteUrl(page) {
  return page.evaluate(() => {
    const kacheln = Array.from(document.querySelectorAll('.prospekt-teaser-item'))
    for (const kachel of kacheln) {
      const titel = kachel.querySelector('.prospekt-teaser-item-title')?.textContent?.trim()
      if (titel === 'Filial-Angebote') {
        return kachel.querySelector('a[data-catalog="true"]')?.getAttribute('href') || null
      }
    }
    return null
  })
}

function parsePreis(text) {
  if (!text) return null
  const bereinigt = text.replace(/[^\d,.-]/g, '').replace(',', '.')
  const wert = parseFloat(bereinigt)
  return Number.isFinite(wert) ? wert : null
}
