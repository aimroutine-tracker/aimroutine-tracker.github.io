# AimRoutine Tracker — authentification et ouverture publique

**État au 7 novembre 2026.** Document interne au dépôt, **non publié sur GitHub Pages**.

## Résultats démontrés (ne pas confondre avec les parcours complets)

- 8 caractères minimum, avec minuscule, majuscule, chiffre et symbole : vérifiés par appels réels à Supabase Auth.
- Before User Created `public.aim_beta_signup_gate` : actif ; nouvelle inscription e-mail refusée par le serveur, HTTP 403. Nouveaux comptes Google autorisés par la logique du hook.
- Confirmation et récupération : messages reçus dans Gmail et Outlook, liens pointant vers le bon projet et vers `account.html`. **Aucun lien de confirmation/récupération de compte jetable n'a encore été utilisé jusqu'au bout.**
- Écrans connexion, récupération et suppression Google `SUPPRIMER` : tests automatisés avec réponses simulées. **Ils ne prouvent pas une suppression réelle d'un compte Google jetable.**
- Synchronisation : tests unitaires sur deux utilisateurs et deux appareils, y compris hors ligne et propagations de suppressions ; politiques RLS PostgreSQL examinées et testées. **La validation réelle avec deux sessions authentifiées reste à faire.**
- `delete-aim-account` Edge Function : authentification JWT et texte `SUPPRIMER` exigés ; requêtes anonymes/falsifiées refusées.
- Déploiement GitHub Pages : artefacts statiques autorisés uniquement, contrôle des secrets et intégrité `riot.txt`.
- Cloudflare Turnstile : **clé publique du widget existant intégrée au site** et vérification prévue sur connexion, inscription, récupération et réauthentification par mot de passe avant suppression de compte. **Validation côté serveur encore inactive tant que le propriétaire n'a pas activé Turnstile dans Supabase Auth**. La connexion Google OAuth n'est pas soumise à ce widget. La clé secrète n'est jamais conservée dans le dépôt.
- Security Advisor Supabase Free : `Leaked Password Protection Disabled` est encore signalé. Le contrôle HIBP côté navigateur n'impose pas la vérification sur les appels directs API.
- Rotation de l'ancien secret Google OAuth : explicitement reportée par le propriétaire, risque résiduel.

## Finaliser le widget Cloudflare Turnstile existant — actions propriétaire

1. Le widget existe déjà. Sa **clé publique** est enregistrée dans `turnstile-v7.mjs` ; aucun secret n'a été écrit dans le dépôt, les scripts publics ou les tests. La protection du formulaire d'inscription est préparée, mais l'inscription reste fermée par le serveur.
2. Dans [Cloudflare Dashboard → Turnstile](https://dash.cloudflare.com/), vérifier que la liste d'hôtes autorisés contient **`aimroutine-tracker.github.io`** et que le widget est en mode Managed. Ne pas saisir une URL complète, seulement le nom d'hôte.
3. Ouvrir `https://aimroutine-tracker.github.io/account.html` après déploiement ; vérifier que le défi Turnstile apparaît ou se résout dans les formulaires **connexion e-mail**, **récupération de mot de passe**, et **réauthentification e-mail pour suppression du compte**. Google OAuth n'a pas besoin d'un CAPTCHA de formulaire.
4. **La clé secrète Turnstile ayant été collée dans une conversation**, la **faire tourner dans Cloudflare** puis utiliser exclusivement la **nouvelle clé secrète** pour l'étape suivante. Ne jamais la publier ni la communiquer à un assistant, à GitHub ou au navigateur.
5. Dans [Supabase → Authentication → Attack Protection](https://supabase.com/dashboard/project/lmzswtzboobpokumxzhy/auth/protection), activer **Enable CAPTCHA protection**, choisir **Cloudflare Turnstile**, saisir la **nouvelle clé secrète uniquement dans Supabase** et enregistrer. Supabase Auth réalise la vérification Siteverify côté serveur pour les opérations Auth ; le site statique n'a pas besoin d'une fonction de vérification supplémentaire.
6. Tester une connexion e-mail réelle et un envoi de récupération avec un défi réussi. Vérifier aussi qu'un appel à l'API Auth sans jeton valide est rejeté. Une fois activée, la protection peut bloquer les clients utilisant d'anciennes versions du site ; s'assurer que le cache et le Service Worker sont actualisés.
7. Ne pas ouvrir `SIGNUPS_READY` ni désactiver le hook d'inscription bêta avant les tests de confirmation/récupération, suppression Google et synchronisation avec comptes jetables.

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

**INTERDITE tant que les tests positifs précédents ne sont pas terminés et consignés.**

Après réussite : vérifier les réglages de protection anti-abus, **désactiver ou remplacer** de manière contrôlée `aim_beta_signup_gate` pour permettre les nouveaux e-mails, puis seulement changer `SIGNUPS_READY=false` en `true` dans `account-v7.mjs`, mettre à jour les textes du formulaire, effectuer un déploiement GitHub Pages sécurisé et revérifier un compte e-mail jetable en production. Avant ouverture vérifier confidentialité, conditions, adresse de support, état des déploiements et niveau de logs.

**Ne jamais** considérer un test simulé comme une preuve d'authentification Google / e-mail réelle, ni annoncer le site « sécurisé à 100 % ».
