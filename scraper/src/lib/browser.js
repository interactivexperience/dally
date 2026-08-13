import { chromium } from 'playwright'

const USER_AGENT =
  'Mozilla/5.0 (compatible; SparfuchsBot/0.1; privater, nicht-kommerzieller Gebrauch)'

/**
 * Öffnet eine Seite, führt fn(page) aus und schließt den Browser danach zuverlässig
 * wieder - auch bei Fehlern. Ein Browser pro Aufruf statt ein geteilter Browser für
 * den ganzen Job, damit ein abgestürzter Browser nicht den restlichen Lauf gefährdet.
 *
 * Moderate Frequenz/kein aggressives Parallelisieren ist bewusste Vorgabe
 * (konzept.md Punkt 4) - der Job scraped Filialen sequenziell, nicht parallel.
 */
export async function withPage(url, fn, { timeoutMs = 30_000 } = {}) {
  const browser = await chromium.launch({ headless: true })
  try {
    const context = await browser.newContext({ userAgent: USER_AGENT })
    const page = await context.newPage()
    page.setDefaultTimeout(timeoutMs)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs })
    return await fn(page)
  } finally {
    await browser.close()
  }
}
