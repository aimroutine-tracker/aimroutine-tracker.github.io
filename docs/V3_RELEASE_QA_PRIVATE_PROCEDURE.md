# AimRoutine Tracker V3 — recette finale privée et autorisation de publication

**État au 11 novembre 2026 : NON PRÊT À PUBLIER.** Ce document est une procédure, pas une attestation que des tests réels ont eu lieu. Conserver la PR #27 en brouillon et ne pas fusionner.

## Contrôles déjà effectués sans toucher aux données personnelles

- Les quatre tables `aim_sessions`, `aim_presets`, `aim_profiles`, `aim_preferences` ont **RLS activé**. Le rôle `anon` n'a aucun droit direct SELECT/INSERT/UPDATE/DELETE.
- Chacune des quatre tables possède une politique propriétaire `USING` et `WITH CHECK` utilisant `auth.uid()` et `user_id` (vérifié en lecture seule le 11 novembre).
- Une transaction SQL **READ ONLY** avec le rôle `authenticated` et un UID synthétique inexistant voit **0 enregistrement** dans les quatre tables ; elle est immédiatement annulée.
- `aim_reset_my_progress` est **SECURITY INVOKER**, inaccessible à `anon` et accessible au rôle `authenticated`.
- Les vérifications GitHub Actions de qualité, sécurité publique et les scénarios Playwright automatisés avaient réussi sur la passe 55.
- L'avertissement Supabase `auth_leaked_password_protection` reste présent. Cette fonction Supabase native nécessite **Pro ou supérieur**, et n'est pas disponible sur Free. Le projet effectue un contrôle HIBP par empreinte partielle dans son navigateur lors de l'inscription et de la récupération ; ce n'est **pas une garantie serveur**. Voir https://supabase.com/docs/guides/auth/password-security et https://supabase.com/pricing.

**Ne pas présenter cette liste comme une garantie de sécurité à 100 %.** Les tests d'isolation synthétiques ne remplacent pas des tests à deux vrais comptes.

## 1. Quatre maquettes propriétaires : preuves privées

À 1 672 × 941, utiliser les PNG d'origine nommés dans `tests/visual-references/manifest.json`. Vérifier impérativement leurs quatre SHA-256 exacts.

Pour **Accueil**, **Routines**, **Progression** et **Compte**, joindre dans une archive locale privée :
1. PNG original, capture de l'ancienne production et capture du HEAD exact à comparer ;
2. comparaison côte à côte, superposition, heatmap et MAE RGB global + quatre régions ;
3. empreinte SHA-256 de la capture pour rattacher le résultat au même HEAD ;
4. validation visuelle humaine des états invité **et** connecté (le PNG Compte montre un état connecté illustratif).

Ne jamais copier les PNG sources, les superpositions propriétaires ou leurs pixels dans le dépôt public, dans un commentaire PR ou dans un artefact GitHub public. Le contrôle public sans les originaux reste bloquant ; ne pas le transformer artificiellement en succès.

**Budgets anti-régression (pas des objectifs pixel-perfect)** : Accueil 21,625240 ; Routines 26,435744 ; Progression **25,603400** (passe 58 : espacement des cartes du bas corrigé) ; Compte 26,500401 de MAE RGB. Tolérance 0,25, définie dans le manifeste.

## 2. Recette réelle : trois comptes d'essai exclusivement

Utiliser uniquement des **comptes jetables créés pour ce test**, avec des boîtes mail possédées par le testeur. Aucun vrai compte utilisateur ne doit servir aux essais. Ne pas enregistrer les e-mails, mots de passe, tokens ou identifiants privés dans Git, une issue ou une capture publiée.

| Scénario | Procédure | Critère d'acceptation |
|---|---|---|
| E-mail, compte A | Inscription avec pseudo obligatoire ; CAPTCHA ; confirmation e-mail ; reconnexion | Profil du vrai utilisateur A, pseudo conservé, aucun compte fictif |
| E-mail, compte B | Deuxième identité et profil distincts, autre navigateur/profil | B ne voit jamais la progression, les routines ni l'adresse de A |
| Google, compte C | Auth OAuth sur une boîte de test, ajout du pseudo si nécessaire, déconnexion, reconnexion | Pas de boucle OAuth ; session et pseudo restaurés ; suppression accessible |
| Deux appareils pour A | Connexion A sur deux profils de navigateur indépendants ; enregistrer une **séance d'essai clairement identifiée** sur le premier ; ne pas cliquer sur une synchronisation manuelle | La même séance réelle et son ID apparaissent automatiquement sur le second, sans duplication |
| Retour hors ligne A | Ajouter une séance sur le profil A déconnecté du réseau, puis reconnecter | Synchronisation reprend ; les séances déjà en cloud restent présentes, sans doublons |
| Isolation RLS réelle A/B | Sous l'identité B, interroger les sessions de A par son UID depuis un client public soumis à RLS | 0 ligne de A exposée à B ; aucune clé `service_role` ou secret ne doit être employé |
| Changement de compte | Se déconnecter de A, se connecter à B sur le même navigateur | Les anciennes statistiques, détails, formulaires sensibles et données locales de A disparaissent de l'interface B |
| Déconnexion globale A | Lancer « Déconnexion » depuis A puis revérifier les profils de navigateur A après recharge et renouvellement de session | Aucune nouvelle session valide n'est rétablie sans réauthentification ; tenir compte de la durée résiduelle des JWT |
| Suppression de progression QA | Sur un compte jetable seulement, supprimer la progression, puis reconnecter un ancien appareil | Les données supprimées ne ressuscitent pas via une ancienne copie locale |
| Suppression d'un compte QA | Procédure `SUPPRIMER` sur un compte jetable uniquement | Connexion définitivement refusée, données du compte supprimées, autres comptes d'essai inchangés |

### Cas critique ajouté — changement de compte pendant la suppression Cloud

- Sur deux **comptes jetables A et B**, interrompre ou retarder une opération de sauvegarde A puis déclencher « supprimer ma progression » ; changer de compte avant la reprise réseau. **B doit conserver toutes ses données**, aucune RPC de suppression ne doit partir avec une identité B au nom de A.
- Reproduire aussi un changement de compte pendant la réponse de la RPC. L'interface ne doit pas effacer le cache local d'une identité précédente ni afficher un succès périmé à B.
- Côté navigateur, la branche V3 effectue un `auth.getUser()` supplémentaire **avant et après** `aim_reset_my_progress` et dispose de tests Node déterministes pour ces cas. Ce contrôle est une **défense en profondeur** : il ne peut pas éliminer toute fenêtre de course entre la dernière vérification et l'envoi effectif du JWT.
- **Limite bloquante à vérifier** : la RPC serveur actuelle `aim_reset_my_progress()` agit sur `auth.uid()` du JWT réellement reçu et ne reçoit pas encore d'UID attendu. Ne pas annoncer une isolation destructive totalement prouvée sans test A/B réel et, si le scénario révèle une course, une RPC serveur liant explicitement l'UID attendu à `auth.uid()`. Tout changement serveur devra faire l'objet d'une migration, d'une revue et d'une validation avant déploiement.

Ne pas supprimer les comptes d'essai avant d'avoir conservé **uniquement** les résultats non sensibles du protocole. Après validation, les supprimer de manière contrôlée. **État actuel de toute cette section : NON EXÉCUTÉE en vrai**, sauf si le propriétaire fournit séparément un compte rendu de test vérifiable.

## 3. Accessibilité, langues et réactivité

- Vérifier FR/EN, navigation clavier, focus visible, états cachés de formulaire, `prefers-reduced-motion`.
- Rejouer Chromium, Firefox et WebKit sur 1 672, 1 024, 768 et 390 px et vérifier l'absence de débordement horizontal.
- Tester les pages avec **zéro** séance (valeurs réelles/vides) et des séances de QA (chiffres réellement enregistrés), jamais avec les statistiques illustratives des maquettes.
- Vérifier que l'authentification et les comptes réels ne sont pas simulés pour améliorer artificiellement les captures.

## 4. Autorisation de déploiement V3

Les workflows préparés sur la branche V3 rendent la publication **manuelle** : uniquement depuis `main`, avec la confirmation `PUBLIER_AIMROUTINE_V3` et les deux attestations explicites (comparaison des quatre originaux/revue visuelle, puis tests e-mail/Google/multi-appareils avec comptes d'essai).

`recover-pages.yml` est archivé et ne possède plus de permission Pages. Les cinq tests `test_deployment_freeze_v3.py` surveillent ces propriétés. **Ces protections restent sur la PR tant qu'elle n'est pas fusionnée** ; elles ne changent pas la configuration externe du service GitHub Pages ni les workflows qui restent sur `main`.

Ne confirmer aucune publication tant que les quatre sources privées, les essais réels et l'approbation visuelle humaine ne sont pas documentés. Une simple attestation manuelle ne vaut pas preuve technique : la décision appartient au propriétaire après lecture des résultats.


## 5. Contrôle de cohérence des semaines et des indicateurs

**Corrigé en V3 / passe 60 (code et tests automatisés)** :

- `computeStats().week` et les barres 4/8/12 semaines de Progression comptabilisent la **semaine calendaire locale du lundi 00:00 au dimanche 23:59:59** et non les 168 dernières heures. Les séances futures ne sont pas comptabilisées.
- Le graphique et les KPI de Progression partagent un unique instant de référence par actualisation, y compris lors d'un changement de semaine.
- La barre `0 / 5` de Routines compte les **jours du programme complétés**, pas le nombre de séances ni les « 7 derniers jours ». Les libellés FR/EN ont été clarifiés, y compris les objectifs du tableau de bord.
- Tests source `tests/progress-weekly-core.test.mjs` : cinq scénarios (dimanche/lundi, 4/8/12 semaines, dates invalides/futures, nouvel an et heure d'été Europe/Paris).
- Tests Playwright `tests/browser.spec.mjs` : vérification de l'accord entre KPI et barres avec deux séances d'essai locales sur deux semaines différentes, et de la sémantique du plan de cinq jours.

Ces tests utilisent exclusivement des comptes et dates simulés ou une session mockée en navigateur. Ils ne modifient pas les données Supabase réelles et ne constituent toujours pas les essais de production avec comptes jetables décrits en section 2.


## 6. Nouveau blocage de publication : suppression Cloud liée à l'UID attendu (V3)

**État : EN ATTENTE de migration et d'essais réels — pas de publication.**

L'ancienne fonction actuellement déployée, `public.aim_reset_my_progress()`, supprime les données du compte associé au JWT reçu. Elle respecte RLS mais ne peut pas vérifier qu'un onglet client ayant demandé la suppression pour A n'a pas changé accidentellement pour B **entre** la dernière vérification client et l'appel RPC.

- La proposition SQL non appliquée est dans `docs/supabase-reset-bound-rpc-v3.proposal.sql`. Elle prévoit une fonction distincte `aim_reset_my_progress_for_user(expected_uid uuid)` exécutée en `SECURITY INVOKER`. Avant toute suppression, elle exige `auth.uid() = expected_uid` ; sinon la transaction doit échouer.
- Générer une **nouvelle migration Supabase CLI** depuis cette proposition, relire les droits `EXECUTE` et les RLS, la tester sur un environnement de test, puis la déployer de manière coordonnée **avant** d'activer le nouvel appel RPC côté client V3.
- Modifier `cloud-sync-v7.mjs` pour appeler exclusivement `aim_reset_my_progress_for_user` avec `{expected_uid:uid}`, **sans repli** vers la RPC sans paramètre. Tester une réponse refusée quand A est demandé avec un JWT B, ainsi que le scénario normal A/A, les erreurs réseau, la propagation du `reset_at` et deux appareils.
- Une fois tous les clients anciens retirés, révoquer puis supprimer l'ancienne RPC par une migration séparée ; ne pas la supprimer prématurément pendant que la version publiée en dépend.
- Le futur déploiement Pages exige maintenant l'attestation `account_bound_reset_verified` **et** l'exécution réussie de `scripts/check_reset_release_ready.py` dans la tâche de publication. Ce script bloque délibérément tant que le nouveau contrat client et une migration réelle (dans `supabase/migrations/`) ne sont pas présents.
- Les tests `tests/test_deployment_freeze_v3.py` couvrent le verrou et utilisent un SQL synthétique. Ils ne remplacent pas un test PostgreSQL ni une démonstration RLS réelle.

**Ne jamais appliquer cette proposition sur la base de production simplement pour faire passer la CI.** La PR reste en brouillon et l'approbation du propriétaire reste obligatoire.
