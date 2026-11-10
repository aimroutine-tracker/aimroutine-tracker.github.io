# AimRoutine Tracker — état vérifiable du Prompt Master V3.3

**Au 10 novembre 2026 · PR [#27](https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/pull/27) en brouillon · aucune fusion ni publication autorisée.**

Ce tableau applique la section 0.11.12 et le protocole anti-boucle du prompt. Il distingue l'**implémentation** d'une **validation réelle**. Ne pas en déduire un niveau de « perfection » exprimé en pourcentage.

| Phase du prompt | État | Preuves / limite |
|---|---|---|
| 0 — Démarrage, vérification des capacités, branche isolée | **EXÉCUTÉ ET VÉRIFIÉ** | Dépôt réel identifié, écriture GitHub et lecture Supabase vérifiées, CI Playwright GitHub Actions disponible |
| 1 — Audit et références | **EXÉCUTÉ, PARTIELLEMENT VÉRIFIÉ** | Quatre originaux identifiés en bibliothèque privée ; accès visuel oui, extraction binaire de cette session refusée |
| 2 — Architecture / design tokens | **IMPLÉMENTÉ** | CSS V3, modules JS des quatre pages et styles communs versionnés sur la branche |
| 3 — Reconstruction des quatre pages | **IMPLÉMENTÉE, NON HOMOLOGUÉE** | Accueil `index.html`, Routines `training.html`, Progression `progress.html`, Compte `account.html` ; captures CI disponibles |
| 4 — Animations premium et responsive | **IMPLÉMENTÉ, TESTS PARTIELS** | Responsive, FR/EN, reduced motion et navigation testés ; aucune approbation finale du propriétaire |
| **5 — Fidélité aux quatre originaux** | **BLOQUÉE** | PNG originaux non exportables depuis cette session et absents de GitHub Actions ; métriques MAE antérieures non parfaites ; aucun nouveau score certifié |
| **6 — Validation fonctionnelle** | **EN COURS** | Tests Node / Playwright simulés ; inspection **réelle en lecture seule** des quatre RLS, de la RPC reset, du hook et de la fonction Edge ; comptes réels jetables et échanges entre appareils non validés |
| 7 — Livraison / publication | **PRÉPARÉE, NON VALIDÉE** | PR en brouillon, preuves et rapport disponibles ; aucun merge, aucun déploiement |

## Ce que les tests démontrent déjà

- [CI multi-navigateurs du dernier commit produit `df20c1c`](https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/42757535277) : **SUCCESS** sur Chromium, Firefox et WebKit mobile.
- [Tests Auth / UI Chromium](https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/42757535406) : **82 réussis sur 82**, avec **comptes et Cloud simulés**. Ce chiffre ne décrit **pas** les comptes réels.
- [Qualité du site](https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/42757535287), [Supabase public security smoke](https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/42757535304) et [Lighthouse](https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/42757535296) : **SUCCESS** sur ce commit produit. Les workflows doivent être reconfirmés sur le HEAD final.
- Quatre captures du candidat V3 sont produites par `tests/visual-rebuild-v3.mjs`. Le job public de fidélité échoue **volontairement** sans les quatre PNG propriétaires exacts : **pas** de validation pixel-perfect.
- L'outil `tests/private-visual-review-v3.html` permet maintenant une revue **locale**, vérifie les **quatre SHA-256 officiels**, calcule MAE et écarts par régions, visualise différences et superpositions, et n'envoie aucun PNG sur Internet. [Mode d'emploi](../tests/visual-references/README.md). **Il ne remplace pas une comparaison effectivement exécutée.**

## Conditions de sortie des phases 5 et 6 (GO / NO-GO)

- [ ] **Phase 5** — Disposer des quatre PNG originaux en octets dans un environnement local autorisé, vérifier leur SHA-256, reproduire les quatre captures V3 au viewport exact `1672×941`, générer les quatre superpositions et différentiels, examiner les écarts et recommencer jusqu'à validation visuelle explicite. **Ne pas publier les originaux ni leurs pixels dans GitHub public.**
- [ ] **Phase 6 — Auth** — Tester inscription/confirmation e-mail, connexion, récupération de mot de passe, Google OAuth, pseudo obligatoire et CAPTCHA sur des **comptes d'essai jetables** distincts.
- [ ] **Phase 6 — Cloud** — Tester dans deux navigateurs/profils réellement isolés la création, modification, suppression, sauvegarde automatique, reconnexion et séparation des comptes ; vérifier les garanties réelles de déconnexion globale.
- [x] **Phase 6 — Sécurité structurelle, lecture seule** — Inspection sur le projet Supabase réel des quatre politiques RLS, privilèges anonymes/authentifiés, RPC `aim_reset_my_progress`, permissions du hook et code Edge de suppression du compte. [Compte rendu vérifié](supabase-rls-readonly-audit-2026-11-10.md).
- [ ] **Phase 6 — Sécurité fonctionnelle** — Confirmer les protections sur des comptes de test indépendants A/B, le hook réellement attaché et les opérations Auth/Cloud. L'avis `auth_leaked_password_protection` reste WARN : le projet est sur **Supabase Free**, où cette option serveur est réservée aux plans Pro et supérieurs. Conserver le contrôle HIBP client et documenter sa limite, sans imposer un abonnement.
- [ ] **Phase 6 — intégrations** — Vérifier la continuité des pages GitHub Pages / Riot sans présumer d'une validation d'API Riot non accordée.
- [ ] **Phase 7** — Dernier HEAD : tous les workflows non bloquants au vert, preuves visuelles privées, rapport des écarts restants, revue utilisateur et **accord explicite avant merge/déploiement**.

## Stratégie anti-boucle

Ne pas continuer les micro-ajustements CSS sans nouvelle mesure visuelle. Ne pas créer de comptes sur le serveur de production ni désactiver les contrôles CAPTCHA pour faire passer des tests. Si la comparaison propriétaire ne peut pas s'exécuter dans ce contexte, utiliser le comparateur privé sur l'ordinateur du propriétaire et poursuivre les tâches indépendantes seulement. Une étape non vérifiable reste BLOQUÉE, pas TERMINÉE.
