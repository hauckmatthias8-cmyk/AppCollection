# Dokumentations- und Privatsphäre-Regeln

Öffentliche Projektdokumentation, Store-Metadaten, Release-Notes und Screenshot-Pläne beschreiben **Funktionen und Technik**, nicht private oder persönliche UI-Inhalte.

## Regeln

- Persönliche Widmungen, Spitznamen, private Nachrichten, private Beispielnamen und vergleichbare UI-Texte werden nicht in README-Dateien, Deployment-Dokumentation, Store-Texten, Changelogs oder Screenshot-Beschreibungen wiederholt.
- Persönliche UI-Elemente, die absichtlich Bestandteil der App sind, erhalten im HTML das Attribut `data-doc-private="true"`.
- `Deployment/Tools/preflight.py` liest diese markierten UI-Texte automatisch aus und bricht den Build ab, sobald einer davon in den öffentlichen Dokumentationsflächen auftaucht.
- Screenshots für öffentliche Releases dürfen keine als privat markierten Inhalte enthalten.
- Neue Dokumentation soll private UI-Inhalte nur neutral als Funktion beschreiben, ohne den konkreten Wortlaut zu zitieren.

Damit bleiben gewünschte persönliche Details in der App erhalten, werden aber nicht versehentlich in öffentliche Begleittexte kopiert.
