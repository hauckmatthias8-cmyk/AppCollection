# Musikfinder – Anbieter-Regel

App 03 heißt **Musikfinder**.

Es dürfen nur Quellen eingebunden werden, deren für die Suche benötigte Schnittstelle ohne
persönliche Zugangsdaten nutzbar ist.

Nicht zulässig sind insbesondere Anbieter, die für die Suchfunktion eines oder mehrere der
folgenden Merkmale voraussetzen:

- API-Key
- Client-ID / Client-Secret
- OAuth
- Benutzerkonto / Login
- persönliches Entwicklerkonto
- andere private Zugangsdaten

Aktive Quellen in dieser Version:

- Wikimedia Commons
- Internet Archive
- ccMixter
- Free To Use
- Apple/iTunes Search API

Die Weboberfläche ist die gemeinsame Oberfläche für Android, iOS und Desktop/PWA.
Provider-spezifische Zugangsdaten werden weder im Client gespeichert noch über ein verstecktes
Backend ergänzt.

## Titellisten und Bundles

Der Musikfinder unterstützt Einzeltitel sowie Titellisten. Für eine Titelliste werden aus den anonym erreichbaren Quellen die drei günstigsten vollständigen Warenkörbe berechnet. Ein Warenkorb kann mehrere Anbieter kombinieren. Es werden keine kostenpflichtigen Abos oder Accounts benötigt, um die Suche auszuführen.

## YouTube-/YouTube-Music-Prüfreferenz

YouTube wird weder als Datenquelle noch als Download- oder Kaufquelle automatisiert abgefragt.
Die App verwendet keine Invidious-Instanzen, kein Scraping und keine inoffiziellen YouTube-Such-APIs.
Stattdessen wird aus den bereits von den erlaubten Musikkatalogen ermittelten Titel-/Interpret-Metadaten
lokal ein normaler `youtube.com/results?search_query=...`- bzw. `music.youtube.com/search?q=...`-Link erzeugt.
Erst die ausdrückliche Aktivierung dieses Links durch den Nutzer öffnet den YouTube-Dienst.

Damit bleibt die Hör-/Prüfmöglichkeit erhalten, ohne YouTube automatisiert auszulesen. Ein konkretes Video
wird von der App nicht vorab ermittelt oder als garantiert offizieller Treffer bezeichnet.

## Erweiterte Suche

Die erweiterte Suche darf aus den bestehenden öffentlichen Musikkatalogen Interpret-/Titel-Zuordnungen ableiten.
YouTube ist dabei keine Discovery-Quelle mehr. Zu jedem gefundenen Titel/Interpret-Paar können jedoch normale,
nutzerinitiierte YouTube- und YouTube-Music-Suchlinks mit der tatsächlich gefundenen Schreibweise erzeugt werden.

## Quellenfilter der erweiterten Suche

Die erweiterte Suche bietet für jede aktuell unterstützte Quelle einen eigenen Schalter.
Standardmäßig sind alle Quellen aktiviert. Die Auswahl darf lokal im Browser gespeichert
werden und beeinflusst ausschließlich die erweiterte Suche; Einzelsuche und Bundle-Suche
verwenden weiterhin ihre regulären Quellen.

## Mehrere Titel in der erweiterten Suche

Im Modus `Titel → Interpreten` dürfen mehrere Titel gleichzeitig eingegeben werden, jeweils
einer pro Zeile. Die App verarbeitet diese nacheinander, dedupliziert identische Titelzeilen
und stellt die Interpret-Ergebnisse pro eingegebenem Titel getrennt dar. Der Quellenfilter gilt
für alle Titel dieses Suchlaufs.
