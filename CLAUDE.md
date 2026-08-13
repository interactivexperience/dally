# Projekt: Prospekt-Filter-Webapp („Sparfuchs")

Vollständiges Konzept mit Architektur-Begründungen: **konzept.md** — bei Unklarheiten dort nachlesen, bevor du rätst.

## Tech-Stack
- Frontend: Vite + React (PWA), Tailwind — `app/`
- Backend/Daten: Firebase Auth (E-Mail/Passwort) + Firestore, Hosting via Firebase Hosting oder GitHub Pages
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
firebase.json           Hosting- + Firestore-Config
.github/workflows/      scrape.yml (Cron + manuell), deploy.yml (Hosting)
```

## Aktueller Stand
- Phase: **1 (MVP)** — Grundgerüst steht
  - Datenmodell + Firestore Security Rules angelegt
  - Firebase-Setup (Client-SDK + Admin-SDK) vorbereitet, wartet auf echtes Firebase-Projekt (Punkt "Offene TODOs" unten)
  - Scraper-Grundgerüst mit gemeinsamer Schnittstelle `scrape(branchConfig) → Offer[]`, Module für Rewe und dm (Playwright) als Proof of Concept
  - Einfache Filter-UI (Text-Suche + Discounter-Filter, ohne Themen-KI/Gemini — folgt Phase 2)
  - Ein Nutzer (Login), barrierefreies Grundlayout, UI dreisprachig (DE/VI/EN)
- Nächster Schritt: echtes Firebase-Projekt anlegen, Scraper-Selektoren gegen die Live-Websites verifizieren (siehe TODOs in `scraper/src/discounters/*.js`), erste echte Daten scrapen

## Offene TODOs (menschliches Zutun nötig, kann Claude nicht selbst erledigen)
- Firebase-Projekt anlegen (Auth E-Mail/Passwort aktivieren, Firestore anlegen), Web-App-Config in `app/.env` eintragen
- Firebase-Admin Service-Account-Key erzeugen, als GitHub-Actions-Secret `FIREBASE_SERVICE_ACCOUNT` hinterlegen
- CSS-Selektoren in `scraper/src/discounters/rewe.js` und `dm.js` gegen die aktuelle Live-Website prüfen/anpassen (Selektoren sind Platzhalter, Seiten sind JS-gerendert und ändern sich regelmäßig — siehe konzept.md Punkt 4)
- Erste Filialen für Münster in `scraper/config/branches.json` mit echten Adressen/Koordinaten ergänzen
- Gemini-API-Key besorgen (Phase 2, noch nicht benötigt)

## Befehle
Im Projekt-Root (npm workspaces für `app` und `scraper`):
- `npm install` — installiert beide Workspaces
- `npm run dev` — startet die Web-App lokal (Vite Dev-Server)
- `npm run build` — Production-Build der Web-App
- `npm run scrape` — führt den Scraping-Job lokal aus (braucht `scraper/.env` mit Firebase-Admin-Credentials)

Details siehe README.md.
