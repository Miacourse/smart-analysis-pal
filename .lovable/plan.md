# Mise à jour de zod et xlsx

## Changements (uniquement les dépendances)
- `zod` : `^3.25.76` → `^4.6.6` (la 4.6.7 est publiée depuis plus de 24 h, compatible avec la règle de sécurité du projet).
- `xlsx` : `^0.18.5` (npm, non maintenu) → `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (dernière version officielle SheetJS CDN).
- Régénération de `bun.lock` via `bun add`.

Aucun autre fichier modifié, sauf si la montée en zod 4 provoque une erreur de typage dans le code existant (correction minimale de syntaxe dans ce cas, signalée).

## Vérifications
- Lecture du journal de compilation et typecheck.
- Lancement des tests existants (dont `dataset-profile` et `export-report`).
- Test réel dans le navigateur : connexion, téléversement d'un fichier `.xlsx` généré, confirmation que le fichier est lu (nombre de lignes affiché).
- Scan de vulnérabilités des dépendances après la mise à jour.
