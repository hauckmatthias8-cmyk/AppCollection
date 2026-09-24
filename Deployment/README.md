# Deployment

Dieser Ordner enthält den bevorzugten **manuellen PWA/GitHub-Pages-Releaseweg** sowie optionale native Android- und iOS-Builds.

## Grundregel

Es gibt **keine automatischen Releases**. Normale Pushes und Tag-Pushes dürfen Tests auslösen, aber niemals deployen. Ein Release startet nur über **GitHub → Actions → Run workflow** und benötigt einen bereits vorhandenen Version-Tag.

## PWA

1. Version vorbereiten und Preflight ausführen.
2. Commit nach `main` pushen.
3. Version-Tag `vMAJOR.MINOR.PATCH` bewusst erstellen und pushen.
4. GitHub Actions → **Release PWA manually** → `version_tag` eintragen → manuell starten.

Details stehen in der globalen `README.md` unter **How to release** sowie in `PWA/README.md`.

## CI

`ci.yml` kann bei Push/PR automatisch prüfen und Debug-Artefakte bauen. CI besitzt keine Deployment-Aufgabe.

## Optionale native Builds

Native Release-Artefakte werden ebenfalls ausschließlich manuell über **Build native Android + iOS manually** erzeugt. Ein Store-Upload ist standardmäßig deaktiviert und muss bei einem manuellen Lauf zusätzlich ausdrücklich aktiviert werden.

## Dokumentationshygiene

Siehe `DOCUMENTATION_POLICY.md`. Der Preflight verhindert, dass als privat markierte UI-Inhalte versehentlich in öffentliche READMEs, Deployment-Dokumentation oder Store-Metadaten kopiert werden.
