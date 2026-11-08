# Sources de comparaison AimRoutine V3

Les quatre images originales du propriétaire sont les références visuelles obligatoires.

Placez les **PNG originaux sans réencodage ni modification** dans ce dossier sous les noms :
`home.png`, `routines.png`, `progress.png`, `account.png`.

Les quatre fichiers mesurent **1672 × 941 px** et leur SHA-256 est indiqué dans `manifest.json`. Les tests doivent refuser toute image aux mauvais octets ou aux mauvaises dimensions.

La comparaison fonctionne déjà hors ligne sur les images originales mises à disposition par le propriétaire. Les PNG binaires ne sont **pas encore présents dans le dépôt**, donc l'analyse de pixels originaux en CI est explicitement indiquée comme NON EXÉCUTÉE. Les différences entre `main` et la branche ne remplacent pas la comparaison aux références.

Pour exécuter la validation dans GitHub Actions, intégrer ces quatre fichiers à une copie contrôlée du dépôt, puis relancer le workflow de preuves visuelles. Aucun chiffre de maquette ne doit remplacer les vraies données personnelles.
