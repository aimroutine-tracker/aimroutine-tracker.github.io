# AimRoutine Tracker — validation de reconstruction V3

**État : EN ATTENTE DE VALIDATION.** Branche : `feature/aimroutine-visual-rebuild-v3-20261108`. PR : [#27](https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/pull/27). Ne pas fusionner, publier, supprimer de données réelles ni modifier l'intégration Riot au cours des tests.

## Objectif et limites

La cible visuelle est l'ensemble des **quatre PNG originaux de l'utilisateur**, viewport Chromium **1672 × 941**. Les fichiers originaux demeurent dans les ressources privées de l'utilisateur, et ne sont **pas** inclus dans GitHub Pages ni committés dans le dépôt public. Les images de références comportent des performances fictives : l'application conserve à la place les valeurs issues de vraies séances ou des états vides. Ne pas sacrifier cette intégrité pour améliorer artificiellement une note pixel.

Une image avant/après seule n'est pas une comparaison à l'original. Le contrôle GitHub `reference-fidelity-gate` échoue intentionnellement sans les vrais PNG et sans les quatre comparaisons. Un contrôle local avec images SHA-256 authentifiées a été réalisé, mais **ne rend pas la CI publique verte**.

## Comparaison visuelle déjà exécutée

Métrique : erreur absolue moyenne RGB (MAE) dans [0,255], plus bas = mieux, **pas un pourcentage de similarité**.

| Écran | Site initial | V3 candidate | Réduction de l'erreur |
|---|---:|---:|---:|
| Accueil | 35.9989 | 24.3439 | 32.38 % |
| Routines | 40.9685 | 25.5975 | 37.52 % |
| Progression | 32.0376 | 26.5415 | 17.16 % |
| Compte / Cloud | 33.3605 | 26.7008 | 19.96 % |

Les quatre originaux ont été identifiés par leurs SHA-256 dans `tests/visual-references/manifest.json`. Le rapport local livré au propriétaire comprend les captures avant/après, les originaux, les images de différence, les superpositions et un comparateur HTML. **Pas d'approbation pixel-perfect** : différences résiduelles importantes entre design de référence et données live.

## Contrôles du 10 novembre 2026 — branche V3

Dernier code visuel évalué : `18c1feae69a42ce0d508cc02115099b358630b94` (PR n°27, non fusionnée). Les quatre PNG privés d'origine sont identifiés par leurs empreintes SHA-256. Le rapport actualisé a été livré **localement** au propriétaire : images de référence, captures `main` et V3, superpositions, différentiels et comparateur HTML. Les originaux ne sont pas ajoutés au dépôt public.

- **Accueil** : les trois descriptions des fonctionnalités ont été remises au plus près du texte visible dans la maquette, sans statistiques fictives. Le bandeau « Défi AIM » a retrouvé un réticule purement décoratif et une géométrie de titre, badges et bouton plus fidèle. La rangée des trois cartes est enregistrée à 54 px du bord gauche au viewport source de 1672 px. Erreur RGB globale Accueil : **24.6353 → 24.3439**, réduction supplémentaire de 0.2914 point ; zone de défi : **26.1345 → 24.7350**.
- **Responsive** : les badges du défi restent fluides entre 1350 et 1599 px et conservent les dimensions de référence à 1672 px. Test navigateur ajouté pour `1350 / 1440 / 1599 / 1672` : aucun badge ne doit dépasser son panneau ou élargir le document.
- **Équivalence des autres pages** : les nouvelles captures Routines / Progression / Compte sont **pixel pour pixel inchangées** entre le contrôle antérieur et la version actuelle. Aucun chiffre de démonstration n'a été ajouté.
- [Site quality et tests Node](https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/42730455644) : **SUCCESS**.
- [Fast Auth UI desktop Chromium](https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/42730455531) : **SUCCESS**, 63 tests.
- [Contrôle public Supabase sans écriture](https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/42730455588) : **SUCCESS**.
- [Lighthouse 4 pages](https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/42730455547) : **SUCCESS** (scores simulés variables).
- [Captures Playwright](https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/42730455792) : job capture **SUCCESS** ; gate source-fidelity **FAIL attendu** (les quatre PNG originaux ne sont pas dans la CI publique).
- [Cross-browser desktop et WebKit mobile](https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/42730455510) : **EN COURS au moment de cette mise à jour** ; ne pas annoncer de PASS avant la fin du job.

Les données et routines réelles restent soumises à la validation sur comptes jetables ; ne pas confondre les tests Playwright simulés avec une preuve de connexion Google ou d'envoi d'e-mail réel.

## Tests de projet non destructifs

- **EXÉCUTÉ ET VÉRIFIÉ** : audit qualité et tests Node du code, avec recherche de secrets, sur le commit `cfa17350` : [Site quality](https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/42681208327), **91 tests Node réussis**.
- **EXÉCUTÉ ET VÉRIFIÉ** : parcours Auth **simulés** (inscription e-mail, réinitialisation, suppression Google/e-mail, CAPTCHA) sur le commit `cfa17350` : [Fast Auth UI](https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/42681208199). Ils ne prouvent **pas** le fonctionnement réel de Google OAuth ou de l'e-mail.
- **EXÉCUTÉ ET VÉRIFIÉ** : Lighthouse sur quatre pages : [rapport Actions](https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/42681208169). Scores Performance Accueil/Routines/Progression/Compte : **63/54/78/72** (fortes fluctuations de TBT entre exécutions indépendantes) ; Accessibilité/bonnes pratiques/SEO **100** dans cette simulation. CLS Progression corrigé (0.273 → environ 0.01). Les scores sont des audits simulés, pas des garanties de performances réelles.
- **EXÉCUTÉ ET VÉRIFIÉ** : les quatre captures de référence exactes ont été vérifiées localement par SHA-256 et comparées au rendu Chromium.
- **EXÉCUTÉ ET VÉRIFIÉ** : [Cross-browser](https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/42675408419) sur le commit `be271d60` : **140 tests Playwright réussis, 4 ignorés volontairement** sur Chromium desktop, Firefox desktop et WebKit mobile. Sur la mise à jour `cfa17350` (chargement Auth différé + contrôle inter-onglets), la suite multi-navigateurs a été relancée et reste **en cours** au moment de cette rédaction. Le résultat antérieur ne remplace pas le contrôle du HEAD.
- **EXÉCUTÉ ET VÉRIFIÉ** : [sécurité publique Supabase](https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/42681208112) : fournisseurs e-mail/Google activés, consentement Google joignable, confirmation e-mail requise, refus du reset sans CAPTCHA, refus des suppressions de compte et de progression sans JWT ; aucun compte réel créé ou supprimé.
- **EXÉCUTÉ ET VÉRIFIÉ** : synchronisation Cloud en base simulée, y compris deux tests de concurrence : un reset ne doit pas chevaucher une sauvegarde en cours ; un reset refusé ne doit ni bloquer les essais futurs ni effacer les données locales. Les **91 tests Node** ont réussi sur le commit `cfa17350`. Un serveur différent, un ancien onglet ou un appareil distant nécessite toujours une validation réelle.
- **EXÉCUTÉ ET VÉRIFIÉ — test SQL en lecture seule** (9 novembre 2026) : [protocole reproductible](../tests/supabase-rls-readonly.sql). RLS actif sur les quatre tables `aim_profiles`, `aim_preferences`, `aim_presets` et `aim_sessions`, politiques propriétaires fondées sur `auth.uid()`; aucun droit `SELECT/INSERT/UPDATE/DELETE` du rôle `anon` sur ces tables. Un `BEGIN READ ONLY; SET LOCAL ROLE authenticated` avec JWT utilisateur synthétique `00000000-0000-4000-8000-000000000000` a donné **0 ligne visible** pour les quatre tables. `ROLLBACK` a conclu le test, sans consulter de données personnelles et sans écriture. **Il ne s'agit pas d'un test d'isolation entre deux comptes réels**, qui reste NON EXÉCUTÉ. Aucune fonction `SECURITY DEFINER` détectée dans le schéma `public`. Le contrôle natif des mots de passe compromis Supabase n'est pas accessible sur le plan gratuit ; la vérification cliente HIBP et Turnstile restent en place.

**Optimisations de chargement :** Turnstile est monté après la première interaction du formulaire de connexion (il demeure exigé par le serveur) : Lighthouse a mesuré sur la page Compte un transfert d’environ 2,47 Mo à 0,75 Mo et un LCP de 6,59 s à 5,72 s. La navigation des pages invitées évite l’import du SDK Supabase sans jeton de session, ce qui réduit d’environ 88 Ko les ressources transmises, mais les scores de Performance varient nettement d’un run à l’autre. Les quatre captures françaises à 1672×941 sont inchangées par ce dernier ajustement de navigation ; la suppression du CAPTCHA précoce modifie légèrement l’aspect de Compte (MAE 26,4596 → 26,6923).

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