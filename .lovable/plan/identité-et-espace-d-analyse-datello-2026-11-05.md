# Identité et espace d’analyse Datello

## Résultat
- Renommer l’application et le projet « Datello », avec le slogan « Vos données, enfin claires. ».
- Installer les composants logo et mascotte, les textes bilingues et le favicon exactement tels que fournis.
- Appliquer les couleurs et les polices fournies, en conservant l’accueil et ses sections.
- Refaire l’espace d’analyse : barre latérale de 260 px, conversation centrée, réponses avec mascotte, saisie en bas et menu mobile.
- Ajouter le sélecteur FR/EN pour les textes des moments, les suggestions cliquables et les états d’import, d’analyse, de résultat et d’erreur.
- Rendre utilisables « Mes fichiers », « Tableaux de bord » et les actions des réponses, en réutilisant les fichiers et analyses enregistrés. Ne pas afficher de résultats inventés ni de faux états de nettoyage.

## Conservation
- Garder les offres, limites, accès administrateur, historique, imports existants, graphiques et exports PDF/Excel.
- Garder l’adresse actuelle du site : le changement de nom ne modifie pas son URL.
- Conserver intégralement les tracés SVG et le contenu de messages.ts fournis.

## Adaptations techniques nécessaires
- Utiliser src/styles.css et Tailwind v4, sans tailwind.config ni directives v3.
- Charger Sora et Inter dans l’en-tête de l’application, plutôt que par l’import CSS distant fourni, qui casserait la compilation.
- Garder un espacement des lettres nul pour respecter les contraintes d’affichage du projet.
- Brancher les étapes sur le traitement réel : ne pas déclarer les calculs terminés avant la fin de la réponse.
- Les états de question ambiguë et de données manquantes ne s’affichent que lorsqu’ils sont identifiés, sans bloquer arbitrairement une question valide.
- Actualiser les titres et descriptions des pages et retirer les anciens aperçus de partage portant l’ancien logo.

## Vérification
- Vérifier les composants fournis à l’identique, les tests existants et les nouveaux états utiles.
- Contrôler les pages sur ordinateur et mobile, le sélecteur de langue, les suggestions, le menu, un import Excel/CSV et une analyse avec une session réelle.