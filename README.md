# Planning BAFA

Application web statique pour construire le planning d'une session de formation BAFA :

- **BAFA 1** : formation générale, 8 jours
- **BAFA 3** : session d'approfondissement ou de qualification, 6 jours

## Fonctionnalités

- Grille jours × créneaux (matin, après-midi, soirée), avec des créneaux et des horaires modifiables
- Pré-remplissage avec un planning type adapté au BAFA 1 ou au BAFA 3
- Bibliothèque de séquences types (vie collective, apports, activités, réglementation, bilans, veillées…), complétable
- Glisser-déposer des séquences (Ctrl/Alt pour copier), ou ajout avec le bouton ＋ d'une case (fonctionne aussi sur mobile)
- Équipe de formation : chaque séquence est attribuée à des formateur·rices, avec le temps d'intervention de chacun·e
- Récapitulatif : volume horaire par catégorie et nombre de créneaux vides
- Plusieurs plannings enregistrés dans le navigateur (localStorage)
- Impression / PDF en A4 paysage, export agenda `.ics`, export / import `.json`
- Partage par lien : le planning est compressé dans l'URL, sans serveur

Aucune donnée n'est envoyée à un serveur.

## Déploiement sur GitHub Pages

1. Dans le dépôt : **Settings → Pages → Build and deployment → Source : GitHub Actions**.
2. Poussez sur `main` : le workflow `.github/workflows/pages.yml` publie le site.

## Développement local

Aucune dépendance ni étape de build :

```sh
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```
