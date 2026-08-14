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
  Modul angelegt, Verifizierungsstand ist aber sehr unterschiedlich (siehe unten)
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
  - ❌ `netto.js`, `edeka.js`, `penny.js`, `lidl.js`, `rossmann.js` — **unverifizierte Platzhalter**,
    URL + Selektoren sind geraten (nach demselben Muster wie rewe.js/dm.js vor ihrer Verifizierung).
    Schlagen aktuell zuverlässig mit einer klaren Fehlermeldung fehl statt falsche Daten zu liefern
    (Fehlertoleranz greift, `scrapeStatus` zeigt das in der App an) - liefern aber noch keine echten
    Angebote. Bei `netto.js` zusätzlich ungeklärt: "Netto" ist doppelt vergeben (Netto Marken-Discount
    vs. Netto/Edeka) - muss vor dem Verifizieren geklärt werden. Bei `lidl.js`: möglich, dass Lidl
    Angebote nur als Blätterkatalog/Bildprospekt zeigt, nicht als normales HTML - dann bräuchte es
    einen anderen Ansatz als CSS-Selektoren.
- Nächster Schritt: echtes Firebase-Projekt anlegen, die fünf offenen Scraper nach und nach
  verifizieren (siehe Verifizierungs-Ablauf in `rewe.js`: echte HTML-Schnipsel einer Angebotskarte +
  der Marktauswahl liefern lassen, dann Selektoren/URL entsprechend anpassen)

## Offene TODOs (menschliches Zutun nötig, kann Claude nicht selbst erledigen)
- Firebase-Projekt anlegen (Auth E-Mail/Passwort aktivieren, Firestore anlegen), Web-App-Config in `app/.env` eintragen
- Firebase-Admin Service-Account-Key erzeugen, als GitHub-Actions-Secret `FIREBASE_SERVICE_ACCOUNT` hinterlegen
- GitHub Pages aktivieren: Repo → Settings → Pages → Source: GitHub Actions
- CSS-Selektoren + URLs in `netto.js`, `edeka.js`, `penny.js`, `lidl.js`, `rossmann.js` gegen die
  jeweilige Live-Website prüfen/anpassen (Selektoren sind Platzhalter, Seiten sind JS-gerendert und
  ändern sich regelmäßig — siehe konzept.md Punkt 4). Bei Netto vorher klären, welche der beiden
  Ketten gemeint ist.
- Echte Filialdaten (Adresse/PLZ/Koordinaten) für Netto, Edeka, Penny, Lidl, Rossmann und dm in
  `scraper/config/branches.json` ergänzen (bisher nur REWE hat eine echte Adresse)
- Gemini-API-Key besorgen (Phase 2, noch nicht benötigt)

## Befehle
Im Projekt-Root (npm workspaces für `app` und `scraper`):
- `npm install` — installiert beide Workspaces
- `npm run dev` — startet die Web-App lokal (Vite Dev-Server)
- `npm run build` — Production-Build der Web-App
- `npm run scrape` — führt den Scraping-Job lokal aus (braucht `scraper/.env` mit Firebase-Admin-Credentials)

Details siehe README.md.
