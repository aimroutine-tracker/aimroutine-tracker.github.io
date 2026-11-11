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
