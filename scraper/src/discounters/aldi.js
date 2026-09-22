import { withPage } from '../lib/browser.js'

/**
 * Aldi-Nord-Scraper (verifiziert, mit Einschränkungen - bester "Blätterkatalog"-Fall
 * nach Rewe/Penny/Rossmann).
 *
 * Aldi Nord (nicht Aldi Süd - für Münster/NRW zuständig, aldi-nord.de).
 *
 * SCHRITT 1 verifiziert (22.09.2026, echte Übersichtsseite):
 *   https://www.aldi-nord.de/prospekte/aldi-aktuell.html
 * Diese (Next.js-gerenderte) Seite bettet den aktuellen Prospekt als iframe
 * einer Drittanbieter-Blätterkatalog-Plattform ein (magazine.aldi-nord.de,
 * "iPaper"). Der entscheidende Fund: das eingebettete `<script id="__NEXT_DATA__">`
 * enthält bereits (server-seitig vorab abgerufen) die KOMPLETTE Liste aller
 * Prospektseiten-Bild-URLs unter `props.pageProps.page.apiData` (ein
 * JSON-String, der ein zweites Mal geparst werden muss) im Eintrag
 * `LEAFLET_IPAPER_STRUCTURE_GET` → `res` = Array aus {pageNumber, url}. Diese
 * Bild-URLs (ipaper.ipapercms.dk/.../Image.ashx?PageNumber=N) brauchen KEIN
 * Token/Expiry wie die Bilder direkt im Blätterkatalog-Viewer - dadurch
 * bekommen wir alle Seitenbilder ohne jede Navigation im Viewer selbst.
 *
 * SCHRITT 2 verifiziert: Direkter Besuch der iframe-`src`-URL (z. B.
 *   https://magazine.aldi-nord.de/aldi-nord/aldi-aktuell/2026/2026cw39.../?HideStandardUI=true&HideNavigationBars=true)
 * zeigt den Blätterkatalog als eigenständige Seite (die iPaper-Plattform,
 * NICHT dieselbe wie Lidls "leaflets.schwarz" oder Nettos Publitas). Anders
 * als bei Netto/Edeka gibt es hier eine versteckte Bedienungshilfen-Textsektion
 * `#bookPageText section` mit ECHTEM, STRUKTURIERTEM Text pro Seite (kein
 * OCR-Blob) - inklusive Produktname, Beschreibung, Einheit UND Preis samt
 * Streichpreis/UVP, z. B.:
 *   "... Tafeläpfel Sorte: Gala; ... (kg = 1.49) 1 kg - 42 % 1. 49 ** 2.59 ..."
 *   (Preis 1.49 €, Streichpreis 2.59 €)
 * Der Gültigkeitszeitraum steht ebenfalls im Text der ersten Seite
 * ("Gültig von Mo. 21.9. bis Sa. 26.9.", ohne Jahr - wird anhand des
 * aktuellen Datums zum nächstliegenden Jahr ergänzt).
 *
 * PREIS-EXTRAKTION (Nutzerentscheidung 22.09.2026: "per-product extraction"
 * statt sicherer Ein-Angebot-pro-Seite-Variante wie bei Netto): der Fließtext
 * einer Seite enthält alle Produkte ohne saubere Trennzeichen, aber jeder
 * Produktpreis ist eindeutig als "<Zahl>. <zwei Ziffern> <ein oder zwei
 * Sternchen>" erkennbar (z. B. "1. 49 **"), gefolgt optional von einem
 * Streichpreis/UVP ("UVP 0.99" oder nackt "2.59"). Der Text wird an diesen
 * Preis-Markern gesplittet; der Text VOR einem Marker wird (nach Entfernen
 * des führenden Wochentags-Zeitraums, z. B. "Mo. 21.9. – Sa. 26.9.") als
 * Titel/Beschreibung des jeweiligen Produkts verwendet.
 * BEKANNTE EINSCHRÄNKUNG: diese Heuristik ist nicht perfekt - Marketing-
 * Banner-Text/Kategorie-Label direkt vor einem Produkt (z. B. "AUS DEUT",
 * "IM AUFSTELLER") landet teilweise mit im Titel. Das verfälscht keine
 * Preise, macht Titel nur gelegentlich etwas unsauber. Kein Versuch, die
 * Einheit sauber herauszulösen - steht aber vollständig in `beschreibung`.
 *
 * NAVIGATION ZWISCHEN SEITEN (ungetestete Annahme, siehe TODO): pro Seite
 * wird `#leftClickableBackground`/`#rightClickableBackground` als Klick-Zonen
 * zum Vor-/Zurückblättern verwendet (an Seitengrenzen tragen sie die Klasse
 * "disabled" - auf Seite 1 verifiziert). NICHT verifiziert: ob eine
 * Doppelseiten-Ansicht (ab Seite 2, z. B. Seite 2+3 gemeinsam sichtbar) die
 * Bedienungshilfen-Textsektion pro Einzelseite oder kombiniert pro
 * Doppelseite ausliefert - die Schleife unten liest deshalb ALLE
 * `#bookPageText section`-Elemente zusammen und ist robust gegenüber beiden
 * Fällen, bricht aber vorsichtshalber ab, wenn sich die erkannte Seitenzahl
 * über mehrere Versuche nicht mehr weiterbewegt.
 *
 * branchConfig.sucheParam wird NICHT benutzt - wie bei dm/Rossmann kein
 * Marktauswahl-Mechanismus auf der Prospektseite gefunden (bundesweiter
 * Online-Prospekt), siehe scraper/config/branches.json.
 */
export const id = 'aldi'
export const name = 'Aldi Nord'

const UEBERSICHT_URL = 'https://www.aldi-nord.de/prospekte/aldi-aktuell.html'
const MAX_SEITEN = 80
const MAX_STILLSTAND = 3

// eslint-disable-next-line no-unused-vars
export async function scrape(branchConfig) {
  return withPage(UEBERSICHT_URL, async (page) => {
    await akzeptiereCookieBanner(page)

    const { flyerUrl, seitenBilder } = await ermittleProspektDaten(page)
    if (!flyerUrl || seitenBilder.size === 0) {
      throw new Error(
        'Konnte Flyer-URL oder Seitenbilder nicht aus __NEXT_DATA__ ermitteln - ' +
          'Struktur der Übersichtsseite vermutlich geändert.',
      )
    }

    await page.goto(flyerUrl, { waitUntil: 'domcontentloaded' })
    await akzeptiereCookieBanner(page)
    await page.waitForSelector('#bookPageText section', { timeout: 20_000 }).catch(() => {})

    const { rohangebote, gueltigVon, gueltigBis } = await leseAlleSeiten(page, seitenBilder)

    if (rohangebote.length === 0) {
      throw new Error(
        'Keine Angebote/Seiteninhalte aus dem Blätterkatalog gelesen - ' +
          'Struktur des Viewers vermutlich geändert.',
      )
    }

    return rohangebote.map((o) => ({ ...o, gueltigVon, gueltigBis }))
  })
}

async function akzeptiereCookieBanner(page) {
  await page
    .getByRole('button', { name: /alle akzeptieren|allen zustimmen|accept all/i })
    .click({ timeout: 5_000 })
    .catch(() => {})
}

async function ermittleProspektDaten(page) {
  const result = await page.evaluate(() => {
    const flyerUrl = document.querySelector('iframe[title="magazine"]')?.getAttribute('src') || null
    let apiData = null
    try {
      const nextData = JSON.parse(document.getElementById('__NEXT_DATA__')?.textContent || '{}')
      const roh = nextData?.props?.pageProps?.page?.apiData
      apiData = roh ? JSON.parse(roh) : null
    } catch {
      apiData = null
    }
    return { flyerUrl, apiData }
  })

  const seitenBilder = new Map()
  const eintrag = (result.apiData || []).find((e) => e[0] === 'LEAFLET_IPAPER_STRUCTURE_GET')
  for (const seite of eintrag?.[1]?.res || []) {
    const nr = parseInt(seite.pageNumber, 10)
    if (Number.isFinite(nr) && seite.url) seitenBilder.set(nr, seite.url)
  }

  return { flyerUrl: result.flyerUrl, seitenBilder }
}

async function leseAlleSeiten(page, seitenBilder) {
  const rohangebote = []
  let gueltigVon = null
  let gueltigBis = null
  let letzteSeitenNummer = 0
  let stillstandVersuche = 0

  for (let durchlauf = 0; durchlauf < MAX_SEITEN; durchlauf++) {
    const info = await leseAktuelleSeiten(page)

    if (info?.text) {
      if (!gueltigVon) {
        const gueltig = parseGueltigkeit(info.text)
        if (gueltig) [gueltigVon, gueltigBis] = gueltig
      }

      const bildUrl = seitenBilder.get(info.ersteSeitenNummer) || null
      const produkte = extrahiereProdukte(info.text)

      if (produkte.length > 0) {
        for (const produkt of produkte) rohangebote.push({ ...produkt, bildUrl })
      } else {
        rohangebote.push({
          titel: `Aldi Nord Angebote - Seite ${info.ersteSeitenNummer || durchlauf + 1}`,
          beschreibung: info.text.replace(/\s+/g, ' ').trim().slice(0, 1000),
          preis: null,
          alterPreis: null,
          einheit: null,
          bildUrl,
        })
      }
    }

    if (info?.ersteSeitenNummer && info.ersteSeitenNummer > letzteSeitenNummer) {
      letzteSeitenNummer = info.ersteSeitenNummer
      stillstandVersuche = 0
    } else {
      stillstandVersuche++
    }

    if (stillstandVersuche >= MAX_STILLSTAND) break
    if (letzteSeitenNummer >= seitenBilder.size) break

    const weiterGeklickt = await naechsteSeite(page)
    if (!weiterGeklickt) break
    await page.waitForTimeout(600)
  }

  return { rohangebote, gueltigVon, gueltigBis }
}

async function leseAktuelleSeiten(page) {
  return page
    .$$eval('#bookPageText section', (sections) => {
      if (sections.length === 0) return null
      const text = sections.map((s) => s.textContent || '').join(' ')
      const nummern = sections
        .map((s) => parseInt((s.querySelector('h2')?.textContent || '').match(/\d+/)?.[0], 10))
        .filter((n) => Number.isFinite(n))
      return { text, ersteSeitenNummer: nummern.length > 0 ? Math.min(...nummern) : null }
    })
    .catch(() => null)
}

async function naechsteSeite(page) {
  const deaktiviert = await page
    .$eval('#rightClickableBackground', (el) => el.classList.contains('disabled'))
    .catch(() => true)
  if (deaktiviert) return false
  await page.click('#rightClickableBackground', { timeout: 5_000 }).catch(() => {})
  return true
}

function parseGueltigkeit(text) {
  const treffer = text.match(
    /Gültig von\s+(?:Mo|Di|Mi|Do|Fr|Sa|So)\.?\s*(\d{1,2})\.(\d{1,2})\.\s*bis\s+(?:Mo|Di|Mi|Do|Fr|Sa|So)\.?\s*(\d{1,2})\.(\d{1,2})\.?/,
  )
  if (!treffer) return null

  const [, tagVon, monatVon, tagBis, monatBis] = treffer.map((v, i) => (i === 0 ? v : parseInt(v, 10)))
  const jetzt = new Date()
  const fmt = (jahr, monat, tag) => `${jahr}-${String(monat).padStart(2, '0')}-${String(tag).padStart(2, '0')}`

  return [
    fmt(naheliegendesJahr(tagVon, monatVon, jetzt), monatVon, tagVon),
    fmt(naheliegendesJahr(tagBis, monatBis, jetzt), monatBis, tagBis),
  ]
}

function naheliegendesJahr(tag, monat, referenz) {
  let bestesJahr = referenz.getFullYear()
  let besteDiffMs = Infinity
  for (const jahr of [referenz.getFullYear() - 1, referenz.getFullYear(), referenz.getFullYear() + 1]) {
    const diff = Math.abs(new Date(jahr, monat - 1, tag).getTime() - referenz.getTime())
    if (diff < besteDiffMs) {
      besteDiffMs = diff
      bestesJahr = jahr
    }
  }
  return bestesJahr
}

function extrahiereProdukte(text) {
  const preisMuster = /(\d+)\.\s*(\d{2})\s*(\*{1,2})(?:\s*(?:UVP\s+)?(\d+\.\d{2}))?/g
  const ergebnisse = []
  let letztesEnde = 0
  let treffer

  while ((treffer = preisMuster.exec(text)) !== null) {
    const rohTitel = text.slice(letztesEnde, treffer.index).trim()
    letztesEnde = treffer.index + treffer[0].length

    const titel = bereinigeTitel(rohTitel)
    if (!titel) continue

    ergebnisse.push({
      titel: titel.slice(0, 120),
      beschreibung: rohTitel.replace(/\s+/g, ' ').trim().slice(0, 500),
      preis: parseFloat(`${treffer[1]}.${treffer[2]}`),
      alterPreis: treffer[4] ? parseFloat(treffer[4]) : null,
      einheit: null,
    })
  }

  return ergebnisse
}

function bereinigeTitel(rohtext) {
  const tagesspannenMuster =
    /(?:Mo|Di|Mi|Do|Fr|Sa|So)\.\s*\d{1,2}\.\d{1,2}\.\s*[–-]\s*(?:Mo|Di|Mi|Do|Fr|Sa|So)\.\s*\d{1,2}\.\d{1,2}\.|ab\s+(?:Mo|Di|Mi|Do|Fr|Sa|So)\.\s*\d{1,2}\.\d{1,2}\./g

  let letzterTreffer = null
  let treffer
  while ((treffer = tagesspannenMuster.exec(rohtext)) !== null) {
    letzterTreffer = treffer
  }

  const text = (letzterTreffer ? rohtext.slice(letzterTreffer.index + letzterTreffer[0].length) : rohtext).trim()

  const semikolonIndex = text.indexOf(';')
  if (semikolonIndex > 0 && semikolonIndex < 100) return text.slice(0, semikolonIndex).trim()
  return text.slice(0, 80).trim()
}
