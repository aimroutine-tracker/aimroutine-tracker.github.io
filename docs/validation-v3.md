# AimRoutine Tracker — validation de reconstruction V3

**État : EN ATTENTE DE VALIDATION.** Branche : `feature/aimroutine-visual-rebuild-v3-20261108`. PR : [#27](https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/pull/27). Ne pas fusionner, publier, supprimer de données réelles ni modifier l'intégration Riot au cours des tests.

## Objectif et limites

La cible visuelle est l'ensemble des **quatre PNG originaux de l'utilisateur**, viewport Chromium **1672 × 941**. Les fichiers originaux demeurent dans les ressources privées de l'utilisateur, et ne sont **pas** inclus dans GitHub Pages ni committés dans le dépôt public. Les images de références comportent des performances fictives : l'application conserve à la place les valeurs issues de vraies séances ou des états vides. Ne pas sacrifier cette intégrité pour améliorer artificiellement une note pixel.

Une image avant/après seule n'est pas une comparaison à l'original. Le contrôle GitHub `reference-fidelity-gate` échoue intentionnellement sans les vrais PNG et sans les quatre comparaisons. Un contrôle local avec images SHA-256 authentifiées a été réalisé, mais **ne rend pas la CI publique verte**.

## Comparaison visuelle déjà exécutée

Métrique : erreur absolue moyenne RGB (MAE) dans [0,255], plus bas = mieux, **pas un pourcentage de similarité**.

| Écran | Site initial | V3 candidate | Réduction de l'erreur |
|---|---:|---:|---:|
| Accueil | 35.9989 | 24.8328 | 31.02 % |
| Routines | 40.9685 | 25.6844 | 37.31 % |
| Progression | 32.0376 | 26.7127 | 16.62 % |
| Compte / Cloud | 33.3605 | 26.4596 | 20.69 % |

Les quatre originaux ont été identifiés par leurs SHA-256 dans `tests/visual-references/manifest.json`. Le rapport local livré au propriétaire comprend les captures avant/après, les originaux, les images de différence, les superpositions et un comparateur HTML. **Pas d'approbation pixel-perfect** : différences résiduelles importantes entre design de référence et données live.

## Tests de projet non destructifs

- **EXÉCUTÉ ET VÉRIFIÉ** : audit qualité et tests Node du code, avec recherche de secrets, sur le commit `2063f0ce` : [Site quality](https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/42671276189).
- **EXÉCUTÉ ET VÉRIFIÉ** : parcours Auth **simulés** (inscription e-mail, réinitialisation, suppression Google/e-mail, CAPTCHA) sur le commit `2063f0ce` : [Fast Auth UI](https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/42671276345). Ils ne prouvent **pas** le fonctionnement réel de Google OAuth ou de l'e-mail.
- **EXÉCUTÉ ET VÉRIFIÉ** : Lighthouse sur quatre pages : [rapport Actions](https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/42671276654). Scores Performance Accueil/Routines/Progression/Compte : **62/73/79/70** ; Accessibilité/bonnes pratiques/SEO **100** dans cette simulation. CLS Progression corrigé (0.273 → environ 0.01). Les scores sont des audits simulés, pas des garanties de performances réelles.
- **EXÉCUTÉ ET VÉRIFIÉ** : les quatre captures de référence exactes ont été vérifiées localement par SHA-256 et comparées au rendu Chromium.
- **NON VALIDÉ sur HEAD** : suite complète Chromium/Firefox/WebKit. Une version précédente avait 132 tests réussis, un test mobile mal ciblé et un test mini-jeu instable. Ceux-ci ont été corrigés, mais les dernières Actions échouent **sans créer de job** ; cette situation doit être résolue et une nouvelle suite complète doit passer avant l'approbation.
- **EXAMEN DE CONFIGURATION uniquement** : Supabase RLS activé et policy `auth.uid() = user_id` sur `aim_profiles`, `aim_preferences`, `aim_sessions`, `aim_presets`. Cela ne remplace pas un test réel inter-comptes. Le contrôle natif des mots de passe compromis Supabase n'est pas accessible sur le plan gratuit ; la vérification cliente HIBP et Turnstile restent en place.

## Tests réels obligatoires — utiliser UNIQUEMENT des comptes de test isolés

À réaliser dans un navigateur authentifié approprié (avec comptes jetables et adresses de réception contrôlées). Ne pas récupérer, transmettre ou consigner de mot de passe réel, jeton d'accès ni secret de production.

1. **E-mail A** — inscription avec pseudo obligatoire et mot de passe conforme ; vérifier le mail de confirmation et l'arrivée à une session authentifiée. Enregistrer le résultat (date, navigateur, PASS/FAIL).
2. **E-mail A** — se déconnecter et se reconnecter, puis demander la réinitialisation et vérifier le lien jusqu'au changement effectif du mot de passe, sans stocker ce mot de passe dans les logs.
3. **Google B** — utiliser un compte Google de test distinct, compléter le choix obligatoire du pseudo, vérifier la reconnexion et la sauvegarde.
4. **Synchronisation** — ouvrir le même compte A dans deux profils de navigateur isolés ; créer une routine et une séance de test dans le profil 1, attendre la synchronisation automatique, vérifier les mêmes données dans le profil 2. Modifier puis supprimer une routine de test ; vérifier que l'état converge sans bouton manuel et sans collision de comptes.
5. **Isolation** — se connecter avec B, essayer de consulter les séances de A via l'interface et des requêtes RLS autorisées, constater qu'aucune donnée A n'est visible.
6. **Déconnexion globale** — vérifier le comportement documenté sur deux sessions du même compte, notamment après révocation des jetons et expiration du jeton déjà émis.
7. **Suppression** — supprimer **uniquement** A ou B s'il s'agit d'un compte jetable dédié, avec la confirmation exacte `SUPPRIMER` ; vérifier que l'accès authentifié et les données associées ne sont plus disponibles, sans jamais toucher au compte propriétaire.
8. **Navigation responsive / accessibilité** — clavier, menu 390 px, tabulation, visibilité du focus, lecteur d'écran si possible, `prefers-reduced-motion`, langue FR/EN, cookies et absence d'erreurs JS critiques.
9. **Riot** — s'assurer qu'aucun secret n'est exposé et que les pages liées à l'intégration continuent de fonctionner ; ne pas prétendre disposer d'accès Riot non autorisés.

Pour chaque scénario, conserver **PASS**, **FAIL** ou **NON EXÉCUTÉ**, avec preuves expurgées de toute donnée sensible. Aucune attestation globale « tout fonctionne » sans exécution de ces parcours.

## Conditions de livraison / publication

- [ ] Réussite des tests GitHub qualité, navigateur et Lighthouse sur le HEAD définitif.
- [ ] Quatre originaux exacts comparés hors dépôt et preuves fournies (déjà réalisés localement, à reconfirmer après toute modification visuelle).
- [ ] Test de la synchronisation réelle sur deux sessions isolées.
- [ ] Test réel de Google OAuth, e-mail, reset, CAPTCHA et suppression du compte jetable.
- [ ] Validation de l'isolation des données entre A et B.
- [ ] Revue finale de fidélité visuelle par le propriétaire, qui prend en compte l'absence légitime de données simulées.
- [ ] Autorisation explicite du propriétaire avant toute fusion et tout déploiement.

**Pas de publication automatique.** Tout élément bloquant conserve le statut BLOQUÉ ou NON EXÉCUTÉ, jamais VALIDÉ.