# AimRoutine Tracker — état vérifiable du Prompt Master V3.3

**Au 14 novembre 2026 · PR [#27](https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/pull/27) en brouillon · aucune fusion ni publication autorisée.**

Ce tableau applique la section 0.11.12 et le protocole anti-boucle du prompt. Il distingue l'**implémentation** d'une **validation réelle**. Ne pas en déduire un niveau de « perfection » exprimé en pourcentage.

| Phase du prompt | État | Preuves / limite |
|---|---|---|
| 0 — Démarrage, vérification des capacités, branche isolée | **EXÉCUTÉ ET VÉRIFIÉ** | Dépôt réel identifié, écriture GitHub et lecture Supabase vérifiées, CI Playwright GitHub Actions disponible |
| 1 — Audit et références | **EXÉCUTÉ, PARTIELLEMENT VÉRIFIÉ** | Quatre originaux identifiés en bibliothèque privée ; accès visuel oui, extraction binaire de cette session refusée |
| 2 — Architecture / design tokens | **IMPLÉMENTÉ** | CSS V3, modules JS des quatre pages et styles communs versionnés sur la branche |
| 3 — Reconstruction des quatre pages | **IMPLÉMENTÉE, NON HOMOLOGUÉE** | Accueil `index.html`, Routines `training.html`, Progression `progress.html`, Compte `account.html` ; captures CI disponibles |
| 4 — Animations premium et responsive | **IMPLÉMENTÉ, TESTS PARTIELS** | Responsive, FR/EN, reduced motion et navigation testés ; aucune approbation finale du propriétaire |
| **5 — Fidélité aux quatre originaux** | **BLOQUÉE** | Quatre PNG complets privés non disponibles en CI ; comparaison partielle des extraits de la charte (1672×723) effectuée localement, sans équivalence à la validation SHA-256 des quatre originaux complets |
| **6 — Validation fonctionnelle** | **EN COURS** | Le client V3 utilise maintenant la RPC `aim_apply_progress_for_user` pour les quatre catégories de données, avec vérification de l'UID et de `reset_at` ; migration et concurrence PostgreSQL testées **en CI isolée** ; les clients V2 actifs peuvent encore contourner le verrou par REST ; migration NON DÉPLOYÉE sur Supabase hébergé ; recette A/B réelle et basculement des clients anciens non validés |
| 7 — Livraison / publication | **PRÉPARÉE, NON VALIDÉE** | PR en brouillon ; workflow de publication muni de **cinq** attestations, dont l'isolation des sauvegardes atomiques inter-appareils ; aucune fusion ni déploiement |

## Mise à jour du 14 novembre — prochaine barrière Cloud

- La migration **non déployée** sérialise les suppressions du même compte avec un verrou transactionnel et génère un marqueur `reset_at` strictement croissant, même pour deux suppressions successives très rapprochées.
- Une fonction expérimentale **`qa_guarded_session_insert` existe exclusivement dans `tests/atomic-reset-guard-prototype-postgres.sql`**. Les [tests PostgreSQL isolés](https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/43551197199) ont réussi : rejet d'une écriture obsolète, maintien de l'isolation A/B, nouvelle écriture avec curseur actuel et progression du marqueur. **Ce n'est pas une fonction déployée ni utilisée par le site.**
- **Avancement sur la branche V3, non publié :** la RPC `aim_apply_progress_for_user` protège désormais les écritures de sessions, presets, profils et objectifs hebdomadaires. `cloud-sync-v7.mjs` appelle la RPC au lieu des mutations REST. Le contrôle de publication vérifie la présence de la fonction dans la migration et du client correspondant ; il échoue fermé si l'un manque.
- La recette PostgreSQL isolée teste les quatre catégories, la protection A/B, les tombstones, le rollback et les deux ordres de transactions simultanées contre la vraie RPC de V3. Les tests Node simulés vérifient aussi la reprise sans résurrection après un reset réseau.
- **Bloquant :** les anciens clients V2 publiés possèdent encore des chemins d'écriture REST non gardés. Leur retrait ou blocage contrôlé est nécessaire avant d'attester une garantie atomique inter-appareils, puis il faudra valider sur de vrais comptes jetables.
- Le workflow de publication manuel exige maintenant `atomic_cloud_writes_verified=true` en plus des validations existantes. Cette attestation reste **fausse** tant que les écritures réelles ne sont pas protégées et testées.
- Les originaux PNG complets doivent toujours être validés localement par leurs quatre SHA-256 ; les captures candidates seules ne suffisent pas.

## Ce que les tests démontrent déjà

- [CI multi-navigateurs du dernier commit produit `df20c1c`](https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/42757535277) : **SUCCESS** sur Chromium, Firefox et WebKit mobile.
- [Tests Auth / UI Chromium](https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/42757535406) : **82 réussis sur 82**, avec **comptes et Cloud simulés**. Ce chiffre ne décrit **pas** les comptes réels.
- [Qualité du site](https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/42757535287), [Supabase public security smoke](https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/42757535304) et [Lighthouse](https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/42757535296) : **SUCCESS** sur ce commit produit. Les workflows doivent être reconfirmés sur le HEAD final.
- Quatre captures du candidat V3 sont produites par `tests/visual-rebuild-v3.mjs`. Le job public de fidélité échoue **volontairement** sans les quatre PNG propriétaires exacts : **pas** de validation pixel-perfect.
- L'outil `tests/private-visual-review-v3.html` permet maintenant une revue **locale**, vérifie les **quatre SHA-256 officiels**, calcule MAE et écarts par régions, visualise différences et superpositions, et n'envoie aucun PNG sur Internet. [Mode d'emploi](../tests/visual-references/README.md). **Il ne remplace pas une comparaison effectivement exécutée.**

## Mise à jour du 11 novembre — preuves sur la branche V3

- La PR #27 comporte désormais des correctifs d'import JSON V5/V6 qui refusent l'écriture lorsque l'identité change pendant la lecture asynchrone du fichier, ainsi que des tests Playwright positifs et négatifs. Les suites qualité, sécurité, Lighthouse, Auth UI et multi-navigateurs ont **toutes réussi** au commit `cbbe0f93` ; les résultats des commits ultérieurs doivent être contrôlés séparément.
- La suppression Cloud revalide `getUser()` avant et après la RPC (tests Node). Le **client V3 de la branche** appelle désormais uniquement `aim_reset_my_progress_for_user` avec `expected_uid` ; la migration `supabase/migrations/20261111210933_reset_expected_uid.sql` a été générée via Supabase CLI 3.1.0. Le workflow de test sur **PostgreSQL 17 éphémère** a validé le cas JWT B / demande A, l'absence de JWT, la suppression A/A, la préservation de B et le reset marker. **La base Supabase hébergée utilise encore l'ancienne RPC, car la migration n'a pas été appliquée** ; V3 ne doit pas être déployée telle quelle.
- Le workflow de publication réclame une quatrième attestation, `account_bound_reset_verified`, et exécute `scripts/check_reset_release_ready.py` : il vérifie le code client et la migration désormais présents. Il ne contrôle pas l'état du serveur hébergé ; l'attestation de migration réellement déployée et de tests A/B est **toujours obligatoire**. Le verrou visuel des quatre originaux reste bloquant.
- Une comparaison **partielle** privée, basée sur quatre extraits de la charte (1 672 × 723, recalage vertical 109 px), a mesuré les erreurs MAE RGB suivantes, avant→V3 : Accueil 37,76→22,35 ; Routines 44,19→28,03 ; Progression 32,19→25,56 ; Compte 34,28→27,46. Ces valeurs ne sont **pas** les scores des quatre captures originales complètes, ni un pourcentage de fidélité.
- Aucune nouvelle connexion réelle avec comptes QA e-mail/Google, aucun test destructif réel, aucune publication ou modification de Supabase de production n'a été réalisée.

## Conditions de sortie des phases 5 et 6 (GO / NO-GO)

- [ ] **Phase 5** — Disposer des quatre PNG originaux en octets dans un environnement local autorisé, vérifier leur SHA-256, reproduire les quatre captures V3 au viewport exact `1672×941`, générer les quatre superpositions et différentiels, examiner les écarts et recommencer jusqu'à validation visuelle explicite. **Ne pas publier les originaux ni leurs pixels dans GitHub public.**
- [ ] **Phase 6 — Auth** — Tester inscription/confirmation e-mail, connexion, récupération de mot de passe, Google OAuth, pseudo obligatoire et CAPTCHA sur des **comptes d'essai jetables** distincts.
- [ ] **Phase 6 — migration reset** — **Génération CLI, code client et tests PostgreSQL CI accomplis sur la branche** ; restent la validation en préproduction, la revue et l'application coordonnée au projet hébergé, puis les tests A/B jetables. L'ancienne RPC demeure nécessaire au site V2 publié. Ne pas publier la V3 avant la migration serveur.
- [ ] **Phase 6 — Cloud** — Tester dans deux navigateurs/profils réellement isolés la création, modification, suppression, sauvegarde automatique, reconnexion et séparation des comptes ; vérifier les garanties réelles de déconnexion globale.
- [x] **Phase 6 — Sécurité structurelle, lecture seule** — Inspection sur le projet Supabase réel des quatre politiques RLS, privilèges anonymes/authentifiés, RPC `aim_reset_my_progress`, permissions du hook et code Edge de suppression du compte. [Compte rendu vérifié](supabase-rls-readonly-audit-2026-11-10.md).
- [ ] **Phase 6 — Sécurité fonctionnelle** — Confirmer les protections sur des comptes de test indépendants A/B, le hook réellement attaché et les opérations Auth/Cloud. L'avis `auth_leaked_password_protection` reste WARN : le projet est sur **Supabase Free**, où cette option serveur est réservée aux plans Pro et supérieurs. Conserver le contrôle HIBP client et documenter sa limite, sans imposer un abonnement.
- [ ] **Phase 6 — intégrations** — Vérifier la continuité des pages GitHub Pages / Riot sans présumer d'une validation d'API Riot non accordée.
- [ ] **Phase 7** — Dernier HEAD : tous les workflows non bloquants au vert, preuves visuelles privées, rapport des écarts restants, revue utilisateur et **accord explicite avant merge/déploiement**.

## Stratégie anti-boucle

Ne pas continuer les micro-ajustements CSS sans nouvelle mesure visuelle. Ne pas créer de comptes sur le serveur de production ni désactiver les contrôles CAPTCHA pour faire passer des tests. Si la comparaison propriétaire ne peut pas s'exécuter dans ce contexte, utiliser le comparateur privé sur l'ordinateur du propriétaire et poursuivre les tâches indépendantes seulement. Une étape non vérifiable reste BLOQUÉE, pas TERMINÉE.
