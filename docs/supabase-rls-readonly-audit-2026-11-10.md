# AimRoutine Tracker V3 — audit RLS Supabase en lecture seule

**Date de vérification : 10 novembre 2026.** Projet connecté : `lmzswtzboobpokumxzhy`. Portée : inspection des métadonnées PostgreSQL/RLS via le connecteur Supabase ; **aucune modification de schéma, de données, de comptes ni de configuration Auth**.

## Constat directement vérifié

Les quatre tables publiques du tracker ont RLS activé. Chacune expose une unique politique `PERMISSIVE`, affectée au rôle `authenticated` et valable pour les opérations `ALL`. Dans les quatre cas :

- `USING ((SELECT auth.uid()) = user_id)` : un utilisateur ne peut sélectionner, modifier ni supprimer les lignes appartenant à un autre UID ;
- `WITH CHECK ((SELECT auth.uid()) = user_id)` : une insertion ou modification ne peut pas transférer la propriété d'une ligne à un autre UID ;
- le rôle `anon` ne possède ni `SELECT` ni `INSERT` sur ces tables ; le rôle `authenticated` possède les privilèges de table mais les opérations restent limitées par les politiques RLS.

| Table | RLS | Politique | Rôle | USING + WITH CHECK |
|---|---|---|---|---|
| `public.aim_profiles` | activé | `profile_owner_only` | `authenticated` | `auth.uid() = user_id` |
| `public.aim_preferences` | activé | `preferences_owner_only` | `authenticated` | `auth.uid() = user_id` |
| `public.aim_sessions` | activé | `sessions_owner_only` | `authenticated` | `auth.uid() = user_id` |
| `public.aim_presets` | activé | `presets_owner_only` | `authenticated` | `auth.uid() = user_id` |

### Fonction de suppression `public.aim_reset_my_progress()`

La définition actuelle a été inspectée en lecture seule via `pg_get_functiondef` :

- `SECURITY INVOKER` (pas de `SECURITY DEFINER`) ; `search_path=pg_catalog` ;
- `anon` : **pas de privilège EXECUTE** ; `authenticated` : **EXECUTE autorisé** ;
- la fonction calcule son `actor_id` à partir de `auth.uid()`, rejette une identité nulle, limite chaque `DELETE` à `WHERE user_id=actor_id` et conserve un marqueur de réinitialisation dans les préférences de ce seul UID ;
- elle ne prend aucun UID passé par le navigateur en paramètre.

L'inspection de ces métadonnées confirme le modèle d'isolation prévu ; **elle ne prouve pas encore la résistance à tous les appels malveillants ni les scénarios réels d'accès croisé**. La réponse exacte de l'API doit toujours être vérifiée avec deux comptes jetables A/B avant publication.

### Autre fonction publique du projet

`public.aim_beta_signup_gate(jsonb)` est actuellement **SECURITY INVOKER**, avec `search_path=pg_catalog` et **aucun privilège EXECUTE pour `anon` ou `authenticated`**. Sa bonne intégration au hook Auth n'est pas certifiée par cet audit ; elle reste à contrôler fonctionnellement.

## Avis de sécurité restant

L'avis officiel `auth_leaked_password_protection` signale toujours **WARN — Leaked Password Protection Disabled**. La vérification des mots de passe compromis côté navigateur ne remplace pas un contrôle natif de Supabase Auth.

Documentation : https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

Aucune option serveur n'a été changée ; il faut confirmer la disponibilité du réglage sur le plan réellement utilisé avant une activation, puis réexécuter les tests d'inscription et de réinitialisation.

## Méthodologie non destructive

Requêtes uniquement de lecture : métadonnées `pg_catalog.pg_policies`, `pg_catalog.pg_class`, `pg_catalog.pg_proc`, contrôles `has_table_privilege` / `has_function_privilege`, et `pg_get_functiondef` pour la RPC de reset. Aucune ligne utilisateur n'a été sélectionnée, aucun secret n'a été extrait, aucun compte n'a été créé.

## Critères restant à homologuer avant phase 7

- [x] RLS des quatre tables, predicates `USING` / `WITH CHECK` et privilèges `anon` examinés sur le vrai projet.
- [x] Fonction de suppression examinée en lecture seule.
- [ ] Inscription / connexion e-mail et Google sur deux comptes jetables indépendants.
- [ ] Vérification en direct de la lecture/écriture croisée A/B via les vrais jetons Auth, sans toucher aux comptes existants.
- [ ] Vérification des changements de compte et de la suppression/reset en environnement de test isolé.
- [ ] Vérification du hook d'inscription et de la protection contre les mots de passe compromis.
- [ ] Quatre comparaisons visuelles SHA-256 et overlays avec les PNG originaux privés.

**Décision :** contrôles de structure RLS conformes au modèle attendu ; homologation complète **NON ACCORDÉE**. La PR reste en brouillon, la branche `main` et le site public inchangés.
