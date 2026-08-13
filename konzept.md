# Konzept: Prospekt-Filter-Webapp (Arbeitstitel „Sparfuchs")

Briefing-Dokument für die Umsetzung mit Claude Code. Scope: Familie/privater Gebrauch, MVP für Münster (NRW), kein laufendes Budget, Erweiterbarkeit auf weitere Städte/Discounter von Anfang an mitgedacht.

## 1. Zielsetzung

Statt wöchentlich 7 Prospekte manuell durchzublättern: eine App, die alle Angebote zentral sammelt, nach Themen filterbar macht (Windeln, Obst, ...) und relevante Angebote automatisch hervorhebt. MVP-Discounter: Rewe, Lidl, Edeka, Netto, Penny, dm, Rossmann – jeweils mit wählbaren Filialen in/um Münster.

## 2. Architekturüberblick

Gleiches Grundmuster wie bei deinem Periodentracker-Projekt (Vite/React + Firebase, GitHub-basiert, keine laufenden Kosten):

```
GitHub Actions (Cron, 1×/Woche + manuell auslösbar)
  → Scraper pro Händler (Node.js + Playwright/Cheerio)
  → Rohdaten normalisieren
  → Gemini-API: Kategorisierung + Tagging
  → Schreiben nach Firestore
                                        Firebase Auth (E-Mail/Passwort)
Vite/React PWA (GitHub Pages/Firebase Hosting) ←→ Firestore ←────┘
  → liest Angebote + User-Profil (Stadt, Umkreis, Filialen, Interessen, Sprache)
  → Filter/Highlight-Logik läuft clientseitig
  → „Aktualisieren"-Button löst Scraping-Lauf über kleinen Cloudflare Worker an
```

Der Scraper läuft **nicht** im Browser, sondern als eigener Job – das hält die Website sicher (keine Scraping-Logik/keine Zugangsdaten im Client) und die App selbst bleibt eine reine statische PWA.

## 3. Datenmodell (Firestore)

- `discounters`: `{id, name, logoUrl}`
- `branches`: `{id, discounterId, name, adresse, plz, ort, lat, lon}` – Filialliste, initial für Münster kuratiert/gescraped
- `offers`: `{id, discounterId, branchIds[], titel, beschreibung, preis, alterPreis, einheit, gueltigVon, gueltigBis, hinzugefuegtAm, bildUrl, kategorien[]}` – `branchIds` als Array, da ein Angebot meist für mehrere Filialen eines Händlers gilt. `hinzugefuegtAm` = Zeitstempel des Scraping-Laufs, in dem das Angebot erstmals erschien (Basis für „neu diese Woche"). `bildUrl` zeigt auf das **Original** auf der Händler-Website (Hotlink), es wird kein eigenes Bild-Hosting/Kopie angelegt (siehe Punkt 16, Bildrechte)
- `users`: `{id, email, stadt, umkreisKm, ausgewaehlteFilialen[], interessenKategorien[], sprache, pushToken?}`
- `scrapeStatus`: `{discounterId, letzterLauf, erfolgreich, fehlerMeldung?}` – für Anzeige „zuletzt aktualisiert" und Fehler-Monitoring

## 4. Scraping-Strategie (pro Händler-Website)

Du hast dich für die genauere, aber wartungsintensivere Variante entschieden: jeder Discounter wird direkt auf seiner eigenen Website gescraped. Konsequenzen fürs Konzept:

- **Ein Scraper-Modul pro Händler**, gleiche Schnittstelle (`scrape(branchConfig) → Offer[]`), damit ein einzelner kaputter Scraper nicht die anderen blockiert
- Discounter-Websites sind unterschiedlich gebaut (statisches HTML vs. JS-Framework) → vermutlich **Playwright** als gemeinsamer Nenner (headless Browser), bei einfacheren Seiten reicht Cheerio – das entscheidet sich pro Händler, sollte man beim Bau iterativ prüfen
- **Frequenz:** wöchentlich automatisch (Prospekte laufen meist Mo–Sa), zusätzlich manuell per Knopfdruck auslösbar (siehe Punkt 9)
- **Fehlertoleranz ist Pflicht:** wenn ein Scraper bricht (Website-Redesign passiert regelmäßig), soll der Job für die anderen Händler trotzdem durchlaufen und nur eine Warnung/Log für den kaputten Scraper hinterlassen – sonst hast du irgendwann eine leere App
- **Rechtliche Grauzone, offen benannt:** Scraping der Händler-Websites verstößt oft gegen deren Nutzungsbedingungen; für rein privaten, nicht-kommerziellen Gebrauch (keine Weiterverbreitung, kein Public-Access) ist das Risiko gering, aber nicht null. Robots.txt beachten, moderate Frequenz, keine aggressive Parallelisierung. Das ist eine bewusste Annahme, kein Freifahrtschein – solltest du die App später öffentlich machen wollen, müsste das neu bewertet werden.

## 5. KI-Integration (Gemini)

Zwei Aufgaben, beide serverseitig im Scraping-Job (Gemini-Key liegt als GitHub-Actions-Secret, taucht nie im Client auf):

1. **Kategorisierung:** Rohtext/Titel jedes Angebots → Kategorie-Tags (Obst, Windeln, Getränke, ...) aus einer festen Taxonomie, damit Filter konsistent funktionieren
2. **Persönliche Hervorhebung:** clientseitig – Angebote, deren Kategorien mit den gespeicherten Interessen des Users überlappen, werden hervorgehoben/oben einsortiert. Kein zusätzlicher API-Call nötig, das ist reine Filterlogik auf Basis der Kategorien aus Schritt 1

Damit bleibt Gemini auf einen einzigen, klar begrenzten Zweck reduziert (kein Chat, keine Live-Anfragen) – passt zu „sollte sinnig sein" und hält die Kosten/Komplexität niedrig (kostenloses Kontingent von Gemini reicht für wöchentliches Batch-Tagging von ein paar hundert Angeboten locker).

**Startansicht „Diese Woche neu":** Statt einer generischen Gesamtliste landet man beim Öffnen der App direkt auf einer nach `hinzugefuegtAm` sortierten Ansicht der aktuellen Woche – kombiniert mit der Interessen-Hervorhebung aus Schritt 2 ergibt das automatisch eine vorsortierte „das ist für dich neu und relevant"-Ansicht, ganz ohne zusätzliche Infrastruktur (nur das `hinzugefuegtAm`-Feld aus Punkt 3).

## 6. Sicherheit

- **Auth:** Firebase E-Mail/Passwort wie beim Periodentracker, jeder Familien-Account einzeln anlegbar
- **Firestore Security Rules:** User können nur ihr eigenes `users/{uid}`-Dokument lesen/schreiben; `offers`/`branches`/`discounters` sind read-only für authentifizierte User, Schreibzugriff nur über den Actions-Job (Service-Account-Key, nicht im Client)
- **Secrets:** Gemini-API-Key, Firebase-Admin-Credentials und der GitHub-Token für den Aktualisieren-Button ausschließlich serverseitig (Cloudflare-Worker-Secret bzw. Actions-Secrets), nie im Repo/Client-Bundle
- **Transport:** HTTPS durchgehend (GitHub Pages/Firebase Hosting liefern das automatisch)
- **Datensparsamkeit:** keine Standortdaten der User selbst speichern, nur die von ihnen gewählte Stadt + Umkreis + Filial-Auswahl (das sind keine Echtzeit-Standortdaten)

## 7. Mehrere Nutzer & mehrere Standorte pro Discounter

- Beliebig viele Nutzer-Accounts (Familie), jeder mit eigenem Profil
- Pro Discounter kann ein Nutzer **mehrere** Filialen auswählen (z. B. „Lidl Hammer Straße" + „Lidl Weseler Straße"), Angebote werden dann für die Vereinigung der gewählten Filialen angezeigt

## 8. Umkreis-/Städteauswahl

- MVP: Stadt fix „Münster", `umkreisKm` als Slider/Auswahl (z. B. 2/5/10/20 km)
- Filialen brauchen Koordinaten (`lat/lon`), Umkreisfilter = einfache Distanzberechnung (Haversine) clientseitig gegen die gewählte Stadt-Koordinate
- Architektur so anlegen, dass „Stadt" von Anfang an ein Datenfeld ist, kein Hardcoding – das ist die Grundlage für Punkt 11

## 9. Manuelles Aktualisieren per Knopfdruck

Da der Scraper serverseitig läuft (nicht im Browser), kann ein Button in der App nicht direkt scrapen – er muss einen Lauf anstoßen. Zwei Ebenen, beide sinnvoll kombiniert:

1. **Schnelle Ansicht aktualisieren** (kein Risiko, kein Trigger nötig): Button lädt einfach die neuesten Daten aus Firestore neu – deckt den Fall „ein Familienmitglied hat gerade woanders aktualisiert" ab
2. **Echten Scraping-Lauf anstoßen:** ein kleiner **Cloudflare Worker** (statt Firebase Cloud Function) als Trigger-Proxy, aufgerufen vom authentifizierten Client, löst per GitHub API (`workflow_dispatch`) den Actions-Workflow aus. Der GitHub-Token liegt nur im Worker-Secret, nie im Client
   - **Cool-down einbauen** (z. B. 1× pro Stunde), damit nicht versehentlich mehrfach hintereinander ein voller Scraping-Lauf mit Playwright ausgelöst wird (Actions-Minuten, Gemini-Aufrufe)
   - **Warum Cloudflare Worker statt Firebase Cloud Function:** Cloud Functions setzen technisch den „Blaze"-Tarif voraus (Aufrufe/Rechenzeit sind dort zwar großzügig kostenlos, aber es muss eine Kreditkarte hinterlegt und ein Budget-Limit selbst gesetzt werden). Ein Cloudflare Worker im Free-Tier (100.000 Requests/Tag) braucht das nicht – dadurch bleibt die **gesamte** Infrastruktur ohne Billing-Konto, konsequent im „kein laufendes Budget"-Rahmen
   - Der Button zeigt den Live-Status aus `scrapeStatus` an (z. B. „läuft…", „zuletzt aktualisiert vor 3 Minuten")

## 10. Push-Benachrichtigungen (Bonus, Phase 2)

- Firebase Cloud Messaging (Web Push), passt zur bestehenden Firebase-Basis, keine zusätzlichen Kosten im kleinen Rahmen
- Trigger: neue Angebote in einer der Interessen-Kategorien des Users nach jedem Scraping-Lauf
- Bewusst als **spätere Phase** einordnen, nicht MVP – PWA-Grundgerüst muss dafür ohnehin stehen (Service Worker etc.)

## 11. Erweiterbarkeit auf neue Städte/Discounter

- **Neue Filiale/Stadt eines bestehenden Discounters:** nur neuer Eintrag in `branches` + ggf. Anpassung des Such-Parameters im Scraper (meist PLZ oder Filial-ID) – kein Code-Duplikat nötig, wenn der Scraper von Anfang an parametrisiert gebaut wird
- **Neuer Discounter:** neues Scraper-Modul nach demselben Interface, Rest der App (Datenmodell, Filter, UI) bleibt unverändert
- Diese Konfigurierbarkeit ist der wichtigste Architektur-Grundsatz für Claude Code beim Bau: **nichts Münster-Spezifisches hart in Komponenten oder Scraper-Logik verdrahten**

## 12. Deployment

- Frontend: GitHub Pages oder Firebase Hosting (beides kostenlos, du hast mit GitHub Pages beim Spielregal-Projekt schon Erfahrung/eine offene Baustelle – ggf. lohnt sich hier direkt Firebase Hosting, um das bekannte Actions-Restriction-Problem zu umgehen)
- Scraping: GitHub Actions Cron-Workflow, öffentliches oder privates Repo (bei privatem Repo Actions-Freiminuten beachten, falls Playwright viel Laufzeit braucht)
- Kein eigener Server, keine laufenden Kosten und kein Billing-Konto nötig – auch der Cloudflare Worker für den Aktualisieren-Button (siehe Punkt 9) läuft im kostenlosen Free-Tier ohne Kreditkarten-Hinterlegung

## 13. Barrierefreiheit (ältere Menschen als Zielgruppe mitgedacht)

Kein nachträglicher Feinschliff, sondern von Anfang an Design-Vorgabe:

- **Große, gut lesbare Schrift** als Standard, zusätzlich eine Schriftgrößen-Einstellung (klein/normal/groß) im Nutzerprofil
- **Hoher Kontrast**, keine dünnen/hellgrauen Schriftfarben, klare Abgrenzung zwischen Angebots-Karten
- **Große Touch-Ziele** (Buttons, Filter-Chips) statt kleiner Icons, ausreichend Abstand zwischen klickbaren Elementen
- **Einfache, lineare Navigation** ohne verschachtelte Menüs oder Wisch-Gesten als einzige Bedienmöglichkeit – alles auch per Tap erreichbar
- **Klare, einfache Sprache** in der UI (keine Fachbegriffe/Anglizismen wo vermeidbar)
- **Kein Zeitdruck:** keine automatisch verschwindenden Hinweise/Toasts, die man verpassen kann, wenn man länger zum Lesen braucht
- Technisch: semantisches HTML, ausreichende Farbkontraste nach WCAG-Richtwerten, Screenreader-taugliche Beschriftungen – auch wenn Screenreader-Nutzung hier vermutlich selten vorkommt, ist die Grundlage kostenlos „mitgebaut", wenn man von Anfang an sauber markiert

## 14. Mehrsprachigkeit (Deutsch, Vietnamesisch, Englisch)

- UI-Texte über eine Übersetzungs-Bibliothek (z. B. react-i18next), Sprachauswahl im Nutzerprofil (`sprache`-Feld, siehe Datenmodell), pro Familienmitglied individuell einstellbar
- **Wichtige Unterscheidung:** das betrifft zunächst nur die **App-Oberfläche** (Buttons, Menüs, Hinweise). Die Angebots-**Inhalte** selbst (Produktnamen, Beschreibungen) kommen auf Deutsch von den Händler-Websites
- Für übersetzte Angebotsinhalte gibt es zwei Optionen, als Ausbaustufe zu behandeln:
  - Gemini übersetzt beim Scraping-Lauf zusätzlich Titel/Beschreibung mit (mehr API-Calls, aber im Batch überschaubar)
  - oder die Übersetzung passiert erst clientseitig bei Bedarf (z. B. Übersetzen-Button pro Angebot)
- Empfehlung fürs MVP: UI dreisprachig von Anfang an, Angebotsinhalte bleiben zunächst Deutsch – Content-Übersetzung als Phase-2/3-Ausbaustufe, um die erste Version nicht zu verzögern

## 15. Phasenplan für Claude Code

1. **Phase 1 (MVP):** Datenmodell + Firebase-Setup, 1–2 Scraper (z. B. Rewe, dm) als Proof of Concept, einfache Filter-UI ohne Themen-KI, ein Nutzer, barrierefreies Grundlayout, UI dreisprachig (DE/VI/EN)
2. **Phase 2:** restliche Scraper, Gemini-Kategorisierung, Themen-Filter + Hervorhebung, mehrere Nutzer/Familien-Accounts, mehrere Filialen pro Discounter, „Aktualisieren"-Button (zunächst nur Firestore-Reload)
3. **Phase 3:** echter Trigger für Scraping-Lauf per Button (Cloudflare Worker + workflow_dispatch), Umkreissuche mit echter Distanzberechnung, Push-Benachrichtigungen
4. **Phase 4:** Städte-/Discounter-Erweiterbarkeit als „echtes" Feature (Auswahl-UI für neue Stadt, nicht nur intern konfigurierbar), optional Übersetzung der Angebotsinhalte

## 16. Was zusätzlich relevant sein könnte (bisher nicht erwähnt)

- **Ablauf-Handling:** Angebote haben ein Gültigkeitsende – abgelaufene automatisch ausblenden/löschen, sonst füllt sich die DB mit Datenmüll
- **„Neu"-Kennzeichnung zeitlich begrenzen:** die „Diese Woche neu"-Ansicht (Punkt 5) braucht eine klare Regel, wie lange ein Angebot als „neu" gilt (z. B. 7 Tage ab `hinzugefuegtAm`), sonst sammeln sich alte „NEU"-Badges an und die Startansicht wird mit der Zeit wieder unübersichtlich – am einfachsten löst man das rein clientseitig über einen Datumsvergleich, ohne zusätzliches Feld
- **Duplikaterkennung:** dasselbe Produkt kann bei mehreren Händlern im Angebot sein – evtl. später ein „bester Preis über alle Händler"-Vergleich als Ausbaustufe
- **Bildrechte:** Prospektbilder sind auf den Händler-Websites öffentlich einsehbar, dürfen aber nicht einfach heruntergeladen und in eigenem Storage dauerhaft kopiert werden (Urheberrecht der Produktfotos). Praktikabler Mittelweg: der Scraper speichert nur die **Original-Bild-URL**, die App bettet das Bild per Hotlink direkt von der Händler-Website ein (kein eigener Upload/keine Kopie in Firebase Storage) – das ist näher am „Anschauen" als am „Vervielfältigen" und deutlich risikoärmer bei weiterhin vollem visuellem Nutzen
- **Offline-Fähigkeit:** als PWA mit Service Worker macht die App auch ohne Netz nutzbar (z. B. beim Einkaufen im Keller-Discounter ohne Empfang)
- **Monitoring der Scraper:** der `scrapeStatus`-Eintrag pro Discounter zeigt in der App, wenn ein Scraper länger nicht mehr erfolgreich lief
- **Gemini-Kosten-Deckel:** auch im Freikontingent lohnt sich ein harter Limit/Batch-Ansatz (ein Call pro Scraping-Lauf statt pro Angebot), damit das nicht aus Versehen eskaliert – bei manuellem Aktualisieren zusätzlich wichtig wegen des Cool-downs aus Punkt 9
- **DSGVO-Minimalismus:** auch bei nur Familien-Nutzung lohnt sich ein kurzer Hinweistext (keine Weitergabe der Daten, wo sie liegen), einfach als gute Praxis, wenn E-Mail-Adressen gespeichert werden
