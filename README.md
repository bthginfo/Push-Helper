# PUSH Companion

Eine mobile Agenda für Julius, Daniel, Tobi und Rafi auf der PUSH UX am **22. und 23. Oktober 2026** in München. React, TypeScript und Vite; gemeinsame Planung über eine Vercel Function und privaten Vercel Blob Storage.

## Funktionen

- 63 Agenda-Einträge: Keynotes, alle Breakout-Optionen, Lightning-Talk-Blöcke, acht Roundtables, Pausen und Networking.
- Live-Status und nächster Termin nach Münchner Ortszeit (`Europe/Berlin`), automatische Tagesauswahl und Countdown vor der Konferenz.
- Suche, Raum-/Formatfilter, persönliche und gemeinsame Auswahl, Warnungen bei Terminüberschneidungen.
- Detail-Sheets mit deutschen redaktionellen Kurzfassungen und Links zu den Originalinformationen.
- Private Einladungslinks mit vorausgewähltem Profil, getrennte Favoriten für Julius, Daniel, Tobi und Rafi, lokale Speicherung und Synchronisierung nach Verbindungsabbrüchen.
- Light/Dark/System, installierbare Web-App, Offline-Agenda nach dem ersten Laden und Kalenderexport als `.ics`.
- Persönliche Live-Karte auf Basis des fotografierten Venue-Plans: Erd- und Obergeschoss, Breakouts 1–6, Main Stage, Foyer, Lounge und Roundtables. Profilwechsel, Zeitvorschau, Zoom und Originalplan funktionieren auch offline.
- Die Karte priorisiert die Vormerkungen der aktiven Person; sonst folgt sie Gruppe A. Parallele Optionen und Konflikte werden zur Entscheidung angezeigt. Unbestimmte Räume bleiben als solche erkennbar; bei Pausen dient das Foyer nur zur Orientierung.
- Anreise, bestätigte Räume und externer Kartenlink.

## Entwicklung

Node.js 24 und npm:

```sh
npm ci
npm run dev
npm test
npm run build
```

Vite zeigt lokal die Agenda und speichert Favoriten auf dem Gerät. Für den gemeinsamen Plan ist die Vercel Function erforderlich: `vercel dev` mit einem verbundenen privaten Blob Store. Die Variable `BLOB_READ_WRITE_TOKEN` bleibt ausschließlich auf dem Server. Auf Vercel wird sie beim Verbinden des Stores automatisch bereitgestellt. Keine Zugangsdaten committen.

## Gemeinsamer Plan

Über „Team“ einen Plan erstellen, eigenen Namen setzen und über „Daniel einladen“, „Tobi einladen“ oder „Rafi einladen“ den jeweiligen Link kopieren. Der Link wählt das passende Profil beim Beitritt vor. Alte Einladungen funktionieren weiterhin; bestehende Favoriten bleiben bei der Erweiterung auf vier Personen erhalten. Der Link enthält einen zufälligen Schlüssel im URL-Fragment. **Jeder mit diesem Link kann alle vier Profile bearbeiten und im Gruppenchat schreiben.** Die Profile dienen zur Zuordnung, sind keine Benutzerkonten. Der Store ist privat; der Server validiert Schlüssel und Session-IDs. Updates werden mit ETag-Vergleich geschrieben, damit parallele Änderungen nicht gegenseitig verloren gehen.

Die App gleicht bei geöffnetem Tab alle 60 Sekunden, nach Rückkehr in den Tab und nach Änderungen ab. Offline-Änderungen bleiben auf dem jeweiligen Gerät vorgemerkt. Das Offline-Caching umfasst die App, nicht die API oder Einladungslinks. Es gibt keine Benachrichtigungen im Hintergrund bei geschlossener App.

## Gruppenchat

Der Tab „Chat“ verwendet denselben privaten Plan und Einladungslink wie eure Vormerkungen. Rafi erhält beim Öffnen seines Einladungslinks das richtige Profil. Bestehende Pläne bekommen automatisch ein leeres Rafi-Profil und einen leeren Chat; bisherige Auswahlen bleiben erhalten.

Der geöffnete Chat fragt den Plan alle 10 Sekunden ab, andere Ansichten alle 60 Sekunden. Es gibt keine Nachrichtenbenachrichtigungen bei geschlossener App. Nachrichten enthalten das ausgewählte Profil und eine serverseitige Uhrzeit; Profile sind keine verifizierten Konten. **Wer den Einladungslink hat, kann mitlesen und mit jedem Profil schreiben.**

Die letzten 200 Nachrichten mit jeweils bis zu 1.000 Zeichen werden im bestehenden privaten Blob gespeichert. Nachrichten werden als einfacher Text dargestellt. Noch nicht zugestellte Nachrichten und Entwürfe bleiben auf dem Gerät; nach Wiederverbindung werden vorgemerkte Nachrichten gesendet. Stabile Nachrichten-IDs verhindern Duplikate bei wiederholten Sendeversuchen, solange die Nachricht im gespeicherten Verlauf liegt. Gleichzeitige Nachrichten und Favoriten werden über ETag-Vergleiche zusammengeführt. Es wurden keine weiteren Dienste oder Tarife eingerichtet.

## Daten und Aktualisierung

Quellen: [offizielles Programm](https://push-conference.com/program), [Roundtables](https://push-conference.com/program/roundtable-discussions), [Location](https://push-conference.com/location). Deutsche Zusammenfassungen stehen in `scripts/summaries.json`; unveröffentlichte Beschreibungen werden als solche gekennzeichnet. Speaker-Portraits laden von der offiziellen Website.

```sh
npm run sync:program
npm test
npm run build
```

Der Import prüft die bekannten Roundtable-Titel gegen die Quelle und stoppt bei Abweichungen. Neue Sessions erhalten einen neutralen Hinweis, bis eine redaktionelle Kurzfassung ergänzt wurde. Änderungen prüfen und committen; die Git-Integration veröffentlicht anschließend auf Vercel. Der Programmstand steht in der App. Live bedeutet zeitliche Einordnung dieses Programmstands, keine Veranstalter-Anbindung für kurzfristige Verschiebungen. Endzeiten ohne ausdrückliche Angabe wurden aus dem nächsten Programmpunkt abgeleitet und sind als ungefähr markiert. Die Vormerkung ist **keine offizielle Platzreservierung**.

## Hosting und Kosten

Vercel-Projekt `push-helper`, Region Frankfurt. Privater Blob Store `push-helper-planning`. Das verbundene Konto wurde als Hobby bestätigt; es wurde kein bezahlter Tarif gebucht. Hobby hat feste kostenlose Kontingente und stoppt bei Überschreitung statt Mehrverbrauch abzurechnen. Datenmenge und Polling sind für vier Personen klein. Die Kontingente werden mit anderen Projekten im Konto geteilt.

## Prüfungen

`npm test` prüft Migration auf vier Profile, Chatvalidierung, Nachrichten-Deduplizierung, den begrenzten Verlauf und gleichzeitige Nachrichten/Favoriten mit ETag-Konflikten. Außerdem prüft es die persönliche Zielauswahl, Etagen- und Raumzuordnung, Pausen, parallele Optionen, Konflikte sowie Tages- und Zeitgrenzen. Weitere Prüfungen umfassen Agenda-Konsistenz, beide Tage und Räume, Zeitgrenzen unabhängig von der Gerätezeitzone, Terminüberschneidungen sowie RFC-konformes UTF-8-Folding und Zeitzonen im Kalenderexport. Der Produktionsbuild prüft die Client-Typen; die Function kann separat mit TypeScript geprüft werden. Der Einladungs- und Synchronisierungsfluss wird gegen die bereitgestellte Function getestet.
