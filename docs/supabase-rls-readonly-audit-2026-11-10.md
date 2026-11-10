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

## Contrôles réels supplémentaires — inscription et suppression du compte

L'inspection **en lecture seule** de `public.aim_beta_signup_gate(event jsonb)` confirme que le code actuellement enregistré :

- accepte uniquement les fournisseurs `email` et `google` ;
- pour `email`, exige un pseudo `aim_username` de **3 à 24 caractères** conforme à `^[A-Za-z0-9][A-Za-z0-9_-]{2,23}# AimRoutine Tracker V3 — audit RLS Supabase en lecture seule

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

 ;
- pour `google`, laisse le pseudo obligatoire être recueilli lors de l'onboarding côté application ;
- refuse directement `EXECUTE` à `anon` et `authenticated`, mais autorise le rôle interne `supabase_auth_admin` à invoquer la fonction.

**Limite :** la présence et les droits de la fonction ne démontrent pas que le hook *Before User Created* est actuellement sélectionné dans les paramètres Auth. Un essai sur un nouveau compte de test reste nécessaire.

L'inspection du déploiement réel de la fonction Edge `delete-aim-account` (version **2**, **ACTIVE**, `verify_jwt=true`) confirme :

- méthode HTTP `POST` obligatoire et corps JSON comportant `action=delete_my_account`, `confirmation=SUPPRIMER` ;
- vérification du jeton utilisateur par Supabase Auth et cohérence de son UID avec l'identité authentifiée du contexte Edge ;
- aucun UID propriétaire transmis par le navigateur comme paramètre de suppression : la fonction supprime `data.user.id` ;
- pour un compte **sans identité Google**, contrôle supplémentaire de la date de dernière connexion (fenêtre 5 minutes) ; pour un compte **lié à Google**, le choix UX du propriétaire conserve la confirmation `SUPPRIMER` sans nouvelle authentification Google ;
- réponse neutre en cas d'erreur, sans exposition des secrets dans le corps de la réponse.

**Risque résiduel documenté :** la suppression d'un compte lié à Google ne requiert pas de seconde authentification si une session valide est déjà active. Ceci correspond au choix explicite du parcours utilisateur, mais impose une vigilance sur l'accès à un navigateur connecté. L'activation effective du JWT et le code lu n'équivalent pas à un test E2E réel de la fonction : les tests restent simulés.

## Avis de sécurité restant

L'avis officiel `auth_leaked_password_protection` signale toujours **WARN — Leaked Password Protection Disabled**. La vérification des mots de passe compromis côté navigateur ne remplace pas un contrôle natif de Supabase Auth.

**Limite de plan confirmée le 10 novembre 2026 :** la lecture réelle du projet et de son organisation Supabase indique le plan **`free` / `tier_free`**. La [documentation officielle de sécurité des mots de passe](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) précise que la protection native contre les mots de passe compromis est réservée aux plans **Pro et supérieurs** ; elle n'est donc **pas disponible sur ce projet Free**, même si l'audit signale sa désactivation. La [grille tarifaire officielle](https://supabase.com/pricing) confirme cette restriction.

**Décision compatible avec l'exigence 100 % gratuite :** maintenir le contrôle HIBP côté client et la longueur minimale côté Auth, conserver CAPTCHA, RLS et autres défenses existantes, ne pas promettre de filtrage serveur des mots de passe divulgués sur Free. Un contrôle client peut être contourné, d'où l'importance de ne pas le présenter comme un équivalent. Aucun passage à un plan payant ou modification Auth n'a été entrepris.

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
