import { createHash } from 'node:crypto'

/**
 * Stabile Offer-ID aus Händler + Titel + Gültigkeitszeitraum.
 * Dieselbe Offer, die für mehrere Filialen eines Händlers gilt, bekommt so
 * dieselbe ID - branchIds werden dann vereinigt statt Duplikate anzulegen.
 */
export function buildOfferId(discounterId, titel, gueltigVon, gueltigBis) {
  const basis = [discounterId, titel.trim().toLowerCase(), gueltigVon, gueltigBis].join('|')
  return createHash('sha1').update(basis).digest('hex')
}

/**
 * Bringt ein rohes Scraper-Ergebnis in die Form aus konzept.md Punkt 3.
 * kategorien bleibt in Phase 1 leer - Gemini-Kategorisierung folgt in Phase 2.
 */
export function normalizeOffer(discounterId, branchId, raw) {
  const titel = (raw.titel || '').trim()
  const gueltigVon = raw.gueltigVon || null
  const gueltigBis = raw.gueltigBis || null

  return {
    id: buildOfferId(discounterId, titel, gueltigVon, gueltigBis),
    discounterId,
    branchIds: [branchId],
    titel,
    beschreibung: (raw.beschreibung || '').trim(),
    preis: raw.preis ?? null,
    alterPreis: raw.alterPreis ?? null,
    einheit: raw.einheit || null,
    gueltigVon,
    gueltigBis,
    bildUrl: raw.bildUrl || null,
    kategorien: [],
  }
}
