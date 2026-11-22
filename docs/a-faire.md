# Valombre — à faire

Suivi interne. Les règles du jeu sont dans `conventions.md`.

## En cours

- [x] Toutes les musiques générées le 2026-11-22 (≈ 2 600 crédits par morceau de 2 min, soit ~2 % du forfait Creator).
      Une seule version pour forêt, sanctuaire, aube, fête et boss : en faire une deuxième si on les entend trop.
- [ ] Essai de mus-mystere sans le mode instrumental (le « ooh » de berceuse lointain demandé dans le prompt).
- [ ] Ambiances des chapitres 2 et 3 (forêt au matin, rivière, clairière, sanctuaire, fête) dans le nouvel esprit : fond discret, pas d’eau de mauvaise qualité.

- [x] Zone « Déposer le fichier » dans l’atelier (2026-11-22). ⚠ En production (`next start`), un fichier ajouté à `public/` après le build n’est pas servi : prévoir une route de service des médias avant la mise en ligne.
- [x] Lumières vivantes (2026-11-22). Reste : ajuster x/y de chaque lumière quand les illustrations seront faites.

- [ ] Images (ChatGPT, à la main) : prompts prêts dans `docs/images-chatgpt.md`, avec la composition calée sur les lumières.
      Après dépôt : Claude regarde les images et recale les lumières (x/y dans `LIGHTS`).

## Deuxième partie (plus tard)

- [ ] **Voile de brume entre les scènes** : transition en WebGL, fumée qui monte, recouvre l’écran et se dissipe
      sur la scène suivante. Aussi pour les moments forts (vision du puits, réveil de la Dame Grise).
- [ ] **Arrivée sur le site** : illustration de village médiéval-fantastique en plusieurs plans (ciel, montagnes,
      village, brume au premier plan), travelling lent en parallaxe ou courte vidéo en boucle.
      Prompts d’images à écrire en calques séparés dans l’atelier.
- [ ] Dés connectés en Bluetooth (GoDice ou Pixels, Chrome/Edge uniquement) ; en attendant, un pavé numérique Bluetooth suffit (touches 1-9 et espace).
- [ ] Campagne 2 « La Lanterne d’Aube » : à écrire selon `conventions.md`.
- [ ] Mise en ligne (SQLite → disque persistant, ou Postgres/Turso).
