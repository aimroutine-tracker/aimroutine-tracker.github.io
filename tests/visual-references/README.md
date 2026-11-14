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


## Nouvelle méthode sans Python : comparateur privé utilisable dans le navigateur

Pour contourner les limites d'extraction de fichiers depuis une session ChatGPT sans affaiblir les contrôles, un outil **hors ligne** est disponible dans `tests/private-visual-review-v3.html`.

1. Télécharger ce fichier HTML dans un dossier privé, puis l'ouvrir localement (Chromium, Chrome, Edge ou Firefox récent). **Ne pas l'héberger sur un site public** avec les PNG propriétaires. Si un navigateur administré bloque `file://` ou `crypto.subtle`, ouvrir un terminal dans le dossier contenant le HTML, exécuter `python3 -m http.server 8769 --bind 127.0.0.1`, puis ouvrir `http://127.0.0.1:8769/private-visual-review-v3.html`. Le serveur écoute **uniquement** sur la machine locale, et la page n'émet aucune requête réseau d'upload. Fermer ce serveur après la revue.
2. Télécharger depuis GitHub Actions l'artefact `aimroutine-v3-visual-evidence` du **HEAD exact** de la PR n°27, puis décompresser le ZIP localement.
3. Pour Accueil, Routines, Progression et Compte, sélectionner les véritables PNG d'origine et les captures `home-after.png`, `routines-after.png`, `progress-after.png`, `account-after.png` du même HEAD.
4. Cliquer sur **Comparer** sur chacun des quatre écrans. L'outil vérifie **SHA-256** contre `manifest.json`, exige un viewport **1672 × 941 px**, affiche la superposition réglable et les différences, puis calcule MAE RGB, pourcentage de pixels différents et écarts par région.
5. Exporter le résumé **JSON privé** : chaque scène inclut l'empreinte SHA-256 de l'original **et celle de la capture V3** (`capture_sha256`), les noms des deux fichiers, les dimensions et les mesures RGB. Vérifier que le hash `capture_sha256` correspond bien au PNG téléchargé depuis l'artefact du **même HEAD de PR** ; ce hash permet de rattacher les mesures à un fichier exact, mais ne prouve pas à lui seul son origine GitHub. Consigner les corrections nécessaires, puis recommencer à partir de nouvelles captures. Les PNG originaux et les images de différence restent **sur ton ordinateur**, pas dans une PR ni un artefact GitHub public.

Sécurité du comparateur : aucun import externe, aucun appel réseau, politique CSP `connect-src 'none'`, aucun `fetch` ni envoi de pixels. Le résultat n'est considéré comme une preuve de qualité que si les quatre empreintes des originaux correspondent. Une valeur MAE est une **distance moyenne de couleur**, jamais un pourcentage de fidélité ni un certificat pixel-perfect. Des données réelles non identiques aux nombres fictifs présents sur la maquette peuvent entraîner un écart légitime.

**État de l'exécution :** le programme HTML et ses contrôles de syntaxe sont enregistrés sur la branche de développement ; la validation des vraies quatre images dans cet outil reste **NON EXÉCUTÉE** tant qu'un environnement local autorisé ne dispose pas des PNG originaux en octets. Le contrôle CI public reste **BLOQUÉ**. Ne jamais inventer un résultat.
