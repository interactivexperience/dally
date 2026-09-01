import { withPage } from '../lib/browser.js'

/**
 * Lidl-Scraper (Blätterkatalog-Bildseiten, Proof of Concept).
 *
 * Struktur verifiziert (14.08.2026, echte Prospektseite):
 *   https://www.lidl.de/l/prospekte/aktionsprospekt-<von>-<bis>-<hash>/view/flyer/page/1?...
 * Jede Seite ist ein <li data-pageid="..." class="page page--current ..."> mit
 * einem Bild der kompletten gescannten Prospektseite (kein Preis im HTML,
 * nur im Bild eingebrannt) plus positionierten Hotspot-Buttons pro Produkt:
 *   <img class="img" src="https://imgproxy.leaflets.schwarz/.../page-01_...jpg"
 *        alt="Seite 1 - Aktionsprospekt - 31.08.2026 – 05.09.2026">
 *   <section class="mediagroup" style="top: ...%; left: ...%; ...">
 *     <button aria-label="PARKSIDE® 20V Akku 4 Ah »PAP 204 A1« wird in der Seitenleiste geöffnet.">
 *   </section>
 * Der Gültigkeitszeitraum steht zuverlässig im alt-Text der Seite - bisher
 * einziger Discounter, bei dem sich gueltigVon/gueltigBis füllen lassen.
 * Manche mediagroup-Sections enthalten statt eines Buttons einen <a>-Link
 * (z. B. zu einem Rezept, aria-label "Link wird in einem neuen Fenster
 * geöffnet.") - die werden über den `button`-Selektor unten automatisch
 * ausgeschlossen.
 *
 * WICHTIGE EINSCHRÄNKUNG: kein Preis im HTML, nur im Bild eingebrannt. Die
 * Hotspots öffnen beim Klick eine Seitenleiste, die vermutlich per AJAX den
 * Preis nachlädt - TODO, noch nicht geprüft. Bis dahin: Angebote ohne
 * preis/alterPreis, dafür mit dem echten Seitenbild als bildUrl.
 *
 * TODO NICHT verifiziert: wie man von der Prospekt-Übersicht
 * (lidl.de/c/online-prospekte/...) automatisch zur aktuellen Wochen-Flyer-URL
 * kommt - die URL enthält Datum+Hash und ändert sich jede Woche.
 * branchConfig.sucheParam hält deshalb vorerst die komplette, von Hand
 * ermittelte Flyer-Start-URL (page/1) - müsste künftig automatisiert werden,
 * sonst muss branches.json jede Woche manuell aktualisiert werden.
 * TODO NICHT verifiziert: ob der "Nächste Seite"-Button am Prospekt-Ende
 * zuverlässig disabled/aria-disabled wird - MAX_SEITEN ist die Sicherheitsgrenze.
 */
export const id = 'lidl'
export const name = 'Lidl'

const MAX_SEITEN = 40

export async function scrape(branchConfig) {
  const startUrl = branchConfig.sucheParam // volle Flyer-URL, siehe TODO oben

  return withPage(startUrl, async (page) => {
    const rohangebote = []

    for (let i = 0; i < MAX_SEITEN; i++) {
      await page.waitForSelector('li.page--current img.img', { timeout: 15_000 }).catch(() => {})

      const seite = await page.evaluate(() => {
        const aktuell = document.querySelector('li.page--current')
        if (!aktuell) return null

        const img = aktuell.querySelector('img.img')
        const alt = img?.getAttribute('alt') || ''
        const daten = alt.match(/\d{2}\.\d{2}\.\d{4}/g) || []

        const titel = Array.from(aktuell.querySelectorAll('.mediagroup button[aria-label]'))
          .map((btn) => btn.getAttribute('aria-label') || '')
          .filter((label) => label.endsWith('wird in der Seitenleiste geöffnet.'))
          .map((label) => label.replace(/\s*wird in der Seitenleiste geöffnet\.$/, '').trim())

        return {
          bildUrl: img?.getAttribute('src') || null,
          gueltigVon: daten[0] || null,
          gueltigBis: daten[1] || null,
          titel,
        }
      })

      if (!seite) break

      for (const titel of seite.titel) {
        rohangebote.push({
          titel,
          beschreibung: '',
          preis: null,
          alterPreis: null,
          einheit: null,
          gueltigVon: parseDatum(seite.gueltigVon),
          gueltigBis: parseDatum(seite.gueltigBis),
          bildUrl: seite.bildUrl,
        })
      }

      const weiterButton = await page.$('button[aria-label="Nächste Seite"]')
      if (!weiterButton) break
      const deaktiviert = await weiterButton
        .evaluate((el) => el.disabled || el.getAttribute('aria-disabled') === 'true')
        .catch(() => true)
      if (deaktiviert) break

      await weiterButton.click()
      await page.waitForTimeout(800) // Seitenwechsel/Bild-Ladezeit abwarten
    }

    if (rohangebote.length === 0) {
      throw new Error(
        'Keine Angebote gefunden - Prospekt-Struktur vermutlich geändert oder ' +
          'Navigation zwischen Seiten fehlgeschlagen. Siehe TODOs oben.',
      )
    }

    return rohangebote
  })
}

function parseDatum(ddmmyyyy) {
  if (!ddmmyyyy) return null
  const [tag, monat, jahr] = ddmmyyyy.split('.')
  return `${jahr}-${monat}-${tag}` // ISO-Datum (YYYY-MM-DD)
}
