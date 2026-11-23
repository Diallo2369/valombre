# Conventions de Valombre

Les règles du jeu, à respecter pour toute campagne (scénario, voix, musique, ambiances, images).
Elles viennent des parties de test en famille. Le format technique d’une scène est dans `ecrire-une-campagne.md`.

Ce que l’atelier vérifie automatiquement est marqué **[vérifié]**. Le reste est à relire à la main.

---

## 1. Le scénario

### La règle d’or : chaque étape est une scène à part entière, avec ses digressions

Quand on écrit une étape de l’histoire, on n’écrit jamais un couloir. On écrit **une petite scène, avec un ou deux
chemins de traverse** : un détail à fouiller, quelqu’un à qui parler, un raccourci risqué, une façon de faire autrement.
C’est une règle tacite : les joueurs ne doivent jamais avoir l’impression de suivre des rails.

- Une digression **rapporte toujours quelque chose** : un indice, un objet, un allié, un souvenir qui resservira, ou au moins un peu de PV ou d’XP.
- Elle **revient vers l’intrigue principale** d’elle-même, sans « retour à la case départ ».

### Les mystères ne tombent jamais à plat

Tout ce qui intrigue (une berceuse, une lueur, une pierre gravée, des yeux dans la brume…) est un **fil** :

1. **On le lance** : une réplique, souvent pour poser une question sans y répondre.
2. **On le tire au moins une fois** pendant le chapitre : un personnage en parle, une vision, un objet.
3. **On le referme**, ou on le relance plus loin : une réplique qui dit « c’est exactement ce que vous aviez vu… ».

Dans le code, un fil est un drapeau (`setFlag`) relu plus tard par une condition (`if: [{ flag }]`).
**[vérifié]** Un drapeau posé mais jamais relu est signalé comme « fil abandonné ».
Un mystère qui n’existe que dans le texte, sans drapeau, ne peut pas être vérifié : c’est le cas à surveiller.

Exemple de la campagne 1, la berceuse : la place (on l’entend), le puits (la vision), Ossian (il l’explique),
Brac (son frère l’a entendue), les pierres dressées (même lanterne), le sanctuaire (le temple de la vision), la Dame Grise (elle vous reconnaît).

### On sait toujours où l’on est

On ne change jamais de lieu sans le raconter. Entre deux lieux, une phrase nous fait **traverser l’espace**
et nous plonge dans l’ambiance avant la scène suivante : « Vous saluez Ossian et quittez l’auberge.
Dehors, il pleut toujours, et la nuit est profonde. »

Chaque scène appartient à un **lieu** physique (`place` : la salle commune, l’écurie, le grenier, la roulotte, le puits…),
déclaré dans `PLACES` (`bible.ts`). Quand on change de lieu, le Conteur enchaîne, dans l’ordre :

1. **La sortie** du lieu quitté (`leave`), qui peut dépendre de la destination : depuis le grenier,
   « Vous redescendez l’échelle » vers l’écurie, mais « … et ressortez de l’écurie sous la pluie » vers la cour.
2. **Le trajet** si l’on change de zone (`TRANSITIONS`, ex. `'auberge>village'`) : la porte, la pluie, la nuit, la Grise.
3. **L’arrivée** dans le nouveau lieu (`arrive`), qui peut dépendre de la provenance (dans la cuisine : par la porte
   battante depuis la salle, par la trappe depuis la cave).

- **Un raccord raconte le déplacement, jamais ce qu’on va découvrir.** L’arrivée au puits dit qu’on traverse la place
  jusqu’au puits ; c’est la scène qui dit ce qu’on voit au fond. Sinon : contradictions (« eau noire » puis « lueur
  argentée ») et redites (la bâche, les volets, le feu). On relit toujours le raccord **suivi de la première ligne de la scène**.
- `>` vise « vers une autre zone » (sortie) ou « depuis une autre zone » (arrivée) : depuis la cuisine vers la cour,
  on ne « retrouve » pas la grande salle juste avant d’en sortir.
- Si le choix raconte déjà le déplacement (`text`), il remplace la sortie et le trajet ; l’arrivée reste.
- `''` veut dire « rien à dire pour ce passage » (la scène ou le choix le raconte déjà).
- Dans un même lieu (une conversation), on ne dit rien.
- Une scène qui raconte elle-même comment on y arrive (réveil, départ à l’aube) porte `transition: false`.
- Un rappel (cloche, tempête) interrompt le trajet : pas de phrase de trajet, l’événement suffit.
- **[vérifié]** Tout changement de lieu ou de zone sans phrase est une erreur dans l’atelier.

### Les choix

- **Toujours au moins deux choix.** **[vérifié]** Dans le scénario et dans 300 parties simulées.
  Pour un moment linéaire, on propose une variante qui compte : se reposer (`heal`), saluer quelqu’un (`xp`), passer en sautant (un test).
- **Pas de « Retourner à … ».** Après une conversation, on doit pouvoir parler à quelqu’un d’autre ou aller ailleurs :
  `next: 'salle-commune'` (ou `'place'`, `'cour'`…). Les choix de ce lieu s’ajoutent sous « Ou bien, ailleurs : ».
- **Un choix qui décrit une action raconte ce qui se passe.** « Se retourner vers la brume », « Saluer le héron » :
  le Conteur (ou un personnage, `who`) dit le résultat dans `text`, lu à voix haute. Une bulle (`message`) ne suffit pas.
  **[vérifié]** Et si l’action est une vraie curiosité, c’est **une scène** (une digression), pas une phrase :
  se retourner vers la brume fait réapparaître les yeux bleus, et le geste qu’on choisit compte pour la suite.
- **Un test de dé dit ce qu’il faut faire.** L’écran affiche « il faut 5 ou plus » : la difficulté doit être réaliste
  (facile 5, moyen 7, difficile 9 ; dé + caractéristique).
- **Un achat se raconte.** Qui paie (la bourse commune du groupe), ce qu’on obtient, où ça va (le sac du groupe),
  dans une petite scène dédiée.

### La liberté en laisse

- Les zones autour du pivot ont une **laisse** : au bout de quelques scènes, un rappel ramène le groupe.
- **Un rappel n’est jamais un ordre.** Il propose toujours au moins une façon de **désobéir** (fuir dans la forêt,
  faire la sourde oreille, s’abriter ailleurs). Désobéir a un prix (la nuit, la brume, un risque) et **ouvre une scène**
  qui récompense le culot (un indice, une rencontre). Le scénario finit par ramener le groupe, mais par un autre chemin.
- **Un rappel ne coupe jamais une conversation.** Il ne peut survenir qu’au moment où l’on change de lieu
  (en sortant de chez Corvine, pas pendant qu’on lui parle). Un abri (la hutte) porte `noRecall`.
- Un personnage qu’on a convaincu peut laisser partir le groupe (Brac devient un allié après l’histoire de la berceuse).

### Pas de redite

- **[automatique]** Une réplique déjà entendue n’est pas relue en revenant dans une scène (elle reste affichée, plus pâle).
- On ne fait pas revenir le groupe sur la même scène juste après l’avoir lue : on préfère une scène de réponse.
- Une réplique de retour (`firstVisit: false`) est courte : « Ah, vous revoilà. »

### Le ton

Conte de veillée sombre, jamais cruel. Personne ne meurt. Les « monstres » ont une raison d’agir et peuvent être apaisés.
On peut avoir un peu peur, jamais être dégoûté. Le mystère est le moteur : on suggère, on montre à moitié.

---

### Les combats : le plateau

- Un **plateau d’hexagones** (7 × 6) : les créatures en haut, les aventuriers en bas, chacun en jeton rond
  (image du monstre, portrait du héros). Ceux qui combattent au contact (guerrier, cœur-sauvage) commencent devant.
- Le **tour d’un héros** : sa carte s’affiche en bas (portrait, PV, armure, mouvement, états, passifs, actions).
  1. Il peut **se déplacer** : les cases atteignables s’allument (points de mouvement de sa classe).
  2. Il **choisit une action** : si plusieurs cibles sont à portée, elles brillent et on touche celle qu’on vise.
  3. Il lance le dé, avec le score à atteindre affiché (le dé n’est pas demandé pour une action sans dé).
- Le **tour des monstres** : le poison les ronge, puis chacune **annonce sa cible** (flèche + phrase :
  « Le brumelin grincheux semble se diriger vers Rose Violette »), ou le sort qu’elle va lancer. Le guerrier peut
  alors **se jeter devant** un compagnon visé (Intervention, une fois par tour). Puis chaque créature avance et
  frappe si elle atteint sa cible.
- Cible d’une créature : celui qui l’a provoquée (Moquerie), sinon la plus forte **menace** (voir plus bas).
- Chaque coup se **voit et s’entend** : le jeton tremble, sa barre de vie se vide et un gros chiffre de dégâts surgit, un sort a son
  propre son, un coup raté fend l’air ; la phrase d’action s’affiche au milieu du plateau.
- Le récit des derniers coups reste affiché (dé + caractéristique = total, touché ou raté, riposte).
- Un combat a toujours une autre issue possible que la force (parlementer, fuir, un objet…), et on ne meurt jamais.

### Écrire un combat

- `enemy` : le nom du groupe (« la bande de brumelins »), la difficulté, l’attaque racontée (lue par le Conteur
  une fois par tour des monstres), les valeurs par défaut (dégâts, mouvement, portée, mal transmis).
- `foes` : les créatures du groupe, chacune avec ses cœurs (`hearts` : 1 cœur = 2 PV en jeu). Sans `foes`, une seule créature.
- `afflict` : un mal laissé par les coups (brûlure, froid de brume…), avec une probabilité ; le barde l’enlève.
- Capacités des gros monstres (sur `enemy`, ou sur une créature de `foes`) :
  - `cleave` : coup balayé, sa (première) attaque frappe aussi les autres héros collés à elle ;
  - `attacks` : nombre d’attaques par tour (le Loup : 2 ; la même cible, ou le plus proche si elle tombe) ;
  - `stun` : gros coup, chance (0-1) qu’un coup qui porte (même sur l’armure) assomme le héros, qui passe son prochain tour ;
  - `spell` : un sort (`FoeSpell` : sommeil, trait à distance, souffle sur une zone, cri de ralliement), 1 tour sur `every`.
    La créature l’annonce à la fin de son attaque (« prend une grande inspiration… », zone en rouge pour un souffle), et
    il part à son tour suivant, à la place de son attaque. Bâillonnée, assommée, prise au filet ou endormie entre-temps : il s’éteint.
- Les PV écrits sont multipliés par `SOLID` (1,4, engine.ts) : les monstres encaissent sans qu’un gros coup les abatte d’un coup.
- Une créature seule est écrite **pour 4 héros** : le moteur ajuste ses PV et la force de ses coups à la taille du
  groupe (`foeScale` dans engine.ts).
- Une bande (`foes`) est écrite **pour une table de 6** : avec moins de héros, on ne garde que les premières de la
  liste (4 sur 6 à 4 héros) ; mettre les plus importantes en tête. Ses PV totaux suivent la même règle.
- Réglage visé (simulation par classe, 4 héros) : ~15 % de PV perdus contre Pff, ~25 % au rappel des brumelins, ~40 %
  à la clairière ; contre le Loup de Cendre (2 attaques dont un coup balayé, gros coups qui assomment, Souffle de braise),
  ~40 % de PV perdus, un héros épuisé, 5 à 7 tours, 8 à 9 victoires sur 10.
  Par classe (dégâts par combat, PV restants à la fin) : cœur-sauvage ~14, ~58 %, le plus souvent épuisé ; guerrier ~13
  (dont Œil pour œil), ~60 %, 2 à 3 fois plus de coups reçus ; rôdeur ~13 et mage ~12.5, ~82 % ; le barde soigne.

### Le tutoriel du premier combat

- `components/CombatTutorial.tsx` : au premier combat (n’importe lequel) tant que le compte ne l’a pas terminé ou passé
  (table `user_flags`, drapeau `tutoriel-combat`). Projecteur sur l’élément expliqué (`data-tuto="…"` dans CombatPanel),
  bulle entre deux animations ; il attend que le joueur se déplace, choisisse et vise. Le héros actif ressort (halo qui pulse).
- « Revoir le tutoriel du combat » dans les réglages ; en test (atelier), rien n’est retenu sur le compte.

### La menace (l’aggro)

- Chaque créature retient la menace de chaque héros (`FoeState.threat`) : 1 par PV infligé (×2 sur un coup critique),
  +2 pour un contrôle (assommer, filet, berceuse, aveugler, poison, bâillon), la moitié des PV soignés ou du bouclier
  posé (sur toutes les créatures). La classe multiplie la menace (`ClassDef.threat`) : le guerrier ×1,5 (son Aura, et il en a un peu dès le début), le cœur-sauvage ×1,7 (sa fureur se voit de loin : il fait le plus mal, et finit le plus entamé).
- Elle attaque la plus forte menace parmi les héros qu’elle peut atteindre ce tour-ci (sinon la plus forte tout court,
  sinon le plus proche). La menace baisse d’un quart à chaque tour.
- Moquerie : la créature est provoquée (elle attaque le moqueur, en tête de sa menace) et enragée : ce coup fait +25 %,
  +50 %, +75 % ou +100 % (au hasard).
- Intervention (réaction du guerrier, pendant le tour des monstres, une fois par tour) : il se jette devant un compagnon
  visé à 2 cases au plus et prend ses coups jusqu’à son prochain tour, avec 1 dégât de moins. Plus de jet « reprendre l’aggro ».

### Les classes et le combat

| Classe | Profil | Actions | Passifs |
|---|---|---|---|
| Guerrier·ère (le tank) | +1 Force, +2 Endurance, +3 PV, 🛡️ 4, 👣 2, menace ×1,5 | Frapper · Coup assommant (2 PV + la créature passe son tour, 1 tour sur 3) · Taillade (jusqu’à 3 créatures au contact, 1 tour sur 3) · Onde de choc (onde de poussière en cône : la créature collée et celles juste derrière, 3 PV et repoussées, 1 tour sur 3) · Cri de rage (ultime, 1 tour sur 4 : toutes les créatures l’attaquent, il pare 9 coups sur 10 jusqu’à son tour) | Aura de bataille (menace ×1,5) · Œil pour œil (coup reçu au contact : 2 fois sur 3, 2 PV renvoyés, 1 chance sur 4 d’assommer) · Intervention (réaction, voir la menace) |
| Cœur-sauvage (corps à corps) | +2 Agilité, +1 Initiative, aucune armure, 👣 4, menace ×1,7 | Double attaque (3 + 2 PV) · Bond sauvage (saute sur une créature jusqu’à 3 cases, 2 + 2 PV, 1 tour sur 2) · Fureur de l’ours (2 + 2 PV et +2 PV pour lui, 1 tour sur 2) · Tourbillon (toutes les créatures au contact : 2 + 2 PV, 1 tour sur 3) · Moquerie (une créature l’attaquera, enragée : +25 à +100 % de dégâts ; 1 tour sur 2) | Ambidextrie (deux coups) · Folie vengeresse (après un coup reçu : prochaine attaque +50 %, arrondi au-dessus ; ce n’est pas un critique) · Cœur battant (chaque créature touchée aux haches : 1 chance sur 3 de reprendre 1 PV)  |
| Rôdeur·se (distance) | +1 Agilité, +1 Force, +2 Initiative, +1 PV, 🛡️ 1, 👣 3 | Tir à l’arc (3 PV, portée 5) · Flèche visée (+2 de difficulté, critique : 6 PV, bâillonne 2 tours) · Salve (3 cibles, 3 PV chacune, 1 tour sur 3) · Filet (2 tours bloquée, 1 tour sur 3) · Flèche empoisonnée (3 PV + 1 PV par tour pendant 3 tours, 1 tour sur 3) | Pointes trempées (chaque flèche qui touche : 1 chance sur 4 d’aveugler, 1 sur 4 de bâillonner) · Seconde chance hors combat |
| Mage (magie des runes) | +2 Esprit, 👣 2 | Projectiles runiques (2 PV) · Rune d’éclat (sans dé, 4 PV contre la brume, 1 tour sur 3) · Rune ricochet (une créature puis 2 rebonds à 2 cases au plus, 2 PV chacune, 1 tour sur 3) · Orbe runique (une créature et ses voisines, 1 tour sur 3) · Déflagration runique (créatures au contact : 2 PV et repoussées d’une case, 1 tour sur 2) | — |
| Barde | +1 Charme, +1 Esprit, 👣 3 | Aucun sort de dégâts : Air de guérison (+5 PV à un compagnon ou à soi, 1 tour sur 2) · Bouclier de lune (absorbe 2 dégâts, 1 tour sur 3) · Berceuse (passe son tour, 1 tour sur 3) · Chant de courage (+2 PV au groupe et enlève poison, brûlure, froid, 1 tour sur 4) · Ronde enchantée (un mur de notes autour d’une case choisie et des 6 cases voisines, zone visible avant de valider jusqu’à son prochain tour : rien ne le traverse, ni pas, ni coups, ni sorts, ni soins ; 1 tour sur 4) | — |

- **Endurance** : 5ᵉ caractéristique. PV = 6 + Endurance + bonus de classe (+2 par niveau). Les héros créés avant
  l’Endurance reçoivent leur Force à la place (`withStats`), pour garder les mêmes PV ; ceux créés avant l’Initiative
  reçoivent leur Agilité + l’ancien bonus de classe, pour garder le même ordre de jeu.
- **Armure** : des points qui prennent les coups avant les PV, réparés au début de chaque combat.
- **Initiative** : 6ᵉ caractéristique, tirée au dé comme les autres (+1 cœur-sauvage, +2 rôdeur). En combat : dé + Initiative (les créatures : dé + 2/4/5 selon la difficulté). On joue dans cet
  ordre ; les créatures agissent ensemble à leur place dans la file. La frise des tours reste affichée.
- **Dégâts** en PV : un coup normal = 2 PV (une flèche : 3), les haches du cœur-sauvage = 3 + 2 PV (2 + 2 en Tourbillon, Bond, Fureur), un critique double tout.
- **Cinq actions par classe** (les passifs en plus ; le guerrier : quatre, plus l’Intervention en réaction) : que chaque joueur ait autant de choses à faire.
- **KO** : à 0 PV, le héros est KO (couché sur sa case, il ne joue plus). Air de guérison le relève ; à la fin du combat,
  les héros KO se relèvent avec 1 PV. Le Bouclier de lune absorbe aussi les maux (poison, brûlure, froid) et s’ajoute
  aux PV (la barre s’allonge). Barde : Air de guérison relève un KO, Mélodie apaisante (passif : +1 PV à lui et ses
  compagnons à 2 cases, au début de son tour).
- **Salve, Taillade** : on choisit ses cibles (jusqu’à 3), puis on tire.
- **Aveuglée** : la créature rate un coup sur deux (ses sorts partent quand même). **Bâillonnée** : pas de sort.
- **Délais** : les coups puissants se relancent « 1 tour sur 3 » (ou 4) ; les autres sont à volonté.
- Durée visée (simulation, héros moyens) : 2 à 4 tours de table pour un petit combat, 5 à 7 pour le Loup ; jamais de mort.
- Le code : `engine/board.ts` (plateau), `engine/rules.ts` (`CLASSES`, `ABILITIES`), `engine/engine.ts` (combat).

### Les jonctions entre scènes

- La nouvelle image arrive en fondu, puis **une respiration de 1,2 s** avant la première réplique (`SETTLE_MS`).
- Le texte se **dévoile réplique par réplique**, au rythme de la voix (ou du temps de lecture s’il n’y a pas d’enregistrement).
- Les choix, le combat ou la fin n’apparaissent **qu’une fois le récit terminé** ; « Tout afficher » permet d’aller plus vite.
- Le combat se joue **tour par tour**, avec un bandeau qui surgit (fond flouté) : « Combat ! », « Au tour de Faucon ! »,
  « Au tour des brumelins ! ». Chaque étape dure assez longtemps pour être lue par un enfant (≈ 2 s par bandeau,
  3 s pour l’attaque du monstre). Pas d’effets « gadget » (les griffes dessinées ont été retirées : ça faisait cheap).

## 2. Les voix

- **Tout est enregistré**, narration comprise : personne ne lit à voix haute autour de la table.
- Une voix par personnage, choisie dans la bibliothèque ElevenLabs (`npm run voix -- adopter <pnj> <n>`)
  ou créée d’après la fiche `casting` du personnage. Le Conteur : « Clement – Calm and Neutral », lecture sobre.
- **Un souffle de 0,7 s** entre deux répliques (`BREATH_MS` dans `lib/voice.ts`).
- Les textes s’écrivent pour l’oreille : phrases courtes, pas de parenthèses, les guillemets « » ne se prononcent pas.
- **[automatique]** Une réplique dont le texte change est réenregistrée au prochain `npm run voix -- generer`
  (le manifeste garde l’empreinte du texte). Ajouter une ligne **en fin de scène** évite de renuméroter les autres.

## 3. La musique

- **Elle ne tourne pas en continu.** En arrivant dans un lieu, elle attend 15 à 30 s, joue un morceau en entier,
  laisse 40 s à 1 min 30 de silence, puis joue la version suivante (`lib/audio.ts`).
- **Moments forts** (combat, final, révélation) : elle démarre tout de suite (`media.musicNow: true`).
- Plusieurs versions par morceau : `mus-x.mp3`, `mus-x-2.mp3`… jouées à tour de rôle.
- Changer de scène avec la même musique ne la coupe pas et ne la relance pas : elle continue.
- Une autre musique arrive en **fondu enchaîné léger** (3 s), tout de suite si une musique jouait (sinon elle attend, comme à l’arrivée).
- Revenir à une musique déjà entendue la fait **reprendre où elle s’était arrêtée**, pas au début.
- **Un épisode sans musique** (ou dont le morceau n’est pas encore généré) fait s’éteindre la musique en fondu de 3 s.
  Le silence fait partie de la mise en scène : il reste l’ambiance.
- Musiques instrumentales, mixées douces pour passer sous une voix (le guide de style de `media.ts` le précise).

## 4. Les ambiances

- **Toujours présentes**, en boucle, sans silence : c’est le fond sonore permanent (pluie, taverne, vent…).
- Une par lieu, boucle parfaite de 30 s générée avec `npm run voix -- son amb-x --modele eleven_text_to_sound_v3`,
  deux versions qui alternent (`amb-x.mp3`, `amb-x-2.mp3`) pour qu’on n’entende pas la boucle.
- **Un fond, pas une liste d’événements.** Deux ou trois sons continus au plus (pluie fine, feu qui crépite, souffle),
  très bas, et dire ce qu’on ne veut pas : pas d’animaux, pas de pas, pas de son qui ressort.
  Le prompt de génération s’écrit en anglais (`promptEn` dans `media.ts`), le français reste pour l’atelier.
- **La Grise s’entend** : dehors, tout est étouffé, humide, lointain, comme sous du coton. Mystérieux, jamais effrayant.
- L’auberge est un refuge : feutrée, feu tout près, brouhaha très léger et lointain.
- **Niveau constant** : ni la musique ni l’ambiance ne baissent quand quelqu’un parle (le va-et-vient s’entendait).
  Elles sont simplement réglées assez bas pour passer sous la voix (musique 12 %, ambiance 30 % par défaut).

## 5. Images, vidéos, bruitages

- Prompts dans `campaigns/<campagne>/media.ts`, guide de style commun ajouté automatiquement (page `/atelier`).
- Fichiers dans `public/medias/<collection>/<identifiant>.<ext>` : rien à coder, le jeu les trouve seul.
- Bruitages courts, sans silence au début.

## 6. Les lumières vivantes

- Les images restent fixes ; la vie vient d’une couche de lumière par-dessus (`LIGHTS` dans `media.ts`, une liste par image) :
  `feu` (vacille, braises), `lanterne` (tremble), `magie` (respire, couleur au choix), `brume` (glisse), `eclair` (flash).
- La position (`x`, `y` en % de l’image) se règle **une fois l’illustration générée** : le foyer doit tomber sur la cheminée, la lanterne…
- Pas de GIF : 256 couleurs, des bandes dans les dégradés de brume. Pour un moment clé, une courte vidéo en boucle (`video`).
- **[automatique]** « Réduire les animations » (réglage du système) : la lueur reste, fixe.

## 7. Déposer un fichier

Dans `/atelier`, chaque fiche a une zone « Déposer le fichier » : le fichier glissé est enregistré sous le bon nom,
au bon endroit, et remplace l’ancien. Images faites à la main avec ChatGPT (une seule conversation pour garder le style).

## 8. Avant de livrer une campagne

1. `/atelier` : « ✓ Scénario cohérent » (choix, fils, scènes atteignables, médias).
2. `/atelier/voix` : toutes les répliques ✅, aucune 🔁 à refaire.
3. Une partie en vrai, en famille, et noter tout ce qui coince.
