# AimRoutine Tracker — authentification et ouverture publique

**État au 7 novembre 2026.** Document interne au dépôt, **non publié sur GitHub Pages**.

## Résultats démontrés (ne pas confondre avec les parcours complets)

- 8 caractères minimum, avec minuscule, majuscule, chiffre et symbole : vérifiés par appels réels à Supabase Auth.
- Before User Created `public.aim_beta_signup_gate` : **nouveaux comptes e-mail et Google autorisés** après validation négative du CAPTCHA ; les autres fournisseurs restent rejetés.
- Confirmation et récupération : messages reçus dans Gmail et Outlook, liens pointant vers le bon projet et vers `account.html`. **Aucun lien de confirmation/récupération de compte jetable n'a encore été utilisé jusqu'au bout.**
- Écrans connexion, récupération et suppression Google `SUPPRIMER` : tests automatisés avec réponses simulées. **Ils ne prouvent pas une suppression réelle d'un compte Google jetable.**
- Synchronisation : tests unitaires sur deux utilisateurs et deux appareils, y compris hors ligne et propagations de suppressions ; politiques RLS PostgreSQL examinées et testées. **La validation réelle avec deux sessions authentifiées reste à faire.**
- `delete-aim-account` Edge Function : authentification JWT et texte `SUPPRIMER` exigés ; requêtes anonymes/falsifiées refusées.
- Déploiement GitHub Pages : artefacts statiques autorisés uniquement, contrôle des secrets et intégrité `riot.txt`.
- Cloudflare Turnstile : **clé publique du widget existant intégrée au site** et vérification prévue sur connexion, inscription, récupération et réauthentification par mot de passe avant suppression de compte. **Validation côté serveur activée le 7 novembre 2026**, test réel négatif sans CAPTCHA : récupération HTTP 400 et erreur CAPTCHA. La connexion Google OAuth n'est pas soumise à ce widget. La clé secrète n'est jamais conservée dans le dépôt.
- Security Advisor Supabase Free : `Leaked Password Protection Disabled` est encore signalé. Le contrôle HIBP côté navigateur n'impose pas la vérification sur les appels directs API.
- Rotation de l'ancien secret Google OAuth : explicitement reportée par le propriétaire, risque résiduel.

## Test utilisateur après activation (7 novembre 2026)

- **Connexion e-mail : validée côté utilisateur** après activation de Cloudflare Turnstile dans Supabase Auth et mise en ligne de la clé publique : le propriétaire a confirmé réussir à se connecter via le site.
- Cela vérifie la **continuité du parcours positif** ; cela **ne prouve pas à lui seul** que les requêtes sans jeton ou avec jeton invalide sont refusées. Un test négatif côté API reste à effectuer.
- **Récupération de mot de passe** : pas encore vérifiée de bout en bout après activation Turnstile (envoi, consommation du lien, changement puis reconnexion).
- **Inscriptions e-mail** : formulaire réactivé et hook permettant `email` et `google`. CAPTCHA côté serveur vérifié négativement, confirmation e-mail exigée. Le parcours réel de création et validation du premier nouveau compte doit encore être testé.
- Ne pas considérer comme validées la synchronisation entre sessions authentifiées ni la suppression Google par un compte jetable.

## Finaliser le widget Cloudflare Turnstile existant — actions propriétaire

1. Le widget existe déjà. Sa **clé publique** est enregistrée dans `turnstile-v7.mjs` ; aucun secret n'a été écrit dans le dépôt, les scripts publics ou les tests. La protection du formulaire d'inscription est préparée, mais l'inscription reste fermée par le serveur.
2. Dans [Cloudflare Dashboard → Turnstile](https://dash.cloudflare.com/), vérifier que la liste d'hôtes autorisés contient **`aimroutine-tracker.github.io`** et que le widget est en mode Managed. Ne pas saisir une URL complète, seulement le nom d'hôte.
3. Ouvrir `https://aimroutine-tracker.github.io/account.html` après déploiement ; vérifier que le défi Turnstile apparaît ou se résout dans les formulaires **connexion e-mail**, **récupération de mot de passe**, et **réauthentification e-mail pour suppression du compte**. Google OAuth n'a pas besoin d'un CAPTCHA de formulaire.
4. **La clé secrète Turnstile ayant été collée dans une conversation**, la **faire tourner dans Cloudflare** puis utiliser exclusivement la **nouvelle clé secrète** pour l'étape suivante. Ne jamais la publier ni la communiquer à un assistant, à GitHub ou au navigateur.
5. Dans [Supabase → Authentication → Attack Protection](https://supabase.com/dashboard/project/lmzswtzboobpokumxzhy/auth/protection), activer **Enable CAPTCHA protection**, choisir **Cloudflare Turnstile**, saisir la **nouvelle clé secrète uniquement dans Supabase** et enregistrer. Supabase Auth réalise la vérification Siteverify côté serveur pour les opérations Auth ; le site statique n'a pas besoin d'une fonction de vérification supplémentaire.
6. Tester une connexion e-mail réelle et un envoi de récupération avec un défi réussi. Vérifier aussi qu'un appel à l'API Auth sans jeton valide est rejeté. Une fois activée, la protection peut bloquer les clients utilisant d'anciennes versions du site ; s'assurer que le cache et le Service Worker sont actualisés.
7. Le bouton d'inscription est désormais ouvert. Surveiller les nouvelles inscriptions et effectuer un test de confirmation e-mail réel avant d'annoncer tous les parcours validés. Conserver le hook de restriction aux fournisseurs `email` et `google`.

Documentation : https://supabase.com/docs/guides/auth/auth-captcha

## Tests d'acceptation indispensables (comptes jetables uniquement)

### A. Confirmation / récupération e-mail

- Créer au besoin une **autorisation temporaire limitée à une adresse de test possédée par le propriétaire** dans le hook `Before User Created` ; ne jamais désactiver la protection globale sans gardes.
- Avec un mot de passe unique de 8 caractères minimum et les quatre classes, envoyer l'inscription depuis le **formulaire réel** et vérifier que l'e-mail arrive.
- Ouvrir **une seule fois** le lien de confirmation, contrôler la connexion sur `account.html` et la création d'une session authentifiée.
- Se déconnecter, demander un lien de récupération, ouvrir le lien reçu, choisir un nouveau mot de passe, puis vérifier qu'il permet la connexion et que l'ancien est rejeté.
- Supprimer ensuite **uniquement** ce compte de test ; contrôler dans Supabase l'absence de l'identité et de toute progression associée. Ne jamais détruire les comptes préexistants.

### B. Google — suppression avec SUPPRIMER

- Se connecter avec un **compte Google jetable sans données importantes**, distinct de tout compte personnel.
- Enregistrer une séance de test et activer volontairement le cloud.
- Dans la section de suppression, écrire exactement `SUPPRIMER` et valider, **sans nouveau passage par Google OAuth**.
- Vérifier l'absence de cette identité dans Supabase et la disparition de ses quatre ensembles de données cloud ; essayer de se reconnecter avec un autre compte pour confirmer que rien ne réapparaît. Attention : se reconnecter à Google **peut créer une nouvelle identité** si l'inscription Google est toujours autorisée, ce n'est pas la preuve que l'ancienne identité a survécu.

### C. Synchronisation / conflits / isolation

- Compte A : sur deux navigateurs ou appareils différents, créer la séance S1, synchroniser et vérifier qu'elle arrive sur le second.
- Sur A/appareil 2 hors ligne, créer S2, tandis que A/appareil 1 crée S3. Reconnecter et synchroniser les deux ; toutes les séances valides et leurs identifiants doivent être présents une seule fois.
- Supprimer un favori, synchroniser les deux appareils ; vérifier que l'ancien appareil ne le restaure pas.
- Supprimer la progression cloud avec double confirmation sur A ; reconnecter un appareil resté hors ligne et vérifier qu'il **ne ressuscite pas** l'historique supprimé.
- Compte B : vérifier que S1/S2/S3 et les préférences de A sont absentes, et qu'un compte B ne peut pas modifier une ligne de A.
- Toujours exporter une copie avant un test destructeur.

## Décision d'ouverture

**Ouverture du formulaire d'inscription autorisée avec Turnstile côté serveur, validation négative HTTP 400, e-mail à confirmer et hook limité aux fournisseurs `email` et `google`. La validation de bout en bout des premiers comptes réels reste à consigner avant toute annonce de disponibilité générale sans réserve.**

Les réglages anti-abus et CAPTCHA ont été vérifiés négativement avant ouverture. Le hook `aim_beta_signup_gate` est maintenu mais permet `email` et `google` uniquement. Le site est en `SIGNUPS_READY=true`, et les textes du formulaire et contrôles de déploiement ont été actualisés. Restent la confirmation e-mail d'un vrai compte jetable, la récupération complète et les tests multi-comptes. Avant ouverture vérifier confidentialité, conditions, adresse de support, état des déploiements et niveau de logs.

**Ne jamais** considérer un test simulé comme une preuve d'authentification Google / e-mail réelle, ni annoncer le site « sécurisé à 100 % ».

## Actualisation des contrôles — 7 novembre 2026

- Le propriétaire a confirmé les parcours réels de création e-mail, récupération du mot de passe, suppression de compte, Google OAuth et synchronisation entre appareils. Cela ne prouve pas toutes les courses critiques possibles.
- Les contrôles RLS ont été relus en direct dans PostgreSQL sur les quatre tables. Tests d'identités A/B et sans identité en transactions SQL ; lectures d'autrui invisibles. Tentatives croisées UPDATE et INSERT rejetées, sans modification persistante.
- `aim_reset_my_progress` est SECURITY INVOKER, réservé aux sessions authentifiées et publie un curseur de suppression. Tests simulés : deux appareils + hors ligne + suppression de favoris + réinitialisation.
- Pour les nouvelles séances et routines portant le même identifiant, les écritures simultanées utilisent `ignoreDuplicates` et la clé primaire composite afin de conserver le premier enregistrement cloud plutôt que l'écraser. Le client local converge à la synchronisation suivante.
- Le déploiement GitHub Pages exécute désormais les tests unitaires, la vérification syntaxique et la recherche de secrets **avant** de publier les fichiers statiques.
- **Risque restant GitHub :** la branche principale `main` n'est pas protégée. L'app GitHub connectée n'a pas d'accès aux paramètres administratifs de protection de branche ; configurer cela depuis le tableau de bord GitHub.
- **Risque restant Supabase :** l'advisor affiche encore `auth_leaked_password_protection`. Le contrôle HIBP côté navigateur n'empêche pas les accès directs à l'API.
- **Risque restant secrets :** la clé secrète Cloudflare dévoilée durant l'installation doit être renouvelée puis réenregistrée directement dans Supabase. L'ancien secret Google OAuth partagé antérieurement doit également être remplacé.
- L'édition concurrente **d'une même routine préexistante** n'est pas encore résolue en temps réel : les routines déjà synchronisées sont traitées comme des instantanés immuables ; créer une nouvelle version plutôt que supposer qu'un conflit d'édition sera fusionné.

## Contrôle Supabase Free et vérification RLS — 7 novembre 2026

- Organisation confirmée sur **free**, sans coût engagé ni migration vers Pro.
- Quatre tables `aim_profiles`, `aim_preferences`, `aim_sessions`, `aim_presets` : RLS en production, politiques `FOR ALL TO authenticated`, `USING` et `WITH CHECK` verrouillés sur `(select auth.uid()) = user_id`.
- Les rôles `anon` et `PUBLIC` n'ont pas de droits de lecture/écriture explicites sur ces tables. Les fonctions exposées `aim_beta_signup_gate` et `aim_reset_my_progress` ne sont pas `SECURITY DEFINER` ; le hook n'est pas exécutable par `anon` ou `authenticated`, et la réinitialisation exige un compte authentifié.
- Test transactionnel PostgreSQL sur les identités A/B : impossible pour B de lire, ajouter, modifier ou supprimer les données de A. Toutes les opérations de simulation ont été annulées (`ROLLBACK`).
- Contrôle du schéma : clés étrangères avec suppression en cascade vers `auth.users`, limites de taille des payloads JSON, clés primaires composites et vérification de cohérence entre ID et payload.
- Tests de non-régression sur l'API REST publique : les quatre tables doivent refuser les lectures anonymes ou retourner une liste vide. Aucun compte factice n'est créé et aucun enregistrement réel n'est modifié.
- Un garde-fou supplémentaire détecte des secrets Turnstile longs accidentellement ajoutés aux fichiers versionnés. Les clés publiques Turnstile restent autorisées.
- **Alerte Supabase restante** : `auth_leaked_password_protection`. Protection serveur réservée au plan Pro, non disponible sur Free. Contrôle HIBP dans le navigateur existant, mais contournable via l'API Auth directe.
- Les réglages de durée de session, limitations de débit et les secrets des fournisseurs OAuth ne peuvent pas être inspectés ou modifiés via les actions de gestion disponibles ici ; ne pas les déclarer vérifiés.
- OAuth Google, inscription par e-mail et synchronisation restent intacts ; aucune modification de leur configuration serveur n'a été effectuée lors de cet audit.
