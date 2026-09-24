# GitHub-Automatisierung

Die YAML-Dateien liegen zusätzlich hier als gepflegte Kopien. GitHub führt nur Dateien unter `.github/workflows/` aus.

## Enthaltene Workflows

- `ci.yml`: ausschließlich manuell per `workflow_dispatch`; Preflight und Debug-Builds, **kein Deployment**.
- `deploy-pages.yml`: ausschließlich `workflow_dispatch`; PWA-Release nur nach manueller Eingabe eines vorhandenen Version-Tags.
- `release-both.yml`: ausschließlich `workflow_dispatch`; native Release-Artefakte nur manuell. Store-Upload standardmäßig aus.

**Weder Push noch Tag-Push lösen einen Release aus.**

Wenn die Kopien neu installiert werden sollen:

```powershell
Deployment/Automation/install-workflows.ps1
```

oder unter macOS/Linux:

```bash
Deployment/Automation/install-workflows.sh
```
