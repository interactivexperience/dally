import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { db, FieldValue } from './lib/firebaseAdmin.js'
import { normalizeOffer } from './lib/normalize.js'
import { discounterModules } from './discounters/index.js'

const BRANCHES_PATH = fileURLToPath(new URL('../config/branches.json', import.meta.url))

async function loadBranches() {
  const raw = await readFile(BRANCHES_PATH, 'utf-8')
  return JSON.parse(raw).branches
}

async function scrapeDiscounter(discounterModule, branches) {
  const eigeneBranches = branches.filter((b) => b.discounterId === discounterModule.id)
  const fehler = []
  const offersById = new Map()

  if (eigeneBranches.length === 0) {
    console.warn(`[${discounterModule.id}] keine Filialen in branches.json konfiguriert, überspringe.`)
  }

  // Sequenziell, nicht parallel - moderate Frequenz ist bewusste Vorgabe (konzept.md Punkt 4).
  for (const branch of eigeneBranches) {
    try {
      const rohangebote = await discounterModule.scrape(branch)
      for (const roh of rohangebote) {
        const offer = normalizeOffer(discounterModule.id, branch.id, roh)
        const bestehend = offersById.get(offer.id)
        if (bestehend) {
          bestehend.branchIds = [...new Set([...bestehend.branchIds, ...offer.branchIds])]
        } else {
          offersById.set(offer.id, offer)
        }
      }
      console.log(`[${discounterModule.id}] ${branch.id}: ${rohangebote.length} Angebote gefunden.`)
    } catch (err) {
      console.error(`[${discounterModule.id}] ${branch.id}: Scraping fehlgeschlagen -`, err.message)
      fehler.push(`${branch.id}: ${err.message}`)
    }
  }

  return { offers: [...offersById.values()], fehler }
}

async function schreibeDiscounter(discounterModule) {
  await db
    .collection('discounters')
    .doc(discounterModule.id)
    .set({ id: discounterModule.id, name: discounterModule.name }, { merge: true })
}

async function schreibeOffer(offer) {
  const ref = db.collection('offers').doc(offer.id)
  const snap = await ref.get()

  // hinzugefuegtAm nur beim ersten Erscheinen setzen (Basis für "neu diese Woche",
  // konzept.md Punkt 3 + 5) - branchIds mit einer eventuell schon bestehenden
  // Filial-Zuordnung vereinigen statt zu überschreiben.
  const hinzugefuegtAm = snap.exists ? snap.data().hinzugefuegtAm : FieldValue.serverTimestamp()
  const branchIds = snap.exists
    ? [...new Set([...(snap.data().branchIds || []), ...offer.branchIds])]
    : offer.branchIds

  await ref.set({ ...offer, branchIds, hinzugefuegtAm }, { merge: true })
}

async function schreibeScrapeStatus(discounterId, fehler) {
  await db
    .collection('scrapeStatus')
    .doc(discounterId)
    .set({
      discounterId,
      letzterLauf: FieldValue.serverTimestamp(),
      erfolgreich: fehler.length === 0,
      fehlerMeldung: fehler.length > 0 ? fehler.join(' | ') : null,
    })
}

async function main() {
  const branches = await loadBranches()
  const zusammenfassung = []

  for (const discounterModule of discounterModules) {
    try {
      await schreibeDiscounter(discounterModule)
      const { offers, fehler } = await scrapeDiscounter(discounterModule, branches)

      for (const offer of offers) {
        await schreibeOffer(offer)
      }

      await schreibeScrapeStatus(discounterModule.id, fehler)
      zusammenfassung.push({ discounter: discounterModule.id, offers: offers.length, fehler: fehler.length })
    } catch (err) {
      // Ein komplett kaputter Discounter (z. B. Firestore-Fehler) darf die anderen
      // nicht blockieren - Fehlertoleranz ist Pflicht (konzept.md Punkt 4).
      console.error(`[${discounterModule.id}] unerwarteter Fehler, überspringe Discounter -`, err)
      zusammenfassung.push({ discounter: discounterModule.id, offers: 0, fehler: 1 })
    }
  }

  console.log('\nZusammenfassung:')
  console.table(zusammenfassung)

  // Der Job soll nicht rot laufen, nur weil eine einzelne Händler-Website ihr Markup
  // geändert hat - das ist erwartbar und wird über scrapeStatus in der App sichtbar,
  // nicht über einen fehlgeschlagenen GitHub-Actions-Lauf.
  process.exit(0)
}

main().catch((err) => {
  console.error('Scraping-Job komplett fehlgeschlagen:', err)
  process.exit(1)
})
