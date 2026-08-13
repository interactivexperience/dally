import * as rewe from './rewe.js'
import * as dm from './dm.js'

/**
 * Registry aller Scraper-Module. Neuer Discounter = neues Modul mit
 * derselben Schnittstelle ({id, name, scrape}) hier eintragen - siehe
 * konzept.md Punkt 11, sonst nichts im restlichen Job anfassen.
 */
export const discounterModules = [rewe, dm]
