# Sources de comparaison AimRoutine V3 — usage privé

Les quatre PNG **originaux du propriétaire** sont les références obligatoires pour les comparaisons visuelles. Résolution : **1672 × 941 px**. Les empreintes exactes SHA-256 sont enregistrées dans `manifest.json`.

## Préparation hors du dépôt GitHub public

Dans une **copie locale privée et non partagée** du projet, placer les images octet-identiques (sans recadrage ni réencodage) sous les noms :

- `tests/visual-references/home.png`
- `tests/visual-references/routines.png`
- `tests/visual-references/progress.png`
- `tests/visual-references/account.png`

Ces quatre chemins figurent dans `.gitignore` pour réduire les risques de commit accidentel. **Attention : `.gitignore` n'empêche pas `git add -f`, la copie dans un autre fichier ni un ancien suivi Git. Vérifier le contenu de chaque commit.** Ne jamais ajouter ces quatre PNG à un dépôt public sans accord explicite du propriétaire.

## Séparation des artefacts et validation

- `visual-results/` est un dossier temporaire local. Lorsque les originaux sont présents, il contient aussi des `*-source-*.png` pouvant révéler des pixels des maquettes privées.
- `tests/stage-public-visual-evidence-v3.py` copie **uniquement les captures sans référence, les comparaisons avant/après du site et un résumé numérique expurgé** dans `public-visual-evidence/`. Ce dernier est le seul lot de captures destiné à l'artefact public GitHub Actions.
- Le job `reference-fidelity-gate` **recalcule ses comparaisons à partir des PNG locaux sur son propre runner**, sans transmettre les `*-source-*.png` aux artefacts publics.
- Le job public reste volontairement en **échec bloquant** lorsqu'il ne dispose pas des quatre originaux exacts. Cette absence ne doit jamais être transformée en succès artificiel.
- Une validation locale avec les quatre références exactes peut être réussie, mais elle ne signifie ni que le gate GitHub public est passé, ni que le rendu est pixel-perfect.

Pour exécuter une comparaison dans une copie privée **déjà équipée de captures** `visual-results/{home,routines,progress,account}-{before,after}.png` :

```bash
python3 -m pip install Pillow==11.3.0
python3 tests/compare-visual-v3.py
python3 tests/check-source-fidelity-v3.py
```

Le second script exige les quatre SHA-256 corrects, les dimensions et les preuves de comparaison. Préserver ces preuves privées ; ne pas les téléverser dans une PR ou un artefact public. La publication requiert encore une revue visuelle explicite et les tests fonctionnels sur des comptes d'essai dédiés. Les valeurs fictives des maquettes ne doivent jamais être injectées dans les statistiques de vrais comptes.
