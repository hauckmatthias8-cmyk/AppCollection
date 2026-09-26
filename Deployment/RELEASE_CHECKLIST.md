# Release-Checkliste

- [ ] Neue Version und Buildnummer festgelegt.
- [ ] `Deployment/Tools/release.ps1` bzw. `release.sh` ausgeführt.
- [ ] `python Deployment/Tools/preflight.py` ohne Fehler.
- [ ] Änderungen mit `git diff` geprüft.
- [ ] Release-Commit bewusst nach `main` gepusht.
- [ ] Version-Tag `vMAJOR.MINOR.PATCH` manuell erstellt und gepusht.
- [ ] Geprüft: Tag-Push hat **kein** Deployment gestartet.
- [ ] Zauberwürfel-Löser auf realem Android-Gerät getestet.
- [ ] Zauberwürfel-Löser auf realem iPhone getestet.
- [ ] Sudoku-Funktionen getestet.
- [ ] Musikfinder online getestet (Einzelsuche, Titelliste, Bundle-Suche, Lizenzanzeige, Downloadlink, Tag-Prüfung/Fallback).
- [ ] Offline-/Flugmodus-Test auf beiden Plattformen bestanden.
- [ ] GitHub Actions → **Release PWA manually** geöffnet.
- [ ] Exakten `version_tag` eingegeben.
- [ ] Manuellen PWA-Workflow bewusst gestartet.
- [ ] GitHub-Pages-Version nach Deployment geprüft.
- [ ] Optional native Builds separat und manuell gestartet.
