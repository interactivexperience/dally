import { withPage } from '../lib/browser.js'

/**
 * Penny-Scraper (verifiziert gegen echte Angebotskarten).
 *
 * Bester Fall bisher nach REWE: Penny (REWE-Group-Schwester) zeigt Angebote
 * auf https://www.penny.de/angebote als echte Karten-Liste mit Titel, Bild,
 * Preis UND (anders als REWE) teilweise einem Streichpreis - keine
 * Blätterkatalog-Bildseiten wie bei Lidl/Netto/Edeka.
 *
 * Kartenstruktur verifiziert (14.08.2026, echte Karten von der Angebotsseite
 * für Penny Hansaring, Münster):
 *   <li class="tile-list__item" data-index="N">
 *     <a class="offer-tile__link" data-detail-url="/angebote/...">
 *       <article class="offer-tile">
 *         <div class="offer-tile__header">
 *           <div class="bubble__wrap"> ... </div>
 *           <div class="bubble__wrap" data-bubble-secondary> ... </div>  (optional, siehe unten)
 *         </div>
 *         <div class="offer-tile__image-container"><img src="..."></div>
 *         <div class="offer-tile__info-container">
 *           <h3 class="offer-tile__headline">Produktname*</h3>
 *           <div class="offer-tile__unit-price">je 250-g-Packung (1 kg = 3.00)</div>
 *         </div>
 *       </article>
 *     </a>
 *   </li>
 * `a.offer-tile__link[data-detail-url]` trifft NUR echte Angebotskarten -
 * weder Empfehlungs-Kacheln (`recommendation-tile`, kein `data-detail-url`)
 * noch die Lazy-Loading-Platzhalter (`tile-list__item--placeholder`, Link
 * ohne `data-detail-url`) werden dadurch mit erfasst. Verifiziert an drei
 * echten Kartenvarianten:
 *   1. Ein einzelnes ".bubble__wrap" mit Preis, ohne Streichpreis
 *      (Cherry-Romatomaten: 0.75 €, kein alter Preis)
 *   2. Ein einzelnes ".bubble__wrap" mit Streichpreis in ".value"
 *      (Bananen: 1.00 €, alter Preis 1.29 €)
 *   3. ZWEI ".bubble__wrap" - eine "Nur mit App"-Bubble (App-exklusiver
 *      Preis) und eine "[data-bubble-secondary]"-Bubble (UVP + regulärer
 *      Preis ohne App). Hier wird bewusst die sekundäre Bubble genommen,
 *      nicht die App-exklusive, damit `preis` der für alle Kunden gültige
 *      Preis ist (Ritter Sport: 1.11 €, UVP/alter Preis 1.99 €)
 * `.bubble__price-value` = Preis, `.value` in derselben Bubble = alter
 * Preis/UVP (leer wenn keiner angezeigt wird). Titel hat oft ein
 * angehängtes "*" (Sternchen-Hinweis), wird entfernt.
 *
 * NICHT verifizierbar ohne Live-Zugriff (TODO):
 *   - gueltigVon/gueltigBis standen auf keiner der gesehenen Karten - bleiben
 *     vorerst null. Vermutlich im Seitenkopf der Angebotsseite zu finden.
 *   - Marktauswahl: die Angebotsseite zeigte in der gesehenen Kachel bereits
 *     den Markt "Penny Hansaring" (Hansaring 46-48, Münster), aber unklar,
 *     ob das an einer bestehenden Session/einem Cookie lag oder ob
 *     /angebote ohne vorherigen Besuch der Marktseite einen generischen
 *     Standard-Markt zeigt. Deshalb wird hier zur Sicherheit zuerst die
 *     Marktseite (URL-Muster https://www.penny.de/markt/<sucheParam>,
 *     verifiziert z. B. als https://www.penny.de/markt/muenster/1775002/
 *     penny-hansaring-hansaring-46-48) besucht, danach erst /angebote -
 *     ungetestete Annahme, dass das die Marktauswahl setzt.
 *   - Lazy-Loading: nur die ersten zwei Kategorie-Abschnitte ("Top Angebote",
 *     "Obst & Gemüse") waren beim Laden direkt gefüllt, die übrigen
 *     Kategorien zeigten noch Platzhalter-Kacheln (".tile-list__item
 *     --placeholder") und laden vermutlich per Scroll-getriggertem AJAX nach.
 *     Die Scroll-Schleife unten ist eine ungetestete Annahme, wie das
 *     Nachladen ausgelöst wird.
 *
 * branchConfig.sucheParam wird als Penny-Markt-URL-Pfad angenommen (Teil
 * nach "/markt/", z. B. "muenster/1775002/penny-hansaring-hansaring-46-48"),
 * siehe scraper/config/branches.json.
 */
export const id = 'penny'
export const name = 'Penny'

const ANGEBOTE_URL = 'https://www.penny.de/angebote'
const KARTEN_SELEKTOR = 'a.offer-tile__link[data-detail-url]'

export async function scrape(branchConfig) {
  const marktUrl = `https://www.penny.de/markt/${branchConfig.sucheParam}`

  return withPage(marktUrl, async (page) => {
    await akzeptiereCookieBanner(page)

    await page.goto(ANGEBOTE_URL, { waitUntil: 'domcontentloaded' })
    await akzeptiereCookieBanner(page)

    await page.waitForSelector(KARTEN_SELEKTOR, { timeout: 15_000 }).catch(() => {})
    await ladeAlleKategorien(page)

    const rohangebote = await page.$$eval(KARTEN_SELEKTOR, (karten) =>
      karten.map((karte) => {
        const bubble =
          karte.querySelector('.bubble__wrap[data-bubble-secondary]') ||
          karte.querySelector('.bubble__wrap')

        return {
          titel: karte.querySelector('.offer-tile__headline')?.textContent?.trim() || '',
          einheit: karte.querySelector('.offer-tile__unit-price')?.textContent?.trim() || '',
          preisText: bubble?.querySelector('.bubble__price-value')?.textContent?.trim() || '',
          alterPreisText: bubble?.querySelector('.value')?.textContent?.trim() || '',
          bildUrl: karte.querySelector('.offer-tile__image-container img')?.getAttribute('src') || null,
        }
      }),
    )

    if (rohangebote.length === 0) {
      throw new Error(
        `Keine Angebote gefunden - Selektor "${KARTEN_SELEKTOR}" liefert nichts. ` +
          'Markup vermutlich geändert, Scraper muss angepasst werden.',
      )
    }

    return rohangebote
      .filter((o) => o.titel)
      .map((o) => ({
        titel: o.titel.replace(/\*$/, '').trim(),
        beschreibung: '',
        preis: parsePreis(o.preisText),
        alterPreis: o.alterPreisText ? parsePreis(o.alterPreisText) : null,
        einheit: o.einheit || null,
        gueltigVon: null, // TODO: bisher auf keiner Karte gefunden, vermutlich im Seitenkopf
        gueltigBis: null,
        bildUrl: o.bildUrl,
      }))
  })
}

async function akzeptiereCookieBanner(page) {
  // Kein verifizierter Selektor bekannt (Consent-Skript im gesehenen HTML
  // nicht eindeutig einer bestimmten Bibliothek zuzuordnen) - best effort
  // über sichtbaren Button-Text, blockiert sonst ggf. den Seiteninhalt.
  await page
    .getByRole('button', { name: /alle akzeptieren|allen zustimmen/i })
    .click({ timeout: 5_000 })
    .catch(() => {})
}

async function ladeAlleKategorien(page, { maxDurchlaufe = 20, wartezeitMs = 800 } = {}) {
  const platzhalterSelektor = '.tile-list__item--placeholder'
  let letzteAnzahl = -1

  for (let i = 0; i < maxDurchlaufe; i++) {
    const anzahl = await page.$$eval(platzhalterSelektor, (els) => els.length).catch(() => 0)
    if (anzahl === 0 || anzahl === letzteAnzahl) break
    letzteAnzahl = anzahl

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(wartezeitMs)
  }
}

function parsePreis(text) {
  if (!text) return null
  const bereinigt = text.replace(/[^\d,.-]/g, '').replace(',', '.')
  const wert = parseFloat(bereinigt)
  return Number.isFinite(wert) ? wert : null
}
