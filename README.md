# Sparfuchs

Prospekt-Filter-Webapp: sammelt Angebote mehrerer Discounter, macht sie durchsuchbar/filterbar
und zeigt eine „Diese Woche neu"-Startansicht. Hintergrund und Architektur-Begründungen: siehe
[`konzept.md`](./konzept.md). Aktueller Baustand und offene TODOs: siehe [`CLAUDE.md`](./CLAUDE.md).

**Phase 1 (MVP), aktueller Stand:** Datenmodell + Firestore Security Rules, Firebase-Client/-Admin-Setup,
Scraper-Module für alle 7 MVP-Discounter aus konzept.md (Rewe, dm, Netto, Edeka, Penny, Lidl,
Rossmann) plus Aldi Nord als Ergänzung - davon sind **Rewe, Penny und Rossmann vollständig verifiziert
und funktionsfähig** (inkl. echter Preise), dm/Lidl/Netto/Edeka liefern verifizierte, aber bewusst
reduzierte Angebote (siehe "Scraper: wichtige Einschränkung" unten), Aldi Nord ist noch ein
unverifizierter Platzhalter. Dazu: einfache Filter-UI (Text + Händler, ohne KI-Kategorisierung), Login
für einen Nutzer, barrierefreies Grundlayout, UI auf Deutsch/Vietnamesisch/Englisch.

## Projektstruktur

```
app/                    Vite/React PWA (Frontend, liest nur aus Firestore)
scraper/                Node.js-Job, läuft nur in GitHub Actions bzw. lokal - nie im Browser
firestore.rules         Security Rules
firebase.json           Firestore-Config (Rules-Deploy)
.github/workflows/      scrape.yml (wöchentlich + manuell), deploy.yml (GitHub Pages bei Push)
```

## Einmaliges Setup

### 1. Firebase-Projekt anlegen

1. Neues Projekt in der [Firebase Console](https://console.firebase.google.com/) anlegen
2. **Authentication** aktivieren, Anbieter **E-Mail/Passwort** einschalten
3. **Firestore Database** anlegen (Produktionsmodus - die Regeln kommen aus `firestore.rules`)
4. Unter Projekteinstellungen → Deine Apps → Web-App hinzufügen, die Config-Werte notieren
5. Ersten (und für Phase 1 einzigen) Nutzer-Account manuell in der Firebase Console unter
   Authentication → Users anlegen (E-Mail + Passwort) - es gibt bewusst noch keine
   Selbstregistrierung in der App

### 2. Firebase-Admin Service Account

1. Projekteinstellungen → Dienstkonten → Neuen privaten Schlüssel generieren (JSON-Datei)
2. **Nie committen.** Wird als GitHub-Actions-Secret hinterlegt (siehe unten) bzw. lokal in
   `scraper/.env`

### 3. Firestore Security Rules deployen

```bash
npm install -g firebase-tools
firebase login
firebase use <dein-projekt-id>
firebase deploy --only firestore:rules
```

### 4. GitHub Pages aktivieren

Repo → Settings → Pages → **Source: GitHub Actions** (einmalig, sonst deployt `deploy.yml` ins Leere).
Die App landet danach unter `https://interactivexperience.github.io/dally/`.

### 5. GitHub-Actions-Secrets hinterlegen

Unter Repo → Settings → Secrets and variables → Actions:

| Secret | Verwendet von | Inhalt |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | scrape.yml | kompletter Inhalt der Service-Account-JSON |
| `FIREBASE_PROJECT_ID` | scrape.yml | Firebase-Projekt-ID |
| `VITE_FIREBASE_API_KEY` | deploy.yml | aus der Web-App-Config |
| `VITE_FIREBASE_AUTH_DOMAIN` | deploy.yml | aus der Web-App-Config |
| `VITE_FIREBASE_PROJECT_ID` | deploy.yml | aus der Web-App-Config |
| `VITE_FIREBASE_STORAGE_BUCKET` | deploy.yml | aus der Web-App-Config |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | deploy.yml | aus der Web-App-Config |
| `VITE_FIREBASE_APP_ID` | deploy.yml | aus der Web-App-Config |

`FIREBASE_SERVICE_ACCOUNT`/`FIREBASE_PROJECT_ID` werden nur vom Scraping-Job gebraucht, nicht mehr
fürs Deployment - die App liegt jetzt auf GitHub Pages statt Firebase Hosting.

## Lokale Entwicklung

```bash
npm install                          # installiert app/ + scraper/ (npm workspaces)

cp app/.env.example app/.env         # Firebase-Web-Config eintragen
npm run dev                          # startet die App unter localhost

cp scraper/.env.example scraper/.env # FIREBASE_SERVICE_ACCOUNT + FIREBASE_PROJECT_ID eintragen
npm run scrape                       # führt den Scraping-Job einmal lokal aus
```

## Scraper: wichtige Einschränkung

Verifizierungsstand pro Discounter (`scraper/src/discounters/`):

| Discounter | Status |
|---|---|
| Rewe | ✅ funktioniert, gegen echte Angebotsseite verifiziert |
| dm | ⚠️ funktioniert, aber nur Info-Kacheln ohne Preis (dm.de hat keine Preis-Angebotsseite wie Rewe) |
| Lidl | ⚠️ funktioniert, aber nur Titel + Seitenbild ohne Preis (Blätterkatalog-Bildseiten, Preis nur im Bild) |
| Netto | ⚠️ funktioniert, aber nur ganze Prospektseiten ohne Preis (Publitas-Blätterkatalog ohne saubere Produktdaten, siehe TODO in netto.js) |
| Edeka | ⚠️ funktioniert, aber nur je ein Eintrag pro Prospekt-Ausgabe (Titel+Vorschaubild+Zeitraum) - der Blätterkatalog liefert nicht mal OCR-Text wie bei Netto |
| Penny | ✅ funktioniert, gegen echte Angebotskarten verifiziert (inkl. Preis + teils Streichpreis) - Marktauswahl-Navigation und Auto-Scroll fürs Nachladen sind aber ungetestete Annahmen, siehe penny.js |
| Rossmann | ✅ funktioniert, echter paginierter Produktkatalog mit Online-Shop-Preisen verifiziert - aber NICHT filialspezifisch (bundesweiter Katalog, kein alter Preis/UVP auf den Karten) |
| Aldi Nord | ❌ unverifizierter Platzhalter, URL + Selektoren sind geraten |

Das letzte noch offene Modul (Aldi Nord) wurde ohne Zugriff auf die Live-Website gebaut und braucht
vor dem ersten echten Lauf eine Prüfung/Anpassung per Browser-DevTools (Selektoren sind mit
`// TODO verifizieren` markiert, siehe auch die ausführlicheren Hinweise am Kopf der Datei). Das ist
keine Nachlässigkeit, sondern folgt bewusst konzept.md Punkt 4: Discounter-Websites ändern ihr Markup
regelmäßig, das ist laufender Wartungsaufwand, kein einmaliges Setup - Rewe, dm, Penny und Rossmann
zeigen im Kommentar am Dateikopf, wie der Verifizierungs-Ablauf aussieht (echte HTML-Schnipsel einer
Angebotskarte + der Marktauswahl besorgen, Selektoren entsprechend anpassen, mit einem kleinen
Testskript gegenprüfen).

Ebenso sind die Filialdaten in `scraper/config/branches.json` für Lidl, Rossmann, Aldi Nord und dm
aktuell **ungeprüfte Platzhalter** (Münster-Zentrums-Koordinaten, keine echte Adresse) - bei dm und
Rossmann ist das unkritisch, da beide bundesweite, nicht filialspezifische Kataloge scrapen. Rewe,
Netto, Edeka und Penny haben echte Adressen (Penny noch ohne geprüfte PLZ/Koordinaten) - vor dem
ersten Lauf des jeweiligen Scrapers durch echte, vollständig verifizierte Filialdaten ersetzen.

Scraping erfolgt sequenziell (nicht parallel) und mit moderater Frequenz (wöchentlicher Cron +
manuelles `workflow_dispatch`), robots.txt der jeweiligen Seite sollte vor dem produktiven Einsatz
geprüft werden - siehe konzept.md Punkt 4 zur rechtlichen Einordnung.

## Was fehlt bewusst noch (Phase 2+)

Siehe konzept.md Punkt 15 für den vollständigen Phasenplan. Nicht Teil von Phase 1:
Gemini-Kategorisierung/Themen-Filter, mehrere Nutzer-Accounts, mehrere Filialen pro Discounter,
echter Aktualisieren-Button (Cloudflare Worker), Umkreissuche mit Haversine, Push-Benachrichtigungen.
