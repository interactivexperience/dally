import { withPage } from '../lib/browser.js'

/**
 * Rossmann-Scraper (verifiziert gegen echte Angebotsseite).
 *
 * WICHTIGE EINSCHRÄNKUNG (anders als ursprünglich vermutet): Rossmann zeigt
 * unter https://www.rossmann.de/de/angebote/m/angebote KEINE Kampagnen-Kacheln
 * ohne Preis wie dm, sondern einen echten, paginierten Produkt-Katalog mit
 * Online-Shop-Preisen (`data-testid="product-card"`). Aber: diese Seite ist
 * NICHT filialspezifisch - es gibt keine Marktauswahl, die Angebote/Preise
 * gelten bundesweit für den Online-Shop. `branchConfig.sucheParam` wird
 * deshalb wie bei dm.js NICHT benutzt.
 *
 * Kartenstruktur verifiziert (14.08.2026, echte Angebotsseite rossmann.de):
 *   <div data-testid="product-card" data-item-name="Taschentücherbox" data-item-brand="alouette" ...>
 *     <figure data-testid="product-image"><picture><img src="https://www.rossmann.de/media-neu/.../SHOP_IMAGE.png?..."></picture></figure>
 *     <div data-testid="product-baseprice">100 Stück</div>
 *     <div data-testid="product-price"> <span class="sr-only">Artikelpreis 0,99 €</span></div>
 *   </div>
 * `data-item-name` liefert den vollen (bereits Entity-dekodierten) Produktnamen,
 * zuverlässiger als der sichtbare Text im DOM. `[data-testid="product-price"]
 * .sr-only` liefert den vollen Preistext ("Artikelpreis X,XX €") statt der in
 * einzelne Ziffern zerlegten Anzeige - das Präfix wird abgeschnitten.
 * `[data-testid="product-baseprice"]` (z. B. "70 Stück (10Stück = 0,78 €)")
 * wird 1:1 als `einheit` übernommen. Bild-URL ist bereits die echte
 * CDN-URL (kein Platzhalter), passt zu konzept.md Punkt 16 (Hotlink).
 * KEIN durchgestrichener alter Preis/UVP auf den gesehenen Karten gefunden -
 * `alterPreis` bleibt deshalb immer null (wie bei rewe.js).
 *
 * Der Gültigkeitszeitraum steht EINMAL oben auf der Seite ("Gültig ab
 * Montag: 31.08. - 04.09.2026" - Startdatum ohne Jahr, wird vom Enddatum
 * übernommen) und wird auf alle Angebote der Seite angewendet.
 *
 * Paginierung: die Seite zeigt eine Seitenzahl-Navigation
 * (`a[data-testid="search-page-N"]`, URL-Parameter `?pageIndex=N-1`) - die
 * höchste gefundene Seitenzahl bestimmt, wie oft weitergeblättert wird.
 */
export const id = 'rossmann'
export const name = 'Rossmann'

const ANGEBOTE_URL = 'https://www.rossmann.de/de/angebote/m/angebote'
const KARTEN_SELEKTOR = '[data-testid="product-card"]'
const MAX_SEITEN = 20

// eslint-disable-next-line no-unused-vars
export async function scrape(branchConfig) {
  return withPage(`${ANGEBOTE_URL}?pageIndex=0`, async (page) => {
    const [gueltigVon, gueltigBis] = await ermittleGueltigkeit(page)
    const maxSeite = await ermittleMaxSeite(page)

    const rohangebote = []
    for (let seitenIndex = 0; seitenIndex < Math.min(maxSeite, MAX_SEITEN); seitenIndex++) {
      if (seitenIndex > 0) {
        await page.goto(`${ANGEBOTE_URL}?pageIndex=${seitenIndex}`, { waitUntil: 'domcontentloaded' })
        await page.waitForSelector(KARTEN_SELEKTOR, { timeout: 15_000 }).catch(() => {})
      }

      const karten = await page.$$eval(KARTEN_SELEKTOR, (elemente) =>
        elemente.map((karte) => ({
          titel: karte.getAttribute('data-item-name') || '',
          einheit: karte.querySelector('[data-testid="product-baseprice"]')?.textContent?.trim() || '',
          preisText:
            karte
              .querySelector('[data-testid="product-price"] .sr-only')
              ?.textContent?.trim()
              ?.replace(/^Artikelpreis\s*/, '') || '',
          bildUrl: karte.querySelector('figure[data-testid="product-image"] img')?.getAttribute('src') || null,
        })),
      )
      rohangebote.push(...karten)
    }

    if (rohangebote.length === 0) {
      throw new Error(
        `Keine Angebote gefunden - Selektor "${KARTEN_SELEKTOR}" liefert nichts. ` +
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
        gueltigVon,
        gueltigBis,
        bildUrl: o.bildUrl,
      }))
  })
}

async function ermittleGueltigkeit(page) {
  const text = await page
    .locator('strong', { hasText: 'Gültig' })
    .first()
    .textContent()
    .catch(() => null)
  if (!text) return [null, null]
  const treffer = text.match(/(\d{2})\.(\d{2})\.\s*-\s*(\d{2})\.(\d{2})\.(\d{4})/)
  if (!treffer) return [null, null]
  const [, tagVon, monatVon, tagBis, monatBis, jahr] = treffer
  return [`${jahr}-${monatVon}-${tagVon}`, `${jahr}-${monatBis}-${tagBis}`]
}

async function ermittleMaxSeite(page) {
  const nummern = await page.$$eval('nav a[data-testid^="search-page-"]', (elemente) =>
    elemente.map((el) => parseInt(el.getAttribute('data-testid').replace('search-page-', ''), 10)),
  )
  return nummern.length > 0 ? Math.max(...nummern) : 1
}

function parsePreis(text) {
  if (!text) return null
  const bereinigt = text.replace(/[^\d,.-]/g, '').replace(',', '.')
  const wert = parseFloat(bereinigt)
  return Number.isFinite(wert) ? wert : null
}
