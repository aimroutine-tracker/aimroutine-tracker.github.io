# AimRoutine Tracker — GitHub Pages site

Site vitrine bilingue français/anglais, statique et sans clé API ni backend.

## Publication recommandée (Riot)

1. Crée un dépôt **PUBLIC** portant exactement le nom `TON_UTILISATEUR_GITHUB.github.io`
   où `TON_UTILISATEUR_GITHUB` est ton identifiant GitHub réel (pas ton Riot ID).
2. Décompresse `aimroutine-github-pages.zip` sur ton ordinateur.
3. Dans le dépôt, utilise **Add file > Upload files**, sélectionne `index.html`,
   `privacy.html`, `terms.html`, `styles.css`, `site.js`, `.nojekyll` et `README.md`
   à la racine du dépôt. (Si `.nojekyll` est difficile à sélectionner, ce n'est pas bloquant.)
4. Clique sur **Commit changes**.
5. Ouvre **Settings > Pages > Build and deployment**.
6. Mets **Source = Deploy from a branch**, **Branch = main**, **Folder = /(root)** puis Save.
7. Vérifie `https://TON_UTILISATEUR_GITHUB.github.io/`.
8. Dans Riot Developer, mets **Product URL** à cette adresse seulement lorsqu'elle fonctionne.

## Vérification Riot

- Après enregistrement Riot, récupère **uniquement** la chaîne de vérification fournie par Riot.
- Crée un nouveau fichier nommé `riot.txt` à la racine de la branche publiée.
- Mets dans le fichier la chaîne exactement, sans aucun espace ou autre contenu.
- Vérifie qu'elle est visible via `https://TON_UTILISATEUR_GITHUB.github.io/riot.txt`.
- Relance ensuite la vérification depuis le Developer Portal.
- Riot recommande de supprimer/masquer le fichier après vérification.

**Ne jamais placer de clé RGAPI, mot de passe, secret RSO, token ou fichier `.env` sur ce site.**

## Avant un examen de production Riot

- Remplacer les paragraphes provisoires de contact par un contact réel et public.
- Adapter la politique de confidentialité à l'état effectif du produit.
- Ajouter une vraie démo, captures d'écran et/ou une page de téléchargement lorsque disponibles.
- L'approbation de Riot n'est pas garantie. Riot peut demander un domaine personnel
  vérifiable (`exemple.fr`) même si ce site fonctionne sous `github.io`.
- Dans ce cas, GitHub Pages peut héberger le même site sous un **domaine personnalisé**.

## Structure

- `index.html` — accueil & présentation
- `privacy.html` — confidentialité (texte de base à adapter)
- `terms.html` — conditions d'utilisation (texte de base à adapter)
- `styles.css` — styles responsive
- `site.js` — changement de langue local
- `.nojekyll` — livraison des fichiers statiques sans transformation Jekyll

Ce site est un **site vitrine**, pas une application Riot Sign On et pas un serveur d'API.