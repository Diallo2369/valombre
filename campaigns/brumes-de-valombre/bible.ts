import type { Item, Npc, Place, Quest, Zone } from '@/engine/types';

/**
 * BIBLE DE LA CAMPAGNE « Les Brumes de Valombre »
 *
 * L'univers — Valombre est une vallée encaissée entre des montagnes de schiste.
 * Autrefois, la Lanterne d'Aube brillait au sanctuaire du Bois-Noir et tenait la brume
 * (« la Grise ») au fond des ravins. Depuis des siècles, sa flamme a disparu : seul
 * son Cœur, une pierre dorée, y luisait encore. Il y a sept nuits, Gaspard le colporteur
 * a ramassé cette « jolie pierre » pour la vendre. Depuis, la Grise monte chaque soir.
 * La Dame Grise, gardienne du sanctuaire, n'est pas méchante : privée de lumière,
 * elle s'endort et ses feux-follets attirent les enfants pour qu'ils lui tiennent
 * compagnie dans son rêve. Lisette, 10 ans, la fille du meunier, en a suivi un ce soir.
 *
 * Le ton — sombre comme un conte de veillée, jamais cruel. Personne ne meurt.
 * Les monstres ont toujours une raison d'agir et peuvent souvent être apaisés.
 *
 * Structure —
 *   Chapitre 1 (Combeloup, l'auberge du Chaudron Fêlé) : pivot = la salle commune.
 *     On explore librement auberge, cour, village, lisière. Une « laisse » ramène le groupe
 *     à l'auberge (tempête, loups, cloche de Berthe, sergent Brac) s'il s'éloigne trop.
 *     Il faut 2 indices sur 4 pour pouvoir partir. 4 quêtes secondaires.
 *   Chapitre 2 (le Bois-Noir) : plusieurs chemins, un gué-énigme, une clairière, le Loup de Cendre.
 *   Chapitre 3 (le Sanctuaire) : rendre le Cœur, réveiller Lisette, retour et fête.
 *   Fin : débloque la campagne 2 « La Lanterne d'Aube ».
 *
 * Filets de sécurité (retour au scénario principal) —
 *   - Si le groupe n'a pas récupéré le Cœur au chapitre 1, Gaspard s'enfuit dans la nuit
 *     avec lui et se fait capturer par les brumelins : on le sauve au chapitre 2.
 *   - Une défaite en combat ramène à l'auberge (chap. 1) ou à l'orée (chap. 2), jamais de fin brutale.
 */

export const NPCS: Record<string, Npc> = {
	narrateur: {
		id: 'narrateur',
		name: 'Le Conteur',
		role: 'Voix du maître du jeu',
		color: '#d9c9a3',
		voice: { pitch: 0.95, rate: 0.95, gender: 'm' },
		casting:
			'Vieillard de 85 à 90 ans, vieux magicien sage et bienveillant : voix basse, profonde, éraillée et usée par les années, timbre rocailleux, souffle audible entre les phrases, très légère fragilité dans la voix, mais chaude et rassurante. Lecture fluide et naturelle, comme un grand-père qui raconte une histoire qu’il connaît par cœur : phrasé régulier, calme, sans emphase ni effets théâtraux, sans déclamer. Une pointe de malice et de mystère dans la voix. Français de France neutre, enregistrement intime, proche du micro.',
	},
	berthe: {
		id: 'berthe',
		name: 'Berthe Mâchefer',
		role: 'Aubergiste du Chaudron Fêlé',
		color: '#e08a3c',
		voice: { pitch: 0.8, rate: 1.02, gender: 'f' },
		casting:
			'Femme d’une cinquantaine d’années, voix ronde et puissante d’aubergiste habituée à couvrir le bruit d’une salle. Franche, maternelle, bourrue en surface. Léger accent rocailleux du Massif central. Rit facilement, mais l’inquiétude pour Lisette affleure.',
		portrait: 'portrait-berthe',
	},
	tilo: {
		id: 'tilo',
		name: 'Tilo',
		role: 'Garçon d’écurie, meilleur ami de Lisette',
		color: '#8fc0e8',
		voice: { pitch: 1.55, rate: 1.1, gender: 'm' },
		casting:
			'Garçon de 11 ans, voix claire et vive, un peu essoufflée. Il parle vite quand il a peur ou qu’il est excité, se reprend, hésite. Sincère, courageux malgré lui. Pas de voix d’adulte imitant un enfant : une vraie voix juvénile.',
		portrait: 'portrait-tilo',
	},
	ossian: {
		id: 'ossian',
		name: 'Ossian',
		role: 'Vieux cartographe aveugle',
		color: '#b7a6d9',
		voice: { pitch: 0.6, rate: 0.82, gender: 'm' },
		casting:
			'Vieil homme de 80 ans, voix basse, lente et rêveuse, un peu chevrotante. Il cherche ses mots comme on cherche un chemin dans le noir, avec une grande douceur. Petit rire sec de temps en temps. Sagesse tranquille.',
		portrait: 'portrait-ossian',
	},
	aubin: {
		id: 'aubin',
		name: 'Aubin',
		role: 'Le meunier, père de Lisette',
		color: '#c9b27c',
		voice: { pitch: 0.9, rate: 1.08, gender: 'm' },
		casting:
			'Homme de 40 ans, meunier, voix solide mais brisée par l’angoisse : il parle vite, la gorge serrée, au bord des larmes sans y tomber. Accent rural léger. Dans les dernières scènes, soulagement et gratitude débordante.',
		portrait: 'portrait-aubin',
	},
	gaspard: {
		id: 'gaspard',
		name: 'Gaspard Belle-Langue',
		role: 'Colporteur bavard',
		color: '#d6c14a',
		voice: { pitch: 1.15, rate: 1.22, gender: 'm' },
		casting:
			'Homme de 45 ans, colporteur bavard et théâtral, voix légère et chantante de bonimenteur de foire. Débit rapide, emphase sur les grands mots, un brin de mauvaise foi. Quand il est pris en faute, il bafouille et sa voix monte d’un ton.',
		portrait: 'portrait-gaspard',
	},
	corvine: {
		id: 'corvine',
		name: 'Dame Corvine',
		role: 'Herboriste de la lisière',
		color: '#7fb38a',
		voice: { pitch: 1.2, rate: 0.86, gender: 'f' },
		casting:
			'Femme âgée de 70 ans, herboriste, voix fine et un peu craquelée, débit lent, chuchotements et petites pauses mystérieuses. Malicieuse plutôt qu’inquiétante ; elle aime faire durer le suspense. Ricanement doux de vieille sorcière bienveillante.',
		portrait: 'portrait-corvine',
	},
	brac: {
		id: 'brac',
		name: 'Sergent Brac',
		role: 'Garde du village',
		color: '#a8b0bd',
		voice: { pitch: 0.65, rate: 0.95, gender: 'm' },
		casting:
			'Homme de 50 ans, garde du village, voix grave et sèche, phrases courtes, ton d’ancien soldat qui donne des ordres. Bourru, mais on sent qu’il a bon cœur. Aucune agressivité réelle.',
		portrait: 'portrait-brac',
	},
	pff: {
		id: 'pff',
		name: 'Pff',
		role: 'Petit brumelin perdu',
		color: '#bcd3e0',
		voice: { pitch: 1.95, rate: 1.3, gender: 'm' },
		casting:
			'Petite créature de brume de la taille d’un chaton : voix très aiguë, minuscule, soufflée, comme un murmure qui pétille. Parle en phrases courtes et naïves, avec de petits « pff » de vapeur. Adorable, jamais strident ; prévoir un léger effet de souffle ou de réverbération aérienne.',
		portrait: 'portrait-pff',
	},
	heron: {
		id: 'heron',
		name: 'L’Esprit du Héron',
		role: 'Gardien du gué',
		color: '#9ec9c4',
		voice: { pitch: 0.7, rate: 0.78, gender: 'f' },
		casting:
			'Esprit ancien du gué, voix féminine grave, très lente, calme comme l’eau qui dort. Légère réverbération, comme si la voix venait de la rivière. Solennelle mais bienveillante ; elle pose ses énigmes avec patience.',
		portrait: 'portrait-heron',
	},
	'dame-grise': {
		id: 'dame-grise',
		name: 'La Dame Grise',
		role: 'Gardienne endormie du sanctuaire',
		color: '#cfd6e6',
		voice: { pitch: 0.85, rate: 0.72, gender: 'f' },
		casting:
			'Gardienne du sanctuaire, voix féminine profonde et lointaine, presque un souffle, avec beaucoup d’écho. Fatiguée d’un sommeil de plusieurs siècles, puis de plus en plus claire et chaleureuse en se réveillant. Majestueuse, triste puis apaisée, jamais menaçante.',
		portrait: 'portrait-dame-grise',
	},
	lisette: {
		id: 'lisette',
		name: 'Lisette',
		role: 'Fille du meunier, 10 ans',
		color: '#e88f8f',
		voice: { pitch: 1.65, rate: 1.05, gender: 'f' },
		casting:
			'Fille de 10 ans, voix douce et claire. D’abord ensommeillée et perdue (à moitié dans un rêve), puis soulagée, puis pleine d’entrain. Spontanée, polie, un peu fière d’avoir vu des choses extraordinaires. Une vraie voix d’enfant.',
		portrait: 'portrait-lisette',
	},
};

export const ITEMS: Record<string, Item> = {
	potion: {
		id: 'potion',
		name: 'Potion de soin',
		description: 'Une fiole de sirop de sureau. Elle sent l’été.',
		use: { label: 'Boire', heal: 3, target: 'one' },
	},
	saucisse: {
		id: 'saucisse',
		name: 'Saucisse fumée de Berthe',
		description: 'Énorme, odorante, irrésistible. Pour les humains… et peut-être pour d’autres.',
	},
	lanterne: {
		id: 'lanterne',
		name: 'Lanterne de Tilo',
		description: 'Une petite lanterne de corne. Sa flamme ne vacille pas dans la brume.',
	},
	corde: { id: 'corde', name: 'Corde du moulin', description: 'Vingt pas de corde solide, qui sent la farine.' },
	minuit: { id: 'minuit', name: 'Minuit (le chat)', description: 'Un chat noir aux yeux d’or. Il ronronne dans le sac.' },
	'herbes-veille': {
		id: 'herbes-veille',
		name: 'Herbes de veille',
		description: 'Un sachet de menthe sauvage et d’ortie. Qui le respire ne peut pas s’endormir.',
	},
	'fragment-carte': {
		id: 'fragment-carte',
		name: 'Fragment de carte',
		description: 'Un morceau de vieille carte en cuir huilé, trouvé au fond du puits.',
	},
	'carte-ossian': {
		id: 'carte-ossian',
		name: 'Carte d’Ossian',
		description: 'Le fragment complété de mémoire par Ossian : un sentier caché mène au gué.',
	},
	'piece-ancienne': {
		id: 'piece-ancienne',
		name: 'Pièce à la lanterne',
		description: 'Une pièce très ancienne frappée d’une lanterne entourée de rayons.',
	},
	amulette: {
		id: 'amulette',
		name: 'Amulette « anti-brume »',
		description: 'Achetée 5 pièces à Gaspard, qui jure qu’elle éloigne la Grise. Un pendentif doré au bout d’une ficelle… drôlement léger. À examiner de près ?',
	},
	'plume-heron': {
		id: 'plume-heron',
		name: 'Plume du Héron',
		description: 'Une plume argentée. Quand on souffle dessus, le vent se lève.',
	},
	'coeur-aube': {
		id: 'coeur-aube',
		name: 'Cœur de l’Aube',
		description: 'Une pierre dorée, tiède comme une main. Elle bat très doucement.',
	},
	'echarpe-rouge': {
		id: 'echarpe-rouge',
		name: 'Écharpe rouge de Lisette',
		description: 'Accrochée à une ronce. Elle garde un peu de poussière bleue.',
	},
};

export const QUESTS: Record<string, Quest> = {
	'q-lisette': {
		id: 'q-lisette',
		title: 'Où est Lisette ?',
		kind: 'principale',
		description:
			'La fille du meunier a disparu dans la brume. Rassemblez au moins deux indices à Combeloup avant de partir à sa recherche.',
		xp: 6,
	},
	'q-coeur': {
		id: 'q-coeur',
		title: 'Le Cœur de l’Aube',
		kind: 'principale',
		description: 'La pierre dorée volée au sanctuaire doit retrouver sa place sur l’autel.',
		xp: 6,
	},
	'q-cave': {
		id: 'q-cave',
		title: 'La cave qui grince',
		kind: 'secondaire',
		description: 'Quelque chose effraie les rats de la cave de Berthe, qui envahissent la cuisine.',
		xp: 3,
	},
	'q-minuit': {
		id: 'q-minuit',
		title: 'Le chat de Dame Corvine',
		kind: 'secondaire',
		description: 'Minuit, le chat noir de l’herboriste, n’est pas rentré depuis que la brume est montée.',
		xp: 3,
	},
	'q-puits': {
		id: 'q-puits',
		title: 'Le puits qui chante',
		kind: 'secondaire',
		description: 'Une berceuse monte du vieux puits de la place. Qui chante au fond de l’eau ? Ossian a perdu sa carte là-dedans.',
		xp: 3,
	},
	'q-gaspard': {
		id: 'q-gaspard',
		title: 'Les amulettes de Gaspard',
		kind: 'secondaire',
		description: 'Le colporteur vend des « amulettes anti-brume ». Et s’il cachait quelque chose ?',
		xp: 2,
	},
	'q-heron': {
		id: 'q-heron',
		title: 'L’énigme du gué',
		kind: 'secondaire',
		description: 'L’Esprit du Héron ne laisse passer que ceux qui résolvent son énigme.',
		xp: 2,
	},
};

/** Drapeaux d'indices : il en faut 2 pour lancer le chapitre 2. */
export const CLUES = ['indice-lumiere', 'indice-legende', 'indice-gaspard', 'indice-pff', 'indice-vision'];

/**
 * Trajets d'une zone à l'autre : on ne change jamais de lieu sans le raconter (voir docs/conventions.md).
 * Chaque phrase situe le groupe dans l'espace et dans l'ambiance (la nuit, la pluie, la Grise).
 */
export const TRANSITIONS: Record<string, string> = {
	'auberge>abords': 'Vous poussez la lourde porte de l’auberge et sortez dans la nuit. Le froid vous pique les joues.',
	'auberge>village': 'Vous quittez la chaleur de l’auberge. Dehors, il pleut toujours, et la Grise étouffe tous les bruits. Vous descendez vers la place du village.',
	'auberge>lisiere': 'Vous sortez dans la nuit et filez vers la forêt, à travers le village endormi.',
	'abords>auberge': 'Vous traversez la cour sous la pluie et rentrez dans l’auberge. Quelle douceur, après le froid du dehors !',
	'abords>village': 'Vous quittez la cour et descendez le chemin pavé jusqu’au village, noyé dans la Grise.',
	'abords>lisiere': 'Vous traversez le village endormi et suivez le chemin de terre jusqu’à la lisière.',
	'village>auberge': 'Vous remontez vers l’auberge, le col relevé. Quand la porte se referme derrière vous, l’odeur de la soupe vous fait du bien.',
	'village>abords': 'Vous remontez le chemin jusqu’à l’auberge et entrez dans la cour.',
	'village>lisiere': 'Vous laissez les dernières maisons derrière vous et suivez le chemin de terre, de plus en plus étroit.',
	'lisiere>village': 'Vous quittez l’ombre des arbres et revenez vers le village. Les premières maisons sortent de la brume, une à une.',
	'lisiere>auberge': 'Vous tournez le dos aux arbres noirs et rentrez à l’auberge à grands pas, sans regarder derrière vous.',
	'lisiere>abords': 'Vous revenez sur vos pas à travers le village endormi, jusqu’à la cour de l’auberge.',
};

/**
 * Lieux physiques du chapitre 1. On ne passe jamais d'un lieu à l'autre sans le raconter :
 * sortie (selon la destination), trajet entre zones (TRANSITIONS), arrivée (selon la provenance).
 * '' = rien à dire pour ce passage (la scène ou le choix le raconte déjà).
 */
export const PLACES: Record<string, Place> = {
	route: { name: 'La route de Combeloup' },
	porte: { name: 'La porte de l’auberge', arrive: { '*': 'Vous grimpez la colline à grands pas, la pluie dans le dos, jusqu’à la porte de l’auberge.' } },
	'salle-commune': { name: 'La salle commune' },
	cuisine: {
		name: 'La cuisine',
		arrive: { cave: '', '*': 'Vous poussez la porte battante de la cuisine. Une bouffée de chaleur et de vapeur vous accueille.' },
		leave: { cave: '', '>': '', '*': 'Vous ressortez de la cuisine et retrouvez la grande salle, son feu et ses murmures.' },
	},
	cave: {
		name: 'La cave',
		arrive: { '*': 'Vous soulevez la lourde trappe et descendez dans le noir.' },
		leave: {
			cuisine: 'Vous remontez l’escalier de la cave et repoussez la trappe.',
			'>': 'Vous remontez de la cave et traversez la cuisine.',
			'*': 'Vous remontez l’escalier de la cave, traversez la cuisine et retrouvez la grande salle.',
		},
	},
	chambre: {
		name: 'La chambre sous les toits',
		arrive: { '*': 'Vous montez l’escalier qui grince jusqu’à l’étage.' },
		leave: { '>': 'Vous redescendez l’escalier.', '*': 'Vous redescendez l’escalier jusqu’à la grande salle.' },
	},
	cour: { name: 'La cour de l’auberge' },
	ecurie: {
		name: 'L’écurie',
		arrive: { grenier: '', '*': 'Vous traversez la cour jusqu’à l’écurie et poussez la porte de bois. Une bonne odeur de foin vous accueille.' },
		leave: { grenier: '', '*': 'Vous ressortez de l’écurie.' },
	},
	grenier: {
		name: 'Le grenier à foin',
		arrive: { '*': 'Vous grimpez à l’échelle du grenier à foin. Ça sent la poussière, la paille… et le chat.' },
		leave: { ecurie: 'Vous redescendez l’échelle du grenier.', '*': 'Vous redescendez l’échelle du grenier, Minuit bien au chaud contre vous, et ressortez de l’écurie.' },
	},
	roulotte: {
		name: 'La roulotte du colporteur',
		arrive: { '*': 'Vous traversez la cour et vous approchez à pas de loup de la roulotte du colporteur.' },
		leave: { '*': 'Vous vous éloignez de la roulotte, l’air de rien.' },
	},
	place: { name: 'La place du village' },
	moulin: {
		name: 'Le moulin',
		arrive: { '*': 'Vous suivez le ruisseau jusqu’au moulin, dont la grande roue tourne lentement dans la nuit. Une échelle grimpe le long du mur.' },
		leave: { '*': 'Vous redescendez l’échelle de la chambre et quittez le moulin, le cœur serré.' },
	},
	puits: {
		name: 'Le vieux puits',
		arrive: { 'fond-puits': '', '*': 'Vous traversez la place jusqu’au vieux puits, sous son petit toit de bois.' },
		leave: { 'fond-puits': '', '*': 'Vous laissez le vieux puits derrière vous. La berceuse s’éteint peu à peu dans votre dos.' },
	},
	'fond-puits': { name: 'Le fond du puits' },
	lisiere: { name: 'La lisière du Bois-Noir' },
	hutte: {
		name: 'La hutte de Dame Corvine',
		arrive: { '*': 'Vous longez la lisière jusqu’à la petite hutte au toit d’herbes, et frappez à la porte.' },
		leave: { '*': 'Vous ressortez de la hutte de Corvine et refermez la porte derrière vous.' },
	},
	'sous-bois': {
		name: 'Sous les arbres',
		arrive: { '*': 'Vous quittez le chemin et entrez sous les arbres. Les branches se referment au-dessus de vos têtes.' },
		leave: { '*': 'Vous rebroussez chemin entre les troncs, jusqu’à la lisière.' },
	},
	dehors: { name: 'Dehors, dans la brume' },
	brume: { name: 'Perdus dans la Grise' },
	/* ---- Chapitres 2 et 3 : le voyage dans le Bois-Noir ---- */
	oree: {
		name: 'L’orée du Bois-Noir',
		arrive: {
			cour: 'Vous traversez le village encore endormi et suivez le chemin de terre. À la lisière, Dame Corvine vous fait un petit signe depuis sa fenêtre. Puis les grands arbres noirs se referment derrière vous.',
			ravin: '',
			pierres: '',
			'*': 'Vous revenez sur vos pas jusqu’à l’orée, là où les chemins se séparent.',
		},
		leave: {
			pierres: 'Vous prenez à gauche l’allée des grandes pierres dressées.',
			ravin: 'Vous marchez droit devant, jusqu’au bord du ravin.',
			terriers: 'Pff saute de votre sac et file vers le trou sombre entre les racines. Il faut se baisser pour le suivre.',
			sentier: 'Carte en main, vous cherchez les deux bouleaux. Le sentier d’Ossian est bien là, presque invisible sous les fougères.',
			'*': '',
		},
	},
	pierres: {
		name: 'Les pierres dressées',
		leave: { oree: 'Vous revenez sur vos pas jusqu’à l’orée.', '*': 'Vous suivez l’allée des pierres jusqu’au bout. Peu à peu, on entend une rivière qui court, quelque part devant vous.' },
	},
	ravin: {
		name: 'Le ravin',
		leave: { oree: 'Vous remontez la pente jusqu’à l’orée, en vous accrochant aux racines.', '*': '' },
	},
	terriers: {
		name: 'Les terriers des brumelins',
		leave: {
			clairiere: 'Le tunnel remonte doucement. Une lumière pâle apparaît au bout, et des petits rires : vous ressortez à quatre pattes, juste au bord d’une clairière.',
			gue: 'Le tunnel de côté descend, devient humide, puis débouche entre deux rochers, au bord d’une grande rivière.',
		},
	},
	sentier: {
		name: 'Le sentier d’Ossian',
		leave: { '*': 'Le sentier descend entre les bouleaux et vous mène tout droit au bord de la rivière.' },
	},
	gue: {
		name: 'Le gué du Héron',
		arrive: { ravin: 'Au fond du ravin, le ruisseau vous conduit jusqu’à une grande rivière.', '*': '' },
		leave: { '*': 'De l’autre côté de la rivière, le chemin s’enfonce sous les arbres. Bientôt, des petits rires et une chanson résonnent devant vous.' },
	},
	clairiere: {
		name: 'La clairière des brumelins',
		leave: { oree: '', '*': 'Vous laissez la clairière derrière vous. Le chemin monte, et l’air devient plus chaud, comme près d’un feu.' },
	},
	escalier: {
		name: 'L’escalier du sanctuaire',
		leave: { oree: '', '*': 'Vous gravissez les dernières marches de l’escalier et passez entre deux colonnes brisées.' },
	},
	temple: {
		name: 'Le Sanctuaire de l’Aube',
		leave: { '*': 'Lisette bien serrée contre vous, vous quittez le temple.' },
	},
	'chemin-retour': { name: 'Le chemin du retour' },
	ronde: {
		name: 'La ronde des brumelins',
		arrive: { '*': 'Vous avancez à pas de loup vers les lumières bleues, de tronc en tronc, en retenant votre souffle.' },
		leave: { '*': 'Vous vous éloignez sans bruit de la ronde. Derrière vous, la berceuse des brumelins continue.' },
	},
};

export const ZONES: Record<string, Zone> = {
	route: { id: 'route', name: 'La route de Combeloup' },
	auberge: { id: 'auberge', name: 'Le Chaudron Fêlé' },
	abords: {
		id: 'abords',
		name: 'La cour de l’auberge',
		leash: 4,
		leashUntil: 'ch2',
		recalls: ['rappel-cloche', 'rappel-tempete'],
	},
	village: {
		id: 'village',
		name: 'Le village de Combeloup',
		leash: 4,
		leashUntil: 'ch2',
		recalls: ['rappel-brac', 'rappel-tempete', 'rappel-cloche'],
	},
	lisiere: {
		id: 'lisiere',
		name: 'La lisière du Bois-Noir',
		leash: 3,
		leashUntil: 'ch2',
		recalls: ['rappel-loups', 'rappel-tempete'],
	},
	foret: { id: 'foret', name: 'Le Bois-Noir' },
	sanctuaire: { id: 'sanctuaire', name: 'Le Sanctuaire de l’Aube' },
};

export const CHAPTERS = [
	{ n: 1, title: 'Une nuit au Chaudron Fêlé' },
	{ n: 2, title: 'Le Bois-Noir' },
	{ n: 3, title: 'Le Sanctuaire de l’Aube' },
];
