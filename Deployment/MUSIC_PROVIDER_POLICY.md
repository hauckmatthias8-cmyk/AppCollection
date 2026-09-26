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

## YouTube-Prüfreferenz

YouTube wird nicht als Download- oder Kaufquelle behandelt und fließt nicht in Preis- oder Bundleberechnungen ein.
Die App darf jedoch nach einem passenden öffentlichen YouTube-Video suchen und einen normalen YouTube-Link zum
Anhören/Prüfen anbieten. Da die offizielle YouTube Data API einen API-Key verlangt, nutzt die App dafür ausschließlich
öffentliche Invidious-Suchendpunkte, die keine persönlichen Zugangsdaten erfordern. Fällt diese Suche aus, darf nur ein
normaler YouTube-Suchlink angeboten werden.

## Erweiterte Suche

Die erweiterte Suche darf aus den bestehenden öffentlichen Quellen Interpret-/Titel-Zuordnungen ableiten.
YouTube-Ergebnisse dürfen hierfür nur berücksichtigt werden, wenn sie als professionelle Musikquelle plausibel sind:
verifizierter Kanal, `- Topic`-/VEVO-Kanal und/oder strukturierte `musicTracks`-Metadaten. Normale unbestätigte
Benutzer-/Laienvideos dürfen nicht in die Ergebnisliste aufgenommen werden.

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
