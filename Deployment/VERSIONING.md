# Versionierung der App-Sammlung

Die öffentliche Versionsnummer folgt ab App 03 diesem Schema:

- `X` = Major-Version. **Nur der Projektinhaber erhöht X ausdrücklich.** Bis dahin bleibt X auf `1`.
- `Y` = Nummer des neuen Haupt-App-Bestandteils. Jede neu hinzugefügte Haupt-App erhöht Y um 1.
- `Z` = Substand während der Entwicklung bzw. Nachbesserung der aktuell neuen App.

Beispiele:

- App 03 fertig: `1.3.0`
- erste Nachbesserung an App 03: `1.3.1`
- zweite Nachbesserung an App 03: `1.3.2`
- neue App 04: `1.4.0` (bzw. während ihres Ausbaus `1.4.z`)
- eine Erhöhung auf `2.x.x` erfolgt nur nach ausdrücklicher Vorgabe des Projektinhabers.

Die interne Buildnummer läuft davon unabhängig monoton weiter.
