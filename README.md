# Valombre — jeu de rôle familial

Portail web de jeu de rôle pour initier les enfants : comptes, héros créés aux dés, fiches sauvegardées,
PNJ lus à voix haute, réponses à choix, exploration libre « en laisse », quêtes secondaires,
campagnes déblocables.

## Lancer en local

```bash
nvm use          # Node 22.13+ obligatoire (module natif node:sqlite)
npm install
npm run dev      # http://localhost:3000
```

La base SQLite est créée toute seule dans `data/valombre.db` au premier lancement.

## Où est quoi

| Dossier | Contenu |
| --- | --- |
| `campaigns/<id>/` | Une campagne = `bible.ts` (PNJ, objets, quêtes, zones), scènes par chapitre, `media.ts` (prompts). |
| `campaigns/commun/media.ts` | Guide de style + médias communs (bruitages d’interface, portraits de classe). |
| `campaigns/index.ts` | Registre : ajouter une campagne ici. |
| `engine/` | Moteur pur (règles, dés, conditions, effets, laisse/rappels, combat) + validateur. |
| `components/GameScreen.tsx` | Écran de jeu (scène, voix, son, choix, combat, journal, sac). |
| `lib/` | Base SQLite, comptes/sessions, sauvegardes, audio, voix. |
| `public/medias/<collection>/` | Les fichiers générés, nommés par leur identifiant. |

## Les médias (images, vidéos, sons)

1. Ouvrir **/atelier** (connecté).
2. Copier un prompt (le guide de style est ajouté automatiquement), ou tout exporter en `.md`.
3. Générer le fichier avec l’IA de son choix.
4. Le déposer dans `public/medias/<collection>/<identifiant>.<ext>`
   (images `webp/jpg/png`, vidéos `mp4/webm`, sons `mp3/ogg`).

Musiques et ambiances : plusieurs versions possibles (`mus-route.mp3`, `mus-route-2.mp3`, `mus-route-3.mp3`…), jouées à la suite avec un fondu.
Génération avec ElevenLabs : `npm run voix -- son mus-route --essais 2`, puis `npm run voix -- garder mus-route 1 2`.

Il n’y a rien à coder : le fichier est détecté au prochain chargement de page. Une vidéo remplace l’image fixe de la même scène.
Tant qu’un fichier manque, le jeu affiche un fond de brume et reste silencieux sur cette couche.

## Les voix

Chaque réplique du scénario a un identifiant stable (`intro-1`, `puits-choix2-reussite`, `loup-victoire`…),
calculé à partir du scénario par `engine/voices.ts`.

1. Ouvrir **/atelier/voix** : une fiche de casting par personnage, et la liste de ses répliques.
2. Créer une voix par personnage dans l’outil de son choix (ElevenLabs…) à partir de sa fiche.
3. Générer chaque réplique (export `.md` ou tableau `.csv` pour travailler par lot).
4. Déposer les fichiers dans `public/medias/<campagne>/voix/<identifiant>.mp3` (ou `ogg/m4a/wav`).

**Génération automatique avec ElevenLabs** (clé dans `.env.local`, voir `.env.example`) :

```bash
npm run voix -- etat                 # crédits restants, voix créées, répliques à faire
npm run voix -- casting              # 3 essais de voix par personnage → data/voix-essais/
npm run voix -- choisir pff 2        # garde l’essai 2 comme voix de Pff
npm run voix -- generer --max 10     # un premier essai sur 10 répliques
npm run voix -- generer              # tout le reste (ce qui existe déjà n’est pas refait)
```

Le script note dans `voix/manifest.json` le texte et la voix de chaque enregistrement : une réplique dont le texte a changé,
ou dont le personnage a changé de voix, est refaite au prochain `generer` (et ne sera plus jouée d’ici là).
Pour refaire une réplique qui sonne mal : `npm run voix -- generer --refaire intro-3`.
Réglages (modèle, stabilité, style, réglages par personnage) : `campaigns/<campagne>/voix.json`.

En jeu, l’enregistrement est joué s’il existe. Sinon la réplique reste écrite, ou est lue par la
voix du navigateur si l’option est cochée dans les réglages (désactivée par défaut).
Commandes : ⏸ Pause / ▶ Reprendre (ou barre d’espace), ⏭ Réplique suivante, ⏹ Arrêter, et ▶ sur une ligne pour relire à partir d’elle.

⚠ Une fois les voix enregistrées : insérer ou supprimer une ligne au milieu d’une scène décale les numéros
des lignes suivantes de cette scène (il faut renommer ou régénérer leurs fichiers), et retoucher un texte
garde l’ancien enregistrement. Ajouter une ligne en fin de scène ne décale rien.

## Écrire une nouvelle campagne

D’abord les règles du jeu : `docs/conventions.md` (scénario, voix, musique, ambiances). Chantiers en cours : `docs/a-faire.md`.

Voir `docs/ecrire-une-campagne.md`. En résumé : copier la structure de `brumes-de-valombre`,
l’ajouter dans `campaigns/index.ts`, passer `playable: true`. L’Atelier signale toute incohérence
(scène cible inconnue, objet mal orthographié, scène jamais atteinte…).

## Déblocage des campagnes

- `unlock: { type: 'default' }` : ouverte à tous.
- `unlock: { type: 'after', campaign: 'x', codes: [...] }` : se débloque en terminant `x`, ou avec un code.
- `unlock: { type: 'code', codes: [...] }` : uniquement par code (saisi sur le portail).

Code actuel de « La Lanterne d’Aube » : `AUBE-DE-SEL`.

## Mise en ligne

SQLite a besoin d’un disque persistant (VPS, Fly.io avec volume, Railway…). Vercel ou Scalingo n’en ont pas :
il faudrait alors remplacer `lib/db.ts` + `lib/repo.ts` par Postgres ou Turso. Les signatures de `lib/repo.ts` sont faites pour ça.
