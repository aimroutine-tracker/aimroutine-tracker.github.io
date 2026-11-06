# AimRoutine Tracker — notes de version complètes

**De la création du logiciel à la version 2.9.1**  
Dernière mise à jour : **6 novembre 2026**.

AimRoutine Tracker est un compagnon Windows pour organiser les entraînements AIM, suivre les résultats et analyser les parties VALORANT importées. Le projet a évolué d’un suivi manuel de routine vers un espace comprenant coach, profils locaux, programmes enregistrés, bilans et rapports de parties.

Cet historique rassemble les changements documentés dans les versions et guides conservés. Les premières étapes sont regroupées lorsqu’aucune note de publication distincte ne permet de leur attribuer un numéro ou une date précise.

## Première génération — création du logiciel, série 1.x

### Le suivi d’entraînement initial

- Création de l’application Windows AimRoutine Tracker avec une interface en français.
- Mise en place de React et TypeScript pour l’interface, Electron pour l’application desktop et SQLite pour les données locales.
- Première interface sombre bleu nuit avec accents cyan.
- Ajout des pages Dashboard, Routine du jour, Saisie de session, Statistiques, Historique et Paramètres.
- Intégration des quatre logiciels suivis : KovaaK’s, Aim Lab, VALORANT et Oblivity.
- Ajout d’un catalogue initial de 19 exercices.
- Création d’une routine complète et d’un échauffement court distinct.
- Possibilité de modifier les durées cibles et les objectifs.

### Chronomètre et résultats

- Chronomètre par exercice avec démarrage, pause et remise à zéro.
- Validation des exercices et suivi de l’avancement de la séance.
- Saisie de la date, du logiciel, de l’exercice, de la durée réellement effectuée, du score, de la précision, du pourcentage d’impacts à la tête, des notes et du ressenti.
- Ajout de résultats libres en dehors des séances guidées.
- Modification et suppression des résultats depuis l’historique.
- Conservation des champs vides comme données inconnues ; les zéros saisis restent de véritables valeurs.

### Statistiques, calendrier et sauvegardes

- Graphiques de progression par logiciel et exercice.
- Suivi du temps d’entraînement, des séances terminées et de la régularité.
- Vue calendrier et suivi des jours consécutifs d’entraînement.
- Export JSON et CSV ; import avec validation et prévention des doublons par identifiant.
- Stockage SQLite local avec écritures atomiques et conservation d’une copie précédente.
- Gestion des erreurs de sauvegarde sans écrasement automatique d’une base illisible.
- Première distribution Windows portable, utilisable sans installation de Node.js.

### Interactivité de la première génération — build conservé 1.1.0

- Chronomètre circulaire animé et progression visuelle de l’exercice.
- Indication de fin du compte à rebours et son facultatif.
- Retour visuel lors de la fin d’une séance.
- Progression de pratique avec XP, niveaux et objectifs à débloquer.
- Détails des récompenses consultables depuis l’interface.
- Distinction entre progression de pratique et performance : les XP ne déterminent pas le rang VALORANT.
- Conservation du suivi lorsque l’utilisateur passe d’une page à une autre.

La première routine totalisait **44 minutes de durées cibles**, avec des valeurs de départ modifiables. La routine personnelle de **49 minutes** a été intégrée plus tard, dans la série 2.x.

## Version 2.0 — refonte autour du coach personnel

### Profil et préparation de séance

- Ajout d’un assistant de configuration initiale.
- Prise en compte du rang déclaré, des objectifs, des difficultés observées, de la fatigue et du temps disponible.
- Réglages du DPI, de la sensibilité et des logiciels disponibles.
- Possibilité de construire un programme avec VALORANT uniquement.
- Création de six formats d’entraînement : échauffement, quotidien, intensif, léger, récupération et repos.
- Budget de séance prenant en compte les exercices et les pauses.

### Bibliothèque et programmes modifiables

- Bibliothèque d’exercices filtrable par logiciel, compétence et difficulté.
- Ajout d’exercices personnels avec consignes, objectifs et erreurs à éviter.
- Génération d’un programme à partir du profil.
- Modification des durées, répétitions, difficultés et exercices.
- Ajout, retrait et réorganisation des étapes.
- Explications sur les choix du programme et alternatives disponibles.

### Suivi plus fiable

- Sauvegarde de la séance en cours et reprise en pause après fermeture.
- Le temps écoulé pendant la fermeture n’est pas ajouté à l’entraînement.
- Atteindre zéro au chronomètre ne valide pas automatiquement un résultat.
- Introduction de mesures de niveau AIM fondées sur des seuils personnalisés et des résultats comparables.
- Distinction entre rang déclaré, niveau technique mesuré et XP de pratique.
- Ajustements de difficulté encadrés par l’historique, la comparabilité, la variabilité et la fatigue.
- Statistiques sur plusieurs périodes et répartition du temps entre compétences.
- Migration des sauvegardes de la première génération.
- Import de fichiers de parties VAL-MATCH-V1 pour consulter les statistiques disponibles localement.

## Version 2.1 — des parcours distincts de Fer à Radiant

- Développement de neuf parcours : Fer, Bronze, Argent, Or, Platine, Diamant, Ascendant, Immortel et Radiant.
- Différenciation des divisions 1, 2 et 3 ; Radiant reste un rang unique.
- Adaptation de la répartition des compétences, des consignes et des contraintes de travail.
- Ajout d’instructions propres au parcours : mise en place, exécution et repère personnel.
- Conservation des consignes originales d’une séance déjà commencée.
- Renforcement des règles de comparabilité : même exercice, durée, difficulté et protocole de travail.
- L’augmentation automatique attend plusieurs résultats comparables sur plusieurs jours ; un record isolé ne suffit pas.

Ces parcours sont des propositions AimRoutine. Ils ne constituent pas des benchmarks officiels ni des conditions de montée de rang.

## Version 2.2 — profils locaux et routines enregistrées

### Plusieurs joueurs sur le même logiciel

- Création et sélection de profils locaux nommés.
- Espace séparé pour chaque joueur : réglages, bibliothèque, calendrier, routines, résultats et parties importées.
- Jusqu’à 50 profils sur le même compte Windows.
- Mise en pause du chronomètre lors d’un changement de profil.
- Attente de la sauvegarde avant de changer d’espace.
- Assistant de configuration et historique vide pour chaque nouveau profil.
- Reprise des données V2 existantes dans le premier profil.

### Routines prêtes à charger et programmes personnels

- Ajout de la page **Mes routines**.
- Prévisualisation des étapes avant de charger un programme.
- Enregistrement d’une routine personnelle nommée.
- Chargement d’une copie modifiable du programme.
- Suppression d’une routine enregistrée sans suppression des séances historiques.
- Jusqu’à 100 routines personnelles par profil.

### Routine AIM VALORANT de 49 minutes

Reconstitution du programme fourni lors de la conception :

| Bloc | Contenu | Durée |
| --- | --- | --- |
| KovaaK’s | 1w2t smallflicks small 60s ; 1w4ts reload ; Pasu Small Reload ; Floating Heads Timing 400% ; patTargetSwitch Small | 18 min |
| Aim Lab | Micro 2 Sphere, Microshot, Adjustshot, Headshot, Strafeshot et Peekshot VALORANT | 12 min |
| VALORANT | One taps ; strafe + arrêt + tir ; Bots Hard ; Deathmatch | 17 min |
| Pauses | Deux transitions d’une minute | 2 min |
| **Total** | **47 minutes d’exercices et 2 minutes de pause** | **49 min** |

- Deathmatch estimé à 12 minutes ; la durée réellement effectuée peut être renseignée.
- Module **Oblivity · analyse hebdomadaire** séparé : 20 minutes.
- **Sensitivity Finder** proposé comme test distinct.
- Ajout d’un échauffement de 10 minutes et d’une routine quotidienne de 30 minutes.
- Variante permettant d’adapter la routine aux logiciels du profil avec substitutions signalées.
- Correction du recalcul des répétitions lorsqu’une durée d’exercice est modifiée.
- Préréglage souris facultatif : 1 600 DPI, sensibilité 0,215, polling 4 000 Hz, soit 344 eDPI.
- Intégration d’un planning hebdomadaire conseillé avec repos le dimanche.

## Version 2.3 — identité VALORANT et bilans de séance

### Refonte visuelle

- Nouvelle identité bleu nuit et corail.
- Illustration de Jett intégrée localement pour un affichage hors ligne.
- Cartes angulaires, boutons, formulaires et chronomètre assortis.
- Mode de contraste renforcé.
- Aides visuelles illustrant douze compétences d’entraînement.

### Mes bilans

- Bilan accessible après une séance terminée et depuis les séances précédentes.
- Comparaison avec 3 à 5 scores antérieurs comparables : exercice, logiciel, difficulté, protocole et durée proche.
- Absence de progression chiffrée lorsque la référence est insuffisante.
- Propositions de travail à partir des baisses observées, de la stabilité de la précision, du ressenti et de la fatigue.
- Préparation d’une séance suivante après action de l’utilisateur.
- Les propositions du coach conservent le rang déclaré et expliquent leur logique.

### Planning, partage et transferts

- Association de véritables routines aux jours du calendrier.
- Semaine type récurrente et exceptions par date.
- Affichage du programme prévu aujourd’hui dans le Dashboard.
- Signalement des logiciels manquants avant de lancer une séance.
- Favoris, renommage et duplication des routines enregistrées.
- Export et partage d’une routine seule en JSON.
- Mémorisation des associations de colonnes CSV pour les imports suivants.
- Amélioration de la détection des doublons dans les imports de résultats.
- Sauvegarde de tous les profils dans un fichier, avec leurs parties VALORANT importées.
- Restauration ajoutant des profils séparés tout en conservant les profils existants.

## Version 2.3.1 — nettoyage des textes et noms de programmes

- Suppression des mentions d’origine du type « ton image » dans les noms et consignes générés.
- Noms de routines devenus autonomes et utilisables dans le logiciel.
- Correction des anciens libellés dans les programmes enregistrés, séances en cours et bilans.
- Conservation des noms personnalisés, scores, durées et exercices.

## Version 2.4 — saisie adaptée à chaque logiciel

### Des champs plus faciles à comprendre

- Aides spécifiques pour Aim Lab, KovaaK’s, Oblivity et VALORANT.
- Explication des valeurs à recopier à la fin d’une tentative.
- Distinction entre score final, record personnel, classement, kills et ACS.
- Pour les modules d’analyse Oblivity, mise en avant des observations et réglages dans les notes.
- Une fiche représente une tentative ; sa durée doit correspondre au résultat saisi.

### Pourcentage d’impacts à la tête

- Champ directement visible pour VALORANT.
- Champ facultatif et replié pour les aim trainers, tout en gardant visibles les anciennes valeurs renseignées.
- Colonne ajoutée à l’historique lorsqu’au moins un résultat en contient.
- Le libellé a ensuite été uniformisé en **Headshot %** dans la version 2.4.1.

### Pourcentages et nombres

- Calculateur facultatif de précision : tirs réussis / tirs effectués.
- Calculateur facultatif de Headshot % : tête / (tête + corps + jambes).
- Application du résultat uniquement après clic.
- Gestion des virgules et points décimaux, du symbole % et des séparateurs de milliers.
- Choix du format pour les écritures ambiguës et aperçu de la valeur enregistrée.
- Conservation des champs vides et des zéros saisis.
- Remise à vide des chiffres lors d’un changement de logiciel afin d’éviter les reports involontaires.
- Aucun faux pourcentage calculé avec un dénominateur nul.

## Version 2.4.1 — harmonisation du libellé Headshot %

- Remplacement des libellés « HS % » par **Headshot %**.
- Harmonisation dans les formulaires, les calculateurs et leurs aides.
- Même terminologie dans l’historique, les indicateurs VALORANT et l’import CSV.
- Mise à jour des messages de validation dans l’interface et le stockage SQLite.
- Conservation des valeurs déjà enregistrées.
- L’interface générale reste en français ; la demande d’anglais concernait ce libellé précis.
- Maintien de la distribution Windows portable.

## Version 2.5 — diagnostic Riot Games et démonstration de parties

### Connexion Riot Games

- Création d’une page dédiée aux tests de l’API officielle Riot Account-V1.
- Champ masqué pour une Development API Key.
- Conservation de la clé en mémoire pendant la session ; absence de sauvegarde en clair dans SQLite, localStorage ou les exports.
- Suppression de la clé et des diagnostics depuis l’interface.
- Effacement de la clé lors de la fermeture ou d’un changement de profil.
- Recherche d’un compte par pseudo et tagline, avec encodage des valeurs.
- Affichage des informations renvoyées : Riot ID et PUUID.
- Affichage du statut HTTP, de la durée de réponse et de diagnostics filtrés.
- Gestion des erreurs 401, 403, 404, 429, 500, 502, 503 et 504, du timeout et des erreurs réseau.
- Respect des limites et délais d’attente transmis par Riot ; absence de boucle de relance automatique.
- Un succès indique **« Clé API valide pour cet endpoint »** et ne prouve pas la propriété du compte recherché.

Un test Account-V1 réel documenté a réussi. Il n’a récupéré aucun historique de parties VALORANT.

### Mes parties VALORANT

- Import de fichiers JSON de parties compatibles.
- Historique avec identifiant du match, carte, mode, agent, résultat, kills, deaths et assists.
- Calculs communs de K/D, KDA, Headshot %, ACS et taux de victoire lorsque les données nécessaires sont présentes.
- Graphiques de progression.
- Comparaison descriptive avant/après une séance avec affichage du nombre de parties utilisé.
- Résumé du Dashboard mis à jour à partir des parties disponibles.
- Prévention des doublons par identifiant de match.

### Mode Démonstration

- Huit parties fictives fournies localement pour tester l’historique, les graphiques et les calculs.
- Espace de démonstration séparé des parties personnelles.
- Identification visible des données fictives.
- Possibilité de charger, importer et vider la démonstration sans effacer les données personnelles.
- Fournisseurs distincts préparés pour les tests développeur, les fichiers locaux et la future intégration de production.

## Version 2.6 — portraits d’agents et premières animations de navigation

- Portrait, nom et rôle de l’agent sur les cartes de parties.
- Catalogue local comprenant 30 agents au moment de cette livraison.
- Reconnaissance des noms, identifiants UUID et alias connus.
- Affichage neutre pour un agent inconnu, avec conservation de son identifiant.
- Filtre par agent appliqué à l’historique, aux statistiques et aux graphiques.
- Démonstration illustrant notamment Jett, Reyna, Sage, Omen, Clove et Cypher.
- Indicateur de navigation glissant vers l’onglet actif.
- Animations courtes pour les icônes, pages, boutons, fenêtres et cartes de parties.
- Effets de survol et transitions des détails de match.
- Respect de la réduction des mouvements du système.
- Conservation du chronomètre et des données pendant la navigation.

## Version 2.7 — rapports détaillés et Score AimRoutine

### Une lecture plus complète des parties

- Présentation des joueurs par équipes, inspirée de la lisibilité des rapports Valorant Tracker.
- Portraits d’agents et rangs fournis par les fichiers importés.
- Tableau des joueurs triable.
- Fiche du joueur sélectionné.
- Chronologie des manches et consultation des événements disponibles.
- Vue agrandie, navigation au clavier et fermeture avec Échap.
- Cinq onglets fonctionnels : **Tableau des scores, Performance, Économie, Manches et Duels**.
- Affichage des mesures disponibles : ACS, K/D/A, différence kills/deaths, ADR, écart de dégâts, Headshot %, KAST, premiers kills, premières morts et manches à plusieurs kills.
- Données manquantes signalées comme indisponibles.

### Score AimRoutine / Score AR

- Ajout d’une note indépendante de **0 à 1 000**.
- Calcul local fondé sur quatre composantes de même poids : ACS, KAST, écart de dégâts par manche et proportion de manches gagnées.
- Paliers : S à partir de 800, A de 600, B de 400, C de 200 et D en dessous.
- Formule et conventions consultables dans l’application.
- Note affichée dans le résumé des parties et le graphique de progression.
- Calcul réservé aux modes pris en charge — Compétitif, Non classé et Vélocité — avec données suffisantes.
- Le Score AimRoutine est distinct du Tracker Score de Tracker.gg ; aucune équivalence statistique n’est revendiquée.

### Imports et qualité des calculs

- Conservation des détails des joueurs, équipes, manches, événements et données économiques.
- Compatibilité avec les anciennes parties déjà enregistrées.
- Enrichissement d’un match existant lors d’une réimportation plus complète et compatible.
- Refus des contradictions et conservation des données existantes lorsqu’un fichier est moins complet.
- Renforcement des contrôles sur les dégâts adverses, événements répétés et échanges utilisés pour le KAST.
- Convention de trade de cinq secondes indiquée dans les explications.
- Nouvelle démonstration comprenant huit parties fictives de dix joueurs et vingt-quatre manches chacune.

## Version 2.8 — catalogue complet d’agents et icônes de rang

### Filtre Agent joué corrigé

- Affichage des 30 agents du catalogue même s’ils n’apparaissent dans aucune partie importée.
- Nombre de parties indiqué à côté de chaque agent selon les filtres actifs.
- Sélection possible d’un agent à zéro partie, avec un historique vide explicite.
- Conservation de l’accès aux agents futurs inconnus s’ils sont présents dans un fichier importé.

### Rangs illustrés

- Icônes distinctes de Fer 1 à Immortel 3, puis Radiant : 25 rangs et divisions.
- Ajout d’une illustration neutre pour le statut non classé.
- Boutons illustrés des divisions 1, 2 et 3, synchronisés avec les sélections.
- Icônes dans les profils, le Dashboard, le coach, les consignes, les programmes et les rapports de parties.
- Rang des joueurs et rang moyen d’équipe affichés lorsque les fichiers fournissent des informations utilisables.
- Conservation d’un affichage neutre lorsqu’un rang ou une division est inconnu.
- Ressources livrées localement pour fonctionner hors ligne.

## Version 2.9 — interactions et transitions plus vivantes

### Changements de page

- Arrivée animée du titre de chaque page.
- Apparition progressive des cartes et panneaux.
- Mouvement plus souple du repère de navigation.
- Transitions notamment visibles entre Dashboard, Mon coach et les autres rubriques.
- Navigation immédiatement disponible, y compris pendant une animation.
- Les entrées de page ne se relancent pas à chaque saisie, modification de résultat ou mise à jour du chronomètre.

### Boutons et confort

- Reflet lumineux au survol des boutons principaux et secondaires.
- Léger relief au survol et effet de pression à l’appui.
- Onde discrète lors de l’activation.
- Retours visuels compatibles avec la souris, le tactile et le clavier.
- Conservation d’une seule action par activation.
- Nettoyage des effets terminés et nombre d’effets simultanés limité.
- Désactivation des mouvements avec le réglage système correspondant.
- Vérification des dialogues pendant les transitions et de la continuité du chronomètre entre les pages.

## Version 2.9.1 — nouveau logo et intégration Windows

- Nouveau viseur corail sur fond bleu nuit, assorti à l’identité du logiciel.
- Point central clair et silhouette plus lisible.
- Traits renforcés et centre simplifié dans les petits formats.
- Icône Windows contenant dix tailles : **16, 20, 24, 32, 40, 48, 64, 96, 128 et 256 pixels**.
- Même identité graphique pour l’icône de la fenêtre, la barre des tâches et l’exécutable.
- Remplacement de l’icône Electron intégrée dans l’exécutable portable.
- Métadonnées Windows corrigées : nom du produit, description, nom de fichier et version 2.9.1.
- Identifiant Windows stable pour l’application.
- Vérification des images réellement intégrées dans les ressources de l’exécutable.
- Génération reproductible des icônes depuis leur source vectorielle.

Pour utiliser cette livraison, fermer l’ancienne version et lancer le nouveau dossier portable complet. Un raccourci épinglé vers un ancien dossier peut être remplacé par celui de la nouvelle version.

## Évolution du site de présentation — en parallèle de la version 2.9

- Mise à jour de la [présentation du logiciel sur son site](https://aimroutine-tracker.github.io/product.html).
- Page détaillée consacrée au logiciel actuel et à ses fonctionnalités.
- Présentation en français et en anglais.
- Captures du Dashboard et de Mon coach en fonctionnement avec un profil fictif.
- Galerie avec onglets, navigation au clavier et agrandissement des captures.
- Mise en avant de la version 2.9 depuis l’accueil.
- Présentation des nouvelles animations et du Score AimRoutine.
- Explication distincte des entraînements locaux, des imports, de la démonstration et de l’accès Riot encore nécessaire.
- Vérification de l’affichage à 1 440, 768 et 390 pixels de large.
- Publication GitHub Pages confirmée.

Le site est une présentation et une démonstration web ; cette mise à jour n’y a pas ajouté de téléchargement public du logiciel.

## Fiabilité et vérifications au fil des versions

- Validation des valeurs, dates, pourcentages et durées avant sauvegarde ou import.
- Prévention des doublons et traitement explicite des données manquantes.
- Conservation de l’historique lors des changements de programmes et des migrations prises en charge.
- Séparation des profils locaux et des espaces de démonstration.
- Tests des calculs de statistiques, comparaisons, imports, erreurs et limitations d’API.
- Protection de la clé développeur dans les diagnostics et fichiers produits par l’application.
- **Version 2.9 : 108 tests unitaires et d’intégration, plus six parcours d’interface automatisés réussis.**
- **Version 2.9.1 : compilation vérifiée, contrôle des dix images d’icône intégrées, métadonnées Windows et test de fonctionnement Electron/SQLite sur données isolées.**

## État réel de la version 2.9.1

**Disponible :** profils locaux, routines par rang et routines enregistrées, chronomètre, saisie de résultats, statistiques, calendrier, bilans, sauvegardes, imports locaux, démonstration et rapports de parties selon les données fournies.

**Accès Riot de production toujours nécessaire :** Riot Sign On et récupération automatique officielle de l’historique des parties. Le module de production reste désactivé. Les équipes Premier, leaderboards et distributions globales de rang n’ont pas été ajoutés comme services de récupération automatique.

Les résultats des aim trainers restent saisis manuellement ou importés depuis des fichiers compatibles. Les chemins des logiciels peuvent être mémorisés ; le lancement des logiciels depuis les routines et le mini-chronomètre indépendant faisaient partie des améliorations proposées, pas des fonctions livrées dans cet historique.

## Sources de cet historique

- Guides et sources conservés de la première génération, dont le build 1.1.0.
- Application archivée 2.0.0, scripts de développement 2.1.0, guides et sources des versions 2.2 à 2.9.1.
- README actuel, documentation des résultats et documentation de l’intégration Riot.
- Rapports de vérification des livraisons et confirmation de publication du site.

Les dates de chaque ancienne livraison ne sont pas ajoutées lorsqu’elles ne sont pas explicitement documentées. La présente note décrit l’évolution du logiciel jusqu’à la **2.9.1** et n’annonce aucune fonction future comme disponible.

La première génération est documentée par le build 1.1.0 ; aucune version 1.0 autonome n’est présentée comme une livraison vérifiée. Le numéro 2.1.0 est confirmé par les scripts de développement conservés, même si aucun dossier portable distinct de cette version n’est conservé.