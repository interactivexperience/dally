import { withPage } from '../lib/browser.js'

/**
 * Netto-Scraper (Grundgerüst, teilweise verifiziert).
 *
 * Geklärt (14.08.2026, nach kurzem Hin und Her): gemeint ist **Netto
 * Marken-Discount** (schwarz-gelb, netto-online.de) - NICHT das rot-gelbe,
 * zu Edeka gehörende Netto, wie zwischenzeitlich angenommen.
 *
 * Echte Filiale bekannt: "Wolbecker Str. 11, 48155 Münster", siehe branches.json.
 *
 * SCHRITT 1 (URL-Auffindung) VERIFIZIERT: Die Übersichtsseite
 *   https://www.netto-online.de/ueber-netto/Online-Prospekte.chtm?stores_id=<storeid>
 * verlinkt in einer ".prospekt-teaser-item"-Kachel mit Titel "Filial-Angebote"
 * über "a[data-catalog='true']" auf die aktuelle Wochen-Blätteransicht, z. B.
 *   https://wochenprospekt.netto-online.de/hz36_hasb/?storeid=6199
 * (Ausgabe-Code ändert sich wöchentlich, deshalb live ausgelesen statt
 * fest einprogrammiert.)
 *
 * SCHRITT 2 (Blätteransicht) VERIFIZIERT, aber bewusst NUR grob umgesetzt:
 * Die Blätteransicht ist eine Publitas-Plattform (Drittanbieter-Blätterkatalog,
 * view.publitas.com-Branding), reine Bildseiten wie bei Lidl - ABER schlechter
 * strukturiert:
 *   - Hotspots (<a class="hotspot" aria-label="Mehr Infos">) haben KEINEN
 *     Produktnamen im HTML (anders als bei Lidl), nur generisches "Mehr Infos"
 *     - der echte Link ist "href=undefined" und wird erst per JS beim Klick
 *     nachgeladen (öffnet eine Seitenleiste). Keine strukturierten
 *     Produktdaten aus dem HTML gewinnbar.
 *   - ABER: das <img class="left" alt="..."> jeder Seite enthält den
 *     kompletten (fehlerhaften/durcheinandergewürfelten) OCR-Text der ganzen
 *     Seite als ein Blob - keine sinnvolle Trennung nach Produkt/Preis möglich.
 *   - Echte Seiten-URL enthält einen zusätzlichen Code-Teil, der erst nach dem
 *     ersten Laden bekannt ist, z. B.
 *     https://wochenprospekt.netto-online.de/hz36_hasb_grpb724061be38b8337b4d8/page/<n>
 *   - Der Prospekt hat viele Seiten (z. B. 72), Gesamtzahl steht in
 *     ".current-page .total".
 *   - Ein Cookiebot-Consent-Banner blockiert den Inhalt, bis er weggeklickt wird.
 *
 * ENTSCHEIDUNG (Nutzer, 14.08.2026): Angesichts der unsauberen Produktdaten
 * wird JEDE PROSPEKTSEITE als EIN Angebot übernommen (Titel "Netto Angebote -
 * Seite N", das Seitenbild als bildUrl, der rohe OCR-Text als beschreibung -
 * dadurch bleibt die Seite wenigstens per Volltextsuche auffindbar, auch ohne
 * sauber getrennte Produkte). Kein Versuch, einzelne Produkte/Preise
 * herauszulösen - das wäre laut Nutzerentscheidung zu unzuverlässig für
 * Phase 1. Falls vorhanden, wird der Gültigkeitszeitraum aus dem OCR-Text
 * geparst (Format "TT.MM.JJ").
 *
 * branchConfig.sucheParam wird als storeid angenommen, siehe
 * scraper/config/branches.json.
 */
export const id = 'netto'
export const name = 'Netto Marken-Discount'

const UEBERSICHT_URL = (storeid) =>
  `https://www.netto-online.de/ueber-netto/Online-Prospekte.chtm?stores_id=${encodeURIComponent(storeid)}`

const MAX_SEITEN = 100 // Sicherheitsgrenze, echte Prospekte hatten z.B. 72 Seiten

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
    await akzeptiereCookiebot(page)

    await page.waitForSelector('.current-page .total', { timeout: 15_000 }).catch(() => {})

    const basisUrl = await ermittleBasisUrl(page)
    const gesamtSeiten = await ermittleGesamtSeiten(page)

    if (!basisUrl || !gesamtSeiten) {
      throw new Error(
        'Konnte Basis-URL oder Gesamtseitenzahl der Blätteransicht nicht ermitteln - ' +
          'Struktur der Publitas-Ansicht vermutlich geändert.',
      )
    }

    const rohangebote = []

    for (let n = 1; n <= Math.min(gesamtSeiten, MAX_SEITEN); n++) {
      if (n > 1) {
        await page.goto(`${basisUrl}/page/${n}`, { waitUntil: 'domcontentloaded' })
      }

      const seite = await page
        .waitForSelector('.slide.current img.left', { timeout: 15_000 })
        .then(() =>
          page.$eval('.slide.current img.left', (img) => ({
            bildUrl: img.getAttribute('src'),
            altText: img.getAttribute('alt') || '',
          })),
        )
        .catch(() => null)

      if (!seite?.bildUrl) continue

      const daten = (seite.altText.match(/\d{2}\.\d{2}\.\d{2}/g) || []).map(parseDatumKurz)

      rohangebote.push({
        titel: `Netto Angebote - Seite ${n}`,
        beschreibung: seite.altText.replace(/\s+/g, ' ').trim(),
        preis: null,
        alterPreis: null,
        einheit: null,
        gueltigVon: daten[0] || null,
        gueltigBis: daten[1] || null,
        bildUrl: seite.bildUrl,
      })
    }

    if (rohangebote.length === 0) {
      throw new Error(
        'Keine Prospektseiten gefunden - Struktur der Publitas-Ansicht vermutlich geändert.',
      )
    }

    return rohangebote
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

async function akzeptiereCookiebot(page) {
  // Standard-Cookiebot-Button-ID, weit verbreitet - best effort, blockiert
  // sonst den Blätterkatalog-Inhalt.
  await page
    .click('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll', { timeout: 5_000 })
    .catch(() => {})
}

async function ermittleBasisUrl(page) {
  const ersteSeiteHref = await page
    .$eval('#progress_indicator .first-page', (el) => el.getAttribute('href'))
    .catch(() => null)
  if (!ersteSeiteHref) return null
  return ersteSeiteHref.replace(/\/page\/\d+$/, '')
}

async function ermittleGesamtSeiten(page) {
  const text = await page.$eval('.current-page .total', (el) => el.textContent?.trim()).catch(() => null)
  const zahl = parseInt(text, 10)
  return Number.isFinite(zahl) ? zahl : null
}

function parseDatumKurz(ddmmyy) {
  const [tag, monat, jahrKurz] = ddmmyy.split('.')
  return `20${jahrKurz}-${monat}-${tag}` // ISO-Datum (YYYY-MM-DD), nimmt 20xx an
}
