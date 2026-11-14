# AimRoutine V3 — Plan de basculement Cloud et sortie des clients V2

**14 novembre 2026 — DÉPLOIEMENT INTERDIT : procédure préparatoire, non autorisation de publication.**

La PR [#27](https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/pull/27) reste en brouillon. Le contrôle en lecture seule du 14 novembre a confirmé que le rôle `postgres` de Supabase ne possède **pas** les options nécessaires pour redistribuer `USAGE` sur le schéma `auth` ni `EXECUTE` sur `auth.uid()` : la proposition utilise donc l'héritage contrôlé des permissions déjà attribuées à `anon`. Les quatre PNG originaux complets, les tests de comptes jetables hébergés A/B, la validation visuelle du propriétaire et le déploiement coordonné ne sont pas encore homologués. **Aucun script de ce dossier n'a été appliqué à la base hébergée.**

## Pourquoi deux phases SQL sont nécessaires

La migration non déployée `supabase/migrations/20261111210933_reset_expected_uid.sql` fournit les fonctions `aim_reset_my_progress_for_user` et `aim_apply_progress_for_user`. Les deux vérifient explicitement `auth.uid() = expected_uid`, partagent un verrou transactionnel par compte et comparent le curseur `reset_at` pour les écritures.

Initialement, ces fonctions sont `SECURITY INVOKER`. Elles ont besoin des droits `INSERT/UPDATE/DELETE` du rôle `authenticated` sur les quatre tables. **Un ancien client V2 utilisant directement l'API REST peut donc contourner le verrou.** Ne jamais retirer ces droits d'écriture isolément : cela bloquerait également les fonctions V3.

Après une revue supplémentaire, le fichier **proposé seulement** [`docs/supabase-v3-writer-role-cutover.proposal.sql`](supabase-v3-writer-role-cutover.proposal.sql) décrit un deuxième changement coordonné :

- Créer un rôle PostgreSQL dédié `aim_cloud_writer`, sans connexion, sans superutilisateur et sans `BYPASSRLS`, qui **n'est propriétaire d'aucune table**. Sur Supabase hébergé, le rôle `postgres` ne peut pas accorder directement les permissions du schéma interne `auth` : le rôle technique doit donc **hériter des permissions du rôle `anon` dans un seul sens** (le rôle technique est membre de `anon`, jamais l'inverse) pour appeler `auth.uid()`. Les droits de `anon` sur toutes les tables publiques doivent être contrôlés avant cette opération : l'héritage de permissions futures constitue un risque à auditer.
- Donner exclusivement à ce rôle les privilèges nécessaires sur les quatre tables, avec des politiques RLS `auth.uid() = user_id` en lecture et écriture.
- Faire exécuter les **deux seules fonctions V3** en `SECURITY DEFINER` sous ce rôle restreint (et **non** sous le compte `postgres` qui contourne RLS), en conservant le `search_path` fixé à `pg_catalog`, le contrôle de l'identité du JWT et les restrictions d'exécution.
- Révoquer **tous** les droits directs des rôles `anon` et `authenticated` sur les quatre tables, puis redonner uniquement `SELECT` au rôle `authenticated`, toujours soumis à RLS.
- Ne jamais octroyer le rôle technique à `authenticated`, `anon` ou `authenticator`.

Cette utilisation très circonscrite de `SECURITY DEFINER` exige une revue de sécurité indépendante. Les fonctions sous un rôle puissant ou avec des permissions larges sont dangereuses. Voir [Supabase — Functions](https://supabase.com/docs/guides/database/functions) et [Securing your API](https://supabase.com/docs/guides/api/securing-your-api).

## Ce qui a été réellement vérifié (base PostgreSQL jetable uniquement)

Le workflow `prepare-account-bound-reset.yml` lance sur PostgreSQL 17 éphémère :

1. La migration V3 complète et les tests d'identité A/B, de rollback et de RLS.
2. L'écriture de séances, favoris, profils et objectifs sous RPC transactionnelle, ainsi que les deux ordres réels de concurrence sur deux connexions.
3. **Le fichier de coupure de droits proposé lui-même**, depuis `tests/role-cutover-prototype-postgres.sql` : les anciennes écritures directes `INSERT/UPDATE/DELETE` de V2 sont refusées, mais les lectures RLS et les RPC V3 continuent de fonctionner.
4. L'audit catalogues **en lecture seule** `scripts/check_live_cutover_readiness_v3.sql`, qui exige tous les indicateurs positifs après cette coupure.

**Preuve GitHub Actions :** [workflow PostgreSQL 17 vérifié](https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/43556144014). La même requête de précontrôle sur le projet Supabase hébergé retourne `ready_for_atomic_cutover=false`, ce qui est attendu puisque rien n'y a été appliqué.

Ces contrôles isolés sont indispensables mais **ne prouvent pas** la bonne configuration, la continuité de service ou la sécurité fonctionnelle sur le serveur hébergé.

## Ordre de recette avant toute action réelle

### Phase A — Préproduction indépendante

Utiliser une **base de préproduction** et deux ou trois comptes **jetables**, sans données privées et sans détourner l'environnement des utilisateurs. Prévoir une sauvegarde du schéma, des privilèges, des propriétaires de fonctions, des RLS et une procédure de récupération révisée.

1. Tester les clients V2 et V3 en l'état, y compris appareil A hors ligne, appareil B en ligne, Google OAuth, email, pseudo, CAPTCHA, favoris supprimés et reprise après erreur réseau.
2. Appliquer la migration V3 de base **uniquement en préproduction**. Tester les deux RPC et vérifier que la compatibilité avec V2 fonctionne tant que les droits directs sont maintenus.
3. Installer le candidat V3 sur un hébergement de test distinct. Tester les synchronisations A/B avec de vraies sessions Supabase jetables, pas seulement des mocks JavaScript.
4. Appliquer **en préproduction seulement** la proposition de séparation des droits après revue. Vérifier le retour positif des deux fonctions, des quatre tables et des règles RLS par `scripts/check_live_cutover_readiness_v3.sql`.
5. Vérifier qu'un V2 encore ouvert reçoit une erreur d'écriture contrôlée et **conserve localement** ses données. Vérifier qu'il peut lire et récupérer ses données après mise à niveau. Si ce comportement échoue, **le basculement est bloqué** ; préparer un correctif de compatibilité plutôt qu'autoriser une perte de données.
6. Rejouer les courses avec deux appareils et trois navigateurs distincts ; tester une suppression au moment exact où des écritures V3 attendent le verrou, deux resets immédiats, et les changements de JWT A vers B.

### Phase B — Conditions strictes du basculement public (toujours non remplies)

- Les **quatre PNG propriétaires originaux complets** sont disponibles localement, leur SHA-256 correspond au manifeste, les comparaisons avant/après ont été produites et validées humainement.
- Les essais de création, connexion, récupération, Google, déconnexion, suppression, Cloud et multi-comptes **réels jetables** sont documentés sans données sensibles.
- Les utilisateurs d'anciens clients ont un mécanisme de mise à jour sûr et un comportement d'échec qui **ne détruit pas** le travail local. Les clients V2 ne doivent plus pouvoir réintroduire une séance après un reset.
- La migration de base et la séparation des permissions ont été revues ; le déploiement préproduction est entièrement réussi et les erreurs connues sont résolues.
- Les audits post-installation et Supabase Security Advisor ne présentent aucun blocage non traité. Les avertissements génériques sur `SECURITY DEFINER` exigent une revue de l'identité du propriétaire technique, de ses rôles et des RLS ; **ne pas les ignorer**.
- Le propriétaire autorise **explicitement** le créneau et chaque opération sur la base hébergée, puis les attestations du workflow manuel de publication.

**Attention à l'ordre :** l'installation de la nouvelle RPC et le basculement en lecture seule des tables sont **deux opérations distinctes**. Le verrou de publication `atomic_cloud_writes_verified` ne peut être coché uniquement parce que les fonctions existent. Il faut aussi prouver le retrait des écritures directes V2 et la migration des utilisateurs.

### Phase C — Surveillance et récupération

Après déploiement autorisé seulement : suivre les erreurs `42501`, `40001` et `PGRST202` agrégées **sans identifiants ni charges de progression**. Vérifier que les clients V3 restent synchronisés et que les clients obsolètes affichent une consigne de mise à niveau sans effacer leur cache.

En cas de problème, **ne pas restaurer aveuglément les droits `INSERT/UPDATE/DELETE` au rôle `authenticated`** : cela rouvrirait la fenêtre de résurrection des séances. Priorité à une correction en avant ou à une procédure de retour arrière **revalidée** sur la préproduction. Toute récupération de droits ou de données réelles est une opération distincte demandant l'approbation du propriétaire.

L'ancienne RPC `aim_reset_my_progress()` peut rester présente pendant la transition, mais **elle ne restera pas forcément utilisable** lorsque les droits directs de `authenticated` seront révoqués : cette RPC historique est `SECURITY INVOKER` et dépend de ces droits. Ne pas lui accorder `SECURITY DEFINER` pour la réactiver, car elle ne reçoit pas l'identité attendue `expected_uid`. Prévoir explicitement la mise à niveau des anciens clients et les erreurs contrôlées avant le basculement. Sa révocation ou suppression fera l'objet d'une décision et d'une migration séparées après homologation.

**État : proposition et démonstration isolée réussies ; préproduction, basculement hébergé et homologation du site restent À FAIRE.**
