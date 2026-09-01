import * as rewe from './rewe.js'
import * as dm from './dm.js'
import * as netto from './netto.js'
import * as edeka from './edeka.js'
import * as penny from './penny.js'
import * as lidl from './lidl.js'
import * as rossmann from './rossmann.js'
import * as aldi from './aldi.js'

/**
 * Registry aller Scraper-Module. Neuer Discounter = neues Modul mit
 * derselben Schnittstelle ({id, name, scrape}) hier eintragen - siehe
 * konzept.md Punkt 11, sonst nichts im restlichen Job anfassen.
 *
 * Verifizierungsstand (14.08.2026): nur rewe + dm sind gegen echte
 * HTML-Schnipsel geprüft, siehe deren Modul-Kommentare. Die übrigen sechs
 * sind unverifizierte Platzhalter (siehe jeweiliges TODO im Modul) - sie
 * schlagen aktuell mit einer klaren Fehlermeldung fehl, statt falsche Daten
 * zu liefern (siehe scrapeStatus in der App). Aldi Nord ist eine Ergänzung
 * über konzept.md Punkt 1 hinaus (dort ursprünglich nicht gelistet).
 */
export const discounterModules = [rewe, dm, netto, edeka, penny, lidl, rossmann, aldi]
