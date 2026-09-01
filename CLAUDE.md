# Projekt: Prospekt-Filter-Webapp („Sparfuchs")

Vollständiges Konzept mit Architektur-Begründungen: **konzept.md** — bei Unklarheiten dort nachlesen, bevor du rätst.

## Tech-Stack
- Frontend: Vite + React (PWA), Tailwind — `app/`
- Backend/Daten: Firebase Auth (E-Mail/Passwort) + Firestore
- Hosting: GitHub Pages (Projekt-Seite unter `/dally/`, Deploy via `actions/deploy-pages`)
- Scraping: Node.js + Playwright/Cheerio, ausgeführt als GitHub-Actions-Cron-Job (wöchentlich + manuell auslösbar) — `scraper/`
- KI: Gemini API (Kategorisierung der Angebote im Scraping-Job, serverseitig) — **Phase 2**, in Phase 1 noch nicht integriert
- Trigger für manuelles Aktualisieren: Cloudflare Worker (kein Firebase Blaze/Billing-Konto nötig) — **Phase 3**
- i18n: react-i18next (Deutsch, Vietnamesisch, Englisch — UI, nicht Angebotsinhalte)

## Grundsätze (nicht verhandelbar)
- Sicherheit zuerst: keine Secrets im Client, Firestore Security Rules pro User, Scraper schreibt nur serverseitig
- Nichts Münster-Spezifisches hart codieren — Stadt/Filiale/Discounter sind Konfiguration, keine Konstanten (siehe konzept.md Punkt 11)
- Barrierefreiheit ist Design-Vorgabe, kein Nachgang: große Schrift/Kontrast/Touch-Ziele von Anfang an (konzept.md Punkt 13)
- Bildlinks nur als Hotlink zum Original, keine eigenen Bildkopien (konzept.md Punkt 16)
- Kein Feature ohne Kostenlos-Weg — vor jeder neuen Abhängigkeit prüfen, ob sie ein Billing-Konto erzwingt

## Repo-Struktur
```
app/                    Vite/React PWA (Frontend)
scraper/                Node.js Scraping-Job (läuft nur in GitHub Actions, nie im Client)
firestore.rules         Security Rules (siehe konzept.md Punkt 6)
firebase.json           Firestore-Config (Rules-Deploy)
.github/workflows/      scrape.yml (Cron + manuell), deploy.yml (GitHub Pages)
```

## Aktueller Stand
- Phase: **1 (MVP)** — Grundgerüst steht, Scraper-Abdeckung geht schon über den ursprünglichen
  Phase-1-Scope (Rewe+dm als PoC) hinaus: alle 7 MVP-Discounter aus konzept.md Punkt 1 sind als
  Modul angelegt, plus **Aldi Nord als Ergänzung über konzept.md hinaus** (auf Nutzerwunsch,
  nicht ursprünglich in Punkt 1 gelistet). Verifizierungsstand ist sehr unterschiedlich (siehe unten)
  - Datenmodell + Firestore Security Rules angelegt
  - Firebase-Setup (Client-SDK + Admin-SDK) vorbereitet, wartet auf echtes Firebase-Projekt (Punkt "Offene TODOs" unten)
  - Scraper-Grundgerüst mit gemeinsamer Schnittstelle `scrape(branchConfig) → Offer[]`,
    fehlertolerante Orchestrierung (ein kaputtes Modul blockiert die anderen nicht)
  - Einfache Filter-UI (Text-Suche + Discounter-Filter, ohne Themen-KI/Gemini — folgt Phase 2)
  - Ein Nutzer (Login), barrierefreies Grundlayout, UI dreisprachig (DE/VI/EN)
- **Scraper-Verifizierungsstand pro Discounter** (`scraper/src/discounters/*.js`):
  - ✅ `rewe.js` — gegen echte Angebotsseite verifiziert (REWE Markt Wolbeckerstraße 44, Münster), funktioniert
  - ⚠️ `dm.js` — verifiziert, aber bewusst reduzierter Umfang: dm.de hat keine Preis-Angebotsseite wie
    REWE, nur Marketing-Kampagnen-Kacheln (`/neu/aktionen`) ohne Produktpreis. Übernommen als
    Info-Angebote ohne `preis`/`alterPreis`
  - ⚠️ `lidl.js` — verifiziert, aber wie dm reduzierter Umfang: Lidl zeigt Angebote als
    Blätterkatalog-Bildseiten (`leaflets.schwarz`-Plattform), Preis ist nur im Seitenbild eingebrannt,
    nicht als Text/Daten. Übernommen als Info-Angebote (Titel aus Hotspot-`aria-label` + Seitenbild
    als `bildUrl`, echter Gültigkeitszeitraum aus dem Seiten-alt-Text) ohne `preis`/`alterPreis`. Die
    aktuelle Wochen-Flyer-URL wird automatisch über ein JSON-LD (schema.org OfferCatalog) auf der
    Prospekt-Übersichtsseite gefunden - kein manuelles wöchentliches URL-Update nötig. Die Hotspots
    öffnen beim Klick eine Seitenleiste, die vermutlich per AJAX den Preis nachlädt - noch nicht
    geprüft, wäre der Weg zu echten Preisen
  - ⚠️ `netto.js` — verifiziert, gemeint ist **Netto Marken-Discount** (schwarz-gelb, nicht das zu
    Edeka gehörende rot-gelbe Netto - das war zwischenzeitlich falsch angenommen). Zweistufig: die
    aktuelle Wochen-Flyer-URL wird automatisch von der Prospekt-Übersichtsseite gelesen (Ausgabe-Code
    ändert sich wöchentlich), dann wird die Publitas-Blätteransicht seitenweise durchgegangen. Noch
    reduzierter als Lidl: hier gibt es NICHT einmal Produktnamen pro Hotspot (nur generisches
    "Mehr Infos", echter Link erst per Klick/AJAX), nur einen großen unstrukturierten OCR-Text pro
    Seite. Nutzerentscheidung: jede Prospektseite wird als EIN Angebot übernommen (Titel "Netto
    Angebote - Seite N", Seitenbild als `bildUrl`, roher OCR-Text als `beschreibung` fürs
    Durchsuchen, Gültigkeitszeitraum aus dem OCR-Text geparst wo vorhanden) - kein Versuch, einzelne
    Produkte/Preise herauszulösen
  - ⚠️ `edeka.js` — verifiziert, noch reduzierter als Netto: der Blätterkatalog von
    blaetterkatalog.edeka.de ist rein Canvas-gerendert, liefert NICHT MAL einen OCR-Text (anders als
    Netto) - nur nackte Seitenbild-URLs ohne Beschriftung. Auf Nutzerentscheidung ("wie es ist") wird
    der Katalog deshalb gar nicht geöffnet: stattdessen wird direkt von der Marktseite
    (`edeka.de/maerkte/<id>/prospekte/`) je Prospekt-Ausgabe (z. B. "Angebote der Woche",
    "SUUPER Angebote") EIN Angebot übernommen - Titel, Vorschaubild (erste Katalogseite), echter
    Gültigkeitszeitraum aus dem Seitentext. Kein Durchblättern, keine einzelnen Produkte
  - ✅ `penny.js` — bester Fall nach REWE: Penny (REWE-Group-Schwester) zeigt Angebote als echte
    Karten-Liste (nicht Blätterkatalog), inklusive Preis UND teilweise Streichpreis. Gegen echte
    Angebotskarten der Penny-Hansaring-Seite verifiziert (14.08.2026): Kartenselektor
    `a.offer-tile__link[data-detail-url]` erfasst nur echte Angebote, weder Empfehlungs-Kacheln noch
    Lazy-Loading-Platzhalter. Preis-Logik behandelt drei Kartenvarianten (einfacher Preis, Preis mit
    Streichpreis, sowie App-exklusiver Preis + sekundäre Bubble mit UVP/regulärem Preis - hier wird
    bewusst die sekundäre/reguläre Bubble genommen, nicht die App-exklusive). Zwei Annahmen sind
    NICHT live testbar gewesen: ob ein vorheriger Besuch der Marktseite (`/markt/<pfad>`) tatsächlich
    die Marktauswahl für `/angebote` setzt, und ob die eingebaute Auto-Scroll-Schleife das
    AJAX-Nachladen der anfangs nur als Platzhalter sichtbaren Kategorien zuverlässig auslöst.
    gueltigVon/Bis wurden auf keiner Karte gefunden, bleiben vorerst null.
  - ✅ `rossmann.js` — echter, paginierter Produktkatalog mit Online-Shop-Preisen (anders als
    ursprünglich vermutet: keine Kampagnen-Kacheln ohne Preis wie bei dm). Gegen echte Angebotsseite
    verifiziert (14.08.2026): Kartenselektor `[data-testid="product-card"]`, Titel aus
    `data-item-name`-Attribut (bereits Entity-dekodiert), Preis aus dem sr-only-Preistext
    ("Artikelpreis X,XX €"), Grundpreis/Einheit aus `[data-testid="product-baseprice"]`, Bild-URL
    ist bereits die echte CDN-URL. Gültigkeitszeitraum steht einmal im Seitenkopf ("Gültig ab
    Montag: DD.MM. - DD.MM.YYYY") und wird auf alle Angebote der Seite angewendet. Paginierung über
    `?pageIndex=N`, Gesamtseitenzahl wird aus der Seiten-Navigation gelesen. WICHTIGE EINSCHRÄNKUNG:
    die Seite ist NICHT filialspezifisch (keine Marktauswahl gefunden, bundesweiter Online-Katalog) -
    `sucheParam` wird deshalb wie bei dm nicht benutzt. Kein durchgestrichener alter Preis/UVP auf
    den gesehenen Karten gefunden, `alterPreis` bleibt deshalb immer null (wie bei rewe.js).
  - ❌ `aldi.js` — **unverifizierter Platzhalter**,
    URL + Selektoren sind geraten (nach demselben Muster wie rewe.js/dm.js vor ihrer Verifizierung).
    Schlägt aktuell zuverlässig mit einer klaren Fehlermeldung fehl statt falsche Daten zu liefern
    (Fehlertoleranz greift, `scrapeStatus` zeigt das in der App an) - liefert aber noch keine echten
    Angebote. Aldi Nord ist eine Ergänzung über konzept.md hinaus.
- Nächster Schritt: echtes Firebase-Projekt anlegen, den letzten offenen Scraper (Aldi Nord)
  verifizieren (siehe Verifizierungs-Ablauf in `rewe.js`: echte HTML-Schnipsel einer Angebotskarte +
  der Marktauswahl liefern lassen, dann Selektoren/URL entsprechend anpassen). Bei Lidl optional noch
  prüfen, ob sich über die Hotspot-Seitenleiste echte Preise nachladen lassen. Bei Penny optional
  noch prüfen (sobald Live-Zugriff möglich), ob Marktauswahl-Navigation und Auto-Scroll tatsächlich
  wie angenommen funktionieren.

## Offene TODOs (menschliches Zutun nötig, kann Claude nicht selbst erledigen)
- Firebase-Projekt anlegen (Auth E-Mail/Passwort aktivieren, Firestore anlegen), Web-App-Config in `app/.env` eintragen
- Firebase-Admin Service-Account-Key erzeugen, als GitHub-Actions-Secret `FIREBASE_SERVICE_ACCOUNT` hinterlegen
- GitHub Pages aktivieren: Repo → Settings → Pages → Source: GitHub Actions
- CSS-Selektoren + URL in `aldi.js` gegen die Live-Website prüfen/anpassen (Selektoren sind
  Platzhalter, Seiten sind JS-gerendert und ändern sich regelmäßig — siehe konzept.md Punkt 4)
- Bei Penny live prüfen, ob die Marktauswahl-Navigation (`/markt/<pfad>` vor `/angebote`) und die
  Auto-Scroll-Schleife fürs Nachladen der restlichen Kategorien tatsächlich wie in `penny.js`
  angenommen funktionieren
- Echte Filialdaten (Adresse/PLZ/Koordinaten) für Lidl, Aldi Nord und dm in
  `scraper/config/branches.json` ergänzen (Rewe, Netto, Edeka, Penny haben bereits echte Adressen -
  bei Penny fehlt noch die geprüfte PLZ; Rossmann/dm sind bundesweite, nicht filialspezifische
  Kataloge, dort ist adresse/plz/lat/lon nur für die Anzeige relevant)
- Gemini-API-Key besorgen (Phase 2, noch nicht benötigt)

## Befehle
Im Projekt-Root (npm workspaces für `app` und `scraper`):
- `npm install` — installiert beide Workspaces
- `npm run dev` — startet die Web-App lokal (Vite Dev-Server)
- `npm run build` — Production-Build der Web-App
- `npm run scrape` — führt den Scraping-Job lokal aus (braucht `scraper/.env` mit Firebase-Admin-Credentials)

Details siehe README.md.
