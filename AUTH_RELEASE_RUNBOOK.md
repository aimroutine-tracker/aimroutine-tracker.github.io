# AimRoutine Tracker — authentification et ouverture publique

**État au 6 novembre 2026.** Document interne au dépôt, **non publié sur GitHub Pages**.

## Résultats démontrés (ne pas confondre avec les parcours complets)

- 8 caractères minimum, avec minuscule, majuscule, chiffre et symbole : vérifiés par appels réels à Supabase Auth.
- Before User Created `public.aim_beta_signup_gate` : actif ; nouvelle inscription e-mail refusée par le serveur, HTTP 403. Nouveaux comptes Google autorisés par la logique du hook.
- Confirmation et récupération : messages reçus dans Gmail et Outlook, liens pointant vers le bon projet et vers `account.html`. **Aucun lien de confirmation/récupération de compte jetable n'a encore été utilisé jusqu'au bout.**
- Écrans connexion, récupération et suppression Google `SUPPRIMER` : tests automatisés avec réponses simulées. **Ils ne prouvent pas une suppression réelle d'un compte Google jetable.**
- Synchronisation : tests unitaires sur deux utilisateurs et deux appareils, y compris hors ligne et propagations de suppressions ; politiques RLS PostgreSQL examinées et testées. **La validation réelle avec deux sessions authentifiées reste à faire.**
- `delete-aim-account` Edge Function : authentification JWT et texte `SUPPRIMER` exigés ; requêtes anonymes/falsifiées refusées.
- Déploiement GitHub Pages : artefacts statiques autorisés uniquement, contrôle des secrets et intégrité `riot.txt`.
- Cloudflare Turnstile : **module frontal intégré mais désactivé**, car aucun site key ni secret de widget de production n'a été fourni. Ne pas déclarer CAPTCHA activé ni empêcher la connexion Google.
- Security Advisor Supabase Free : `Leaked Password Protection Disabled` est encore signalé. Le contrôle HIBP côté navigateur n'impose pas la vérification sur les appels directs API.
- Rotation de l'ancien secret Google OAuth : explicitement reportée par le propriétaire, risque résiduel.

## Configuration de Cloudflare Turnstile — actions propriétaire

1. Créer un widget **Turnstile** dans [Cloudflare Dashboard](https://dash.cloudflare.com/). Ajouter l'hôte `aimroutine-tracker.github.io` (et `localhost` seulement en test local).
2. Ne partager avec l'assistant que la **site key publique**. **Ne jamais transmettre la secret key** dans ChatGPT, GitHub, HTML, JavaScript ou un ticket public.
3. Inscrire la site key dans `turnstile-v7.mjs`, constante `TURNSTILE_SITE_KEY`. Déployer le site et vérifier que le widget est visible et permet la connexion et la récupération d'un compte e-mail existant, sans changer le statut des inscriptions publiques.
4. Dans [Supabase Auth → Attack Protection](https://supabase.com/dashboard/project/lmzswtzboobpokumxzhy/auth/protection), activer **Enable Captcha protection**, choisir **Cloudflare Turnstile**, saisir la **secret key uniquement dans Supabase** et enregistrer. Faire un test de connexion e-mail et un test de récupération ; vérifier que sans défi valide l'API refuse la requête.
5. Conserver des limites Supabase Auth raisonnables (les valeurs ont été examinées le 6 novembre). Ne pas activer CAPTCHA avant d'avoir déployé la site key, sinon les parcours e-mail seront bloqués.

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
