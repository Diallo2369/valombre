import type { Character, ClassId, Difficulty, Gender, StatKey, Stats } from './types';

/**
 * Règles « Valombre » pensées pour une première initiation :
 * - 6 caractéristiques, tirées chacune avec 1 dé à 6 faces (un 1 compte comme 2) ;
 * - +1 dans la caractéristique favorite de la classe ;
 * - un test = 1 dé + la caractéristique, à comparer à la difficulté ;
 * - un 6 naturel réussit toujours (« coup de chance ! ») ;
 * - les PV dépendent de l'Endurance ; l'armure prend les coups avant les PV (réparée à chaque combat) ;
 * - personne ne meurt : à 0 PV, un héros est épuisé jusqu'au prochain soin.
 */

export const STATS: { key: StatKey; label: string; short: string; hint: string }[] = [
	{ key: 'force', label: 'Force', short: 'FOR', hint: 'Soulever, frapper fort, grimper à la corde.' },
	{ key: 'agilite', label: 'Agilité', short: 'AGI', hint: 'Courir, se cacher, viser, sauter.' },
	{ key: 'endurance', label: 'Endurance', short: 'END', hint: 'Encaisser les coups, résister au froid : donne les points de vie.' },
	{ key: 'esprit', label: 'Esprit', short: 'ESP', hint: 'Observer, réfléchir, lancer un sort.' },
	{ key: 'charme', label: 'Charme', short: 'CHA', hint: 'Convaincre, rassurer, amadouer une bête.' },
	{ key: 'initiative', label: 'Initiative', short: 'INI', hint: 'Réagir le premier : en combat, décide qui joue avant les autres.' },
];

export const STAT_LABEL: Record<StatKey, string> = {
	force: 'Force',
	agilite: 'Agilité',
	endurance: 'Endurance',
	esprit: 'Esprit',
	charme: 'Charme',
	initiative: 'Initiative',
};

export const DIFFICULTY: Record<Difficulty, { label: string; target: number }> = {
	facile: { label: 'Facile', target: 5 },
	moyen: { label: 'Moyen', target: 7 },
	difficile: { label: 'Difficile', target: 9 },
};

/** Actions de combat. Chaque classe a les siennes (voir ClassDef.abilities). */
export type AbilityId =
	// Guerrier
	| 'frapper'
	| 'coup-assommant'
	| 'mur-boucliers'
	| 'onde-de-choc'
	| 'cri-de-rage'
	| 'intervention'
	| 'aura'
	| 'oeil-pour-oeil'
	| 'encaisseur'
	// Cœur-sauvage
	| 'double-attaque'
	| 'moquerie'
	| 'tourbillon'
	| 'fureur-ours'
	| 'revers-sauvage'
	| 'folie'
	| 'coeur-battant'
	// Rôdeur
	| 'tir'
	| 'salve'
	| 'filet'
	| 'fleche-empoisonnee'
	| 'pieges'
	| 'pointes-trempees'
	| 'plaie-beante'
	| 'oeil-de-lynx'
	// Mage : la magie des runes
	| 'projectiles-runes'
	| 'rune-eclat'
	| 'rune-ricochet'
	| 'orbe-runique'
	| 'deflagration'
	| 'echo'
	| 'boule-de-neige'
	| 'folie-mage'
	// Barde
	| 'bouclier-lune'
	| 'berceuse'
	| 'air-guerison'
	| 'chant'
	| 'ronde'
	| 'melodie'
	| 'coeur-vaillant'
	| 'note-purete';

/** Qui l'action vise : une créature, plusieurs, toutes ; un compagnon ; le groupe ; personne ; une case (Ronde enchantée). */
export type AbilityTarget = 'foe' | 'foes' | 'all' | 'ally' | 'party' | 'none' | 'hex';

export interface Ability {
	id: AbilityId;
	name: string;
	icon: string;
	text: string;
	/** Capacité passive : toujours active, pas un bouton. */
	passive?: boolean;
	/** Réaction : elle se joue pendant le tour des monstres (Intervention), pas à son tour. */
	reaction?: boolean;
	target: AbilityTarget;
	/** Portée en cases (1 = au contact). Sans portée : le groupe entier, peu importe la distance. */
	range?: number;
	/** Zone : la cible et les créatures collées à elle. */
	area?: boolean;
	/** Chaîne : depuis la cible, rebondit sur `jumps` autres créatures, chacune à `reach` cases au plus de la précédente. */
	chain?: { jumps: number; reach: number };
	/** Pour `foes` : nombre maximal de créatures touchées. */
	maxTargets?: number;
	/** Pour `ally` : le héros peut se choisir lui-même. */
	self?: boolean;
	/** Pour `ally` : peut relever un compagnon KO (Air de guérison). */
	revive?: boolean;
	/** Cri de rage : toutes les créatures l'attaquent, et il pare les coups avec cette chance jusqu'à son prochain tour. */
	rally?: number;
	/** Caractéristique du jet ; sans `stat`, pas de dé (ça marche à tous les coups). */
	stat?: StatKey;
	/** Plus dur à réussir : s'ajoute au score à atteindre. */
	harder?: number;
	/** Dégâts si ça touche, en PV. */
	damage?: number;
	/** Second coup, de l'autre main (les deux haches du Cœur-sauvage), en PV. */
	offhand?: number;
	/** PV que le héros récupère si ça touche (Fureur de l'ours). */
	lifesteal?: number;
	/** Mélodie apaisante : chaque héros du groupe reprend `amount` PV au début de ses `turns` prochains tours. */
	regen?: { amount: number; turns: number };
	/** Exécution : si elle achève sa cible, elle peut être relancée aussitôt, dans le même tour (sans bouger). */
	chainOnKill?: boolean;
	/** Mur de boucliers : jusqu'au prochain tour du héros, ses compagnons collés à lui prennent ce nombre de dégâts de moins par coup. */
	wall?: number;
	/** Multiplie la menace des dégâts (Revers sauvage : les créatures touchées enragent contre lui). */
	threatMul?: number;
	/** Ronde enchantée : une barrière autour de la créature visée et des 6 cases voisines, jusqu'au prochain tour du héros. */
	barrier?: boolean;
	/** Repousse d'une case les créatures touchées, loin du héros (Déflagration runique). */
	push?: boolean;
	/** Œil pour œil (passif) : chaque créature qui le frappe au contact reçoit `damage` PV, avec `stunChance` d'être assommée. */
	riposte?: { damage: number; stunChance: number; chance?: number };
	/** Cône : la créature visée (collée au héros) et celles juste derrière elle (Onde de choc). */
	cone?: boolean;
	/** Bâillonne la créature touchée (pas de sort) pendant ce nombre de tours. */
	silence?: number;
	/** Une flèche (Pointes trempées s'applique). */
	arrow?: boolean;
	/** Moquerie : la créature, enragée, frappe le moqueur de +25 % à +100 %. */
	rage?: boolean;
	/** Coup critique : dégâts doublés. */
	crit?: boolean;
	/** Dégâts doublés contre une créature de brume. */
	brumeBonus?: boolean;
	/** États posés sur la créature touchée. */
	stun?: { kind: 'assomme' | 'filet' | 'sommeil' | 'piege'; turns: number };
	poison?: number;
	blind?: number;
	taunt?: boolean;
	/** Protéger un compagnon (Intervention). */
	protect?: boolean;
	/** PV rendus : à tout le groupe (cible `party`), ou au compagnon choisi (cible `ally`). */
	heal?: number;
	/** Bouclier posé sur un compagnon (dégâts absorbés). */
	shield?: number;
	/** Enlève les maux (poison, brûlure…) du groupe. */
	cleanse?: boolean;
	spell?: boolean;
	/**
	 * Délai de récupération : utilisable 1 tour sur `every` (3 : on la relance au 3e tour suivant).
	 * Réservé aux coups puissants ; les autres sont à volonté.
	 */
	every?: number;
}

const A = (a: Ability) => a;

export const ABILITIES: Record<AbilityId, Ability> = {
	/* ---- Guerrier : le rempart ---- */
	frapper: A({
		id: 'frapper', range: 1,
		name: 'Coup de bouclier',
		icon: '🛡️',
		target: 'foe',
		stat: 'force',
		damage: 3,
		threatMul: 2,
		text: 'Un grand coup de bouclier : 3 PV, et la créature, vexée, ne pense plus qu’à toi (menace doublée).',
	}),
	'coup-assommant': A({
		id: 'coup-assommant', range: 1,
		name: 'Coup assommant',
		icon: '💫',
		target: 'foe',
		stat: 'force',
		damage: 2,
		stun: { kind: 'assomme', turns: 1 },
		every: 3,
		text: 'Un coup de pommeau sur le crâne : 2 PV, et la créature, sonnée, passe son prochain tour.',
	}),
	'mur-boucliers': A({
		id: 'mur-boucliers',
		name: 'Mur de boucliers',
		icon: '🧱',
		target: 'none',
		wall: 1,
		every: 3,
		text: 'Tu plantes ton bouclier et tu couvres tes amis : jusqu’à ton prochain tour, chaque compagnon collé à toi prend 1 dégât de moins par coup.',
	}),
	'onde-de-choc': A({
		id: 'onde-de-choc', range: 1,
		name: 'Onde de choc',
		icon: '💢',
		target: 'foe',
		cone: true,
		push: true,
		stat: 'force',
		damage: 3,
		every: 3,
		text: 'Un grand coup de bouclier : une onde de poussière et de force part devant toi. La créature collée à toi et celles juste derrière elle perdent 3 PV et reculent d’une case.',
	}),
	'cri-de-rage': A({
		id: 'cri-de-rage',
		name: 'Cri de rage',
		icon: '📢',
		target: 'none',
		rally: 0.9,
		every: 4,
		text: 'Ton coup ultime : tu frappes ton bouclier en hurlant. Toutes les créatures qui peuvent t’atteindre ne pensent plus qu’à toi… mais jusqu’à ton prochain tour, tu pares 9 coups sur 10 (et Œil pour œil les leur renvoie) !',
	}),
	intervention: A({
		id: 'intervention',
		name: 'Intervention',
		icon: '🛡️',
		passive: true,
		reaction: true,
		target: 'none',
		protect: true,
		text: 'Pendant le tour des monstres, quand une flèche montre qu’un compagnon proche (2 cases) va être attaqué : tu te jettes devant lui et tu prends ses coups jusqu’à ton prochain tour, avec 1 dégât de moins. Une fois par tour.',
	}),
	aura: A({
		id: 'aura',
		name: 'Aura de bataille',
		icon: '🔱',
		passive: true,
		target: 'none',
		text: 'Tout ce que tu fais énerve davantage les monstres (une fois et demie plus) : ils ont bien du mal à résister à l’envie de t’attaquer, toi plutôt que tes amis.',
	}),
	encaisseur: A({
		id: 'encaisseur',
		name: 'Encaisseur',
		icon: '🪨',
		passive: true,
		target: 'none',
		text: 'Tu encaisses les chocs comme un roc : chaque coup que tu reçois (même un sort) fait 1 dégât de moins, et 2 de moins si ton Endurance vaut 8 ou plus. Ça passe avant ton armure.',
	}),
	'oeil-pour-oeil': A({
		id: 'oeil-pour-oeil',
		name: 'Œil pour œil',
		icon: '👁️',
		passive: true,
		target: 'none',
		riposte: { damage: 2, stunChance: 0.25, chance: 2 / 3 },
		text: 'Quand une créature te frappe au contact, 2 fois sur 3 tu lui renvoies le coup : 2 PV, et 1 fois sur 4 elle est assommée. Plus on te frappe, plus ça leur coûte !',
	}),

	/* ---- Cœur-sauvage : deux haches, pas d'armure ---- */
	'double-attaque': A({
		id: 'double-attaque', range: 1,
		name: 'Double attaque',
		icon: '🪓',
		target: 'foe',
		stat: 'agilite',
		damage: 3,
		offhand: 2,
		chainOnKill: true,
		text: 'Une hache, puis l’autre : 3 PV + 2 PV. Si elle achève la créature, tu peux la relancer aussitôt sur une autre créature collée à toi, et encore, tant que tu achèves !',
	}),
	moquerie: A({
		id: 'moquerie', range: 4,
		name: 'Moquerie',
		icon: '😜',
		target: 'foe',
		taunt: true,
		rage: true,
		every: 2,
		text: 'Tu nargues une créature : elle ne pense plus qu’à toi et t’attaquera à son prochain tour. Mais elle est folle de rage : son coup fera de 25 % à 100 % de dégâts en plus !',
	}),
	'fureur-ours': A({
		id: 'fureur-ours', range: 1,
		name: 'Fureur de l’ours',
		icon: '🐻',
		target: 'foe',
		stat: 'agilite',
		damage: 2,
		offhand: 2,
		lifesteal: 2,
		every: 2,
		text: 'La rage de l’ours te porte : 2 PV + 2 PV, et si ça touche tu récupères 2 PV.',
	}),
	'revers-sauvage': A({
		id: 'revers-sauvage', range: 1,
		name: 'Revers sauvage',
		icon: '🪓',
		target: 'foes',
		maxTargets: 2,
		stat: 'agilite',
		damage: 2,
		offhand: 2,
		threatMul: 2,
		every: 2,
		text: 'Un grand revers des deux haches sur deux créatures collées à toi (au choix) : 2 PV + 2 PV chacune. Ça les met dans une rage folle contre toi (menace doublée) !',
	}),
	tourbillon: A({
		id: 'tourbillon', range: 1,
		name: 'Tourbillon',
		icon: '🌀',
		target: 'all',
		stat: 'agilite',
		damage: 2,
		offhand: 2,
		every: 3,
		text: 'Les deux haches tournoient : toutes les créatures collées à toi perdent 2 PV + 2 PV.',
	}),
	'coeur-battant': A({
		id: 'coeur-battant',
		name: 'Cœur battant',
		icon: '❤️‍🔥',
		passive: true,
		target: 'none',
		text: 'Le combat te fait battre le cœur : chaque créature touchée par tes haches a 1 chance sur 3 de te rendre 1 PV (un Tourbillon qui en touche plusieurs, c’est plusieurs chances !).',
	}),
	folie: A({
		id: 'folie',
		name: 'Folie vengeresse',
		icon: '🔥',
		passive: true,
		target: 'none',
		text: 'Quand tu reçois un coup, la fureur monte : ta prochaine attaque fait 50 % de dégâts en plus. Mais ta fureur se voit de loin : les monstres t’en veulent davantage.',
	}),

	/* ---- Rôdeur : à distance ---- */
	tir: A({ id: 'tir', range: 5, name: 'Tir à l’arc', icon: '🏹', target: 'foe', stat: 'agilite', damage: 3, arrow: true, text: 'Une flèche bien ajustée, de loin : 3 PV.' }),
	salve: A({
		id: 'salve', range: 5,
		name: 'Salve',
		icon: '🎆',
		target: 'foes',
		maxTargets: 3,
		stat: 'agilite',
		damage: 3,
		arrow: true,
		every: 3,
		text: 'Trois flèches d’affilée : jusqu’à 3 créatures à portée perdent 3 PV.',
	}),
	pieges: A({
		id: 'pieges', range: 4,
		name: 'Pièges en pagaille',
		icon: '🪤',
		target: 'hex',
		area: true,
		stat: 'agilite',
		damage: 3,
		stun: { kind: 'piege', turns: 1 },
		every: 3,
		text: 'Tu lances une volée de pièges à mâchoires sur une case et les 6 cases voisines : chaque créature dedans perd 3 PV et reste coincée, elle passe son prochain tour.',
	}),
	filet: A({
		id: 'filet', range: 4,
		name: 'Filet',
		icon: '🕸️',
		target: 'foe',
		stat: 'agilite',
		stun: { kind: 'filet', turns: 2 },
		every: 3,
		text: 'Un filet lancé de loin : la créature, empêtrée, passe ses 2 prochains tours. Tant qu’elle est prise, tout le monde la touche à coup sûr !',
	}),
	'fleche-empoisonnee': A({
		id: 'fleche-empoisonnee', range: 5,
		name: 'Flèche empoisonnée',
		icon: '🧪',
		target: 'foe',
		stat: 'agilite',
		damage: 3,
		poison: 3,
		arrow: true,
		every: 3,
		text: '3 PV, puis le poison ronge la créature : 1 PV à chacun de ses 3 prochains tours.',
	}),
	'plaie-beante': A({
		id: 'plaie-beante',
		name: 'Plaie béante',
		icon: '🩸',
		passive: true,
		target: 'none',
		text: 'Tes flèches ouvrent de vilaines plaies : chaque flèche qui touche a 1 chance sur 4 de faire saigner la créature (1 PV à chacun de ses 2 prochains tours), en plus du poison.',
	}),
	'oeil-de-lynx': A({
		id: 'oeil-de-lynx',
		name: 'Œil de lynx',
		icon: '🐈',
		passive: true,
		target: 'none',
		text: 'Tu vises le point faible sans même y penser : chaque flèche qui touche a 1 chance sur 5 d’être un coup critique (dégâts doublés).',
	}),
	'pointes-trempees': A({
		id: 'pointes-trempees',
		name: 'Pointes trempées',
		icon: '🌿',
		passive: true,
		target: 'none',
		text: 'Tes pointes de flèche sont trempées dans des sucs de la forêt : chaque flèche qui touche a 1 chance sur 4 d’aveugler la créature (elle rate un coup sur deux pendant 2 tours) et 1 chance sur 4 de la bâillonner (pas de sort pendant 2 tours).',
	}),

	/* ---- Mage : la magie des runes ---- */
	'projectiles-runes': A({
		id: 'projectiles-runes', range: 4,
		name: 'Projectiles runiques',
		icon: '✴️',
		target: 'foe',
		stat: 'esprit',
		damage: 2,
		spell: true,
		text: 'Trois petites runes violettes filent du bout de tes doigts : 2 PV.',
	}),
	'rune-eclat': A({
		id: 'rune-eclat', range: 4,
		name: 'Rune d’éclat',
		icon: '💠',
		target: 'foe',
		damage: 2,
		brumeBonus: true,
		spell: true,
		every: 3,
		text: 'Une rune qui ne rate jamais, sans dé : 2 PV, et 4 PV contre une créature de brume (la magie pure déchire la brume).',
	}),
	'rune-ricochet': A({
		id: 'rune-ricochet', range: 4,
		name: 'Rune ricochet',
		icon: '🪬',
		target: 'foe',
		stat: 'esprit',
		damage: 2,
		chain: { jumps: 2, reach: 2 },
		spell: true,
		every: 3,
		text: 'Une rune frappe une créature puis rebondit sur 2 autres proches d’elle : 2 PV chacune.',
	}),
	'orbe-runique': A({
		id: 'orbe-runique', range: 4, area: true,
		name: 'Orbe runique',
		icon: '🔮',
		target: 'foe',
		stat: 'esprit',
		damage: 2,
		spell: true,
		every: 3,
		text: 'Une boule de runes tourbillonnantes éclate sur une créature et sur celles collées à elle : 2 PV chacune.',
	}),
	deflagration: A({
		id: 'deflagration', range: 1,
		name: 'Déflagration runique',
		icon: '💥',
		target: 'all',
		stat: 'esprit',
		damage: 2,
		push: true,
		spell: true,
		every: 2,
		text: 'Un cercle de runes explose autour de toi : toutes les créatures collées à toi perdent 2 PV et sont repoussées d’une case.',
	}),

	echo: A({
		id: 'echo',
		name: 'Écho',
		icon: '🔁',
		passive: true,
		target: 'none',
		text: 'Ta magie résonne : chaque sort a 1 chance sur 4 de pouvoir repartir aussitôt, gratuitement et sans dé, sur la cible de ton choix (un chant repart tout seul).',
	}),
	'boule-de-neige': A({
		id: 'boule-de-neige',
		name: 'Boule de neige',
		icon: '❄️',
		passive: true,
		target: 'none',
		text: 'Tes sorts d’attaque grossissent en roulant : 15 % de chance de rebondir sur une autre créature proche (2 cases), et de rebondir encore, avec la même chance.',
	}),
	'folie-mage': A({
		id: 'folie-mage',
		name: 'Folie',
		icon: '🌀',
		passive: true,
		target: 'none',
		text: 'Tes runes embrouillent les esprits : chaque créature touchée par un sort a 15 % de chance de devenir folle et de passer ses 2 prochains tours (1 seul pour un gros monstre seul).',
	}),

	/* ---- Barde : magie et contrôle ---- */
	'bouclier-lune': A({
		id: 'bouclier-lune', range: 4,
		name: 'Bouclier de lune',
		icon: '🌕',
		target: 'ally',
		self: true,
		shield: 2,
		spell: true,
		every: 3,
		text: 'Une bulle argentée entoure un compagnon (ou toi) : elle absorbe les 2 prochains dégâts.',
	}),
	berceuse: A({
		id: 'berceuse', range: 4,
		name: 'Berceuse',
		icon: '😴',
		target: 'foe',
		stat: 'charme',
		stun: { kind: 'sommeil', turns: 1 },
		spell: true,
		every: 3,
		text: 'La créature s’endort et passe son prochain tour.',
	}),
	'air-guerison': A({
		id: 'air-guerison', range: 4,
		name: 'Air de guérison',
		icon: '💚',
		target: 'ally',
		self: true,
		heal: 5,
		revive: true,
		spell: true,
		every: 2,
		text: 'Une mélodie douce referme les blessures d’un compagnon (ou les tiennes) : +5 PV. Elle relève même un compagnon KO !',
	}),
	chant: A({
		id: 'chant',
		name: 'Chant de courage',
		icon: '🎶',
		target: 'party',
		heal: 2,
		cleanse: true,
		spell: true,
		every: 4,
		text: 'Tout le groupe récupère 2 PV, et la mélodie claire chasse les maux : poison, brûlure et froid s’en vont.',
	}),
	melodie: A({
		id: 'melodie',
		name: 'Mélodie apaisante',
		icon: '🎵',
		target: 'party',
		regen: { amount: 1, turns: 3 },
		spell: true,
		every: 3,
		text: 'Une mélodie douce qui ne s’arrête plus : pendant 3 tours, chaque compagnon (et toi) reprend 1 PV au début de son tour.',
	}),
	'coeur-vaillant': A({
		id: 'coeur-vaillant',
		name: 'Cœur vaillant',
		icon: '💛',
		passive: true,
		target: 'none',
		text: 'Ta musique met du baume au cœur : chaque fois que tu joues un sort, 1 chance sur 4 que tout le groupe reprenne courage (+2 PV pour chacun).',
	}),
	'note-purete': A({
		id: 'note-purete',
		name: 'Note de pureté',
		icon: '🤍',
		passive: true,
		target: 'none',
		text: 'Une note si pure qu’elle protège : chaque fois que tu joues un sort, 15 % de chance de poser un petit bouclier (2) sur le compagnon le plus blessé.',
	}),
	ronde: A({
		id: 'ronde', range: 4,
		name: 'Ronde enchantée',
		icon: '💫',
		target: 'hex',
		barrier: true,
		spell: true,
		every: 4,
		text: 'Tu joues un air de danse : des notes dorées tournent autour de la case choisie et des 6 cases voisines, de plus en plus vite, jusqu’à former un mur. Jusqu’à ton prochain tour, rien ne le traverse : ni les pas, ni les coups, ni les sorts. Ceux qui sont dedans y restent, ceux de dehors sont à l’abri.',
	}),
};

/** Le délai d'une compétence, en texte : « 1 tour sur 3 ». */
export const everyText = (ab: Ability) => (ab.every ? `1 tour sur ${ab.every}` : '');

export interface ClassDef {
	id: ClassId;
	name: string;
	/** Nom accordé : héroïne (f) ou héros (m). */
	names: Record<Gender, string>;
	tagline: string;
	/** Caractéristique principale (affichage). */
	stat: StatKey;
	/** Bonus de classe ajoutés aux dés de création. */
	bonus: Partial<Stats>;
	/** PV en plus. */
	pvBonus: number;
	/** Armure : elle prend les coups avant les PV, et se répare à chaque combat. */
	armor: number;
	/** Menace : ce qu'il fait énerve les monstres davantage (guerrier : son aura ; cœur-sauvage : sa fureur se voit de loin). */
	threat?: number;
	/** Points de mouvement : cases parcourues par tour. */
	move: number;
	/** Actions en combat. */
	abilities: AbilityId[];
	/** Pouvoir hors combat, rechargé au repos. */
	power: { name: string; text: string };
	kit: string[];
}

export const CLASSES: Record<ClassId, ClassDef> = {
	guerrier: {
		id: 'guerrier',
		name: 'Guerrier·ère',
		names: { f: 'Guerrière', m: 'Guerrier' },
		tagline: 'Un bouclier cabossé, un cœur solide.',
		stat: 'force',
		bonus: { force: 1, endurance: 2 },
		pvBonus: 3,
		armor: 4,
		threat: 1.5,
		move: 2,
		abilities: ['frapper', 'coup-assommant', 'mur-boucliers', 'onde-de-choc', 'cri-de-rage', 'intervention', 'aura', 'encaisseur', 'oeil-pour-oeil'],
		power: { name: 'Le rempart', text: 'Le plus solide du groupe : +2 Endurance, +3 PV et 4 points d’armure. En combat, il attire les coups, les renvoie (Œil pour œil) et se jette devant ses amis pour les protéger.' },
		kit: ['Épée courte', 'Bouclier cabossé', 'Gourde'],
	},
	danseur: {
		id: 'danseur',
		name: 'Cœur-sauvage',
		names: { f: 'Cœur-sauvage', m: 'Cœur-sauvage' },
		tagline: 'Deux haches, un grand sourire, et la fureur au fond des yeux.',
		stat: 'agilite',
		bonus: { agilite: 2, initiative: 1 },
		pvBonus: 0,
		armor: 0,
		threat: 1.7,
		move: 4,
		abilities: ['double-attaque', 'revers-sauvage', 'fureur-ours', 'tourbillon', 'moquerie', 'folie', 'coeur-battant'],
		power: { name: 'Ambidextre', text: 'Une hache dans chaque main : beaucoup de dégâts, mais rien qu’une fourrure sur le dos. Il faut frapper vite, avant d’être touché.' },
		kit: ['Deux haches de guerre', 'Manteau de fourrure', 'Pot de peinture de guerre'],
	},
	rodeur: {
		id: 'rodeur',
		name: 'Rôdeur·se',
		names: { f: 'Rôdeuse', m: 'Rôdeur' },
		tagline: 'Les sentiers n’ont pas de secret pour toi.',
		stat: 'agilite',
		bonus: { agilite: 1, force: 1, initiative: 2 },
		pvBonus: 1,
		armor: 1,
		move: 3,
		abilities: ['tir', 'salve', 'filet', 'fleche-empoisonnee', 'pieges', 'pointes-trempees', 'plaie-beante', 'oeil-de-lynx'],
		power: { name: 'Seconde chance', text: 'Après un dé raté (le tien ou celui d’un ami), tu peux le relancer. Rechargé au repos.' },
		kit: ['Arc et flèches', 'Cape de laine', 'Silex'],
	},
	mage: {
		id: 'mage',
		name: 'Mage',
		names: { f: 'Mage', m: 'Mage' },
		tagline: 'Des runes violettes qui s’allument au bout des doigts.',
		stat: 'esprit',
		bonus: { esprit: 2 },
		pvBonus: 0,
		armor: 0,
		move: 2,
		abilities: ['projectiles-runes', 'rune-eclat', 'rune-ricochet', 'orbe-runique', 'deflagration', 'echo', 'boule-de-neige', 'folie-mage'],
		power: { name: 'La magie des runes', text: 'Projectiles runiques à volonté ; Rune d’éclat, Rune ricochet et Orbe runique un tour sur trois, Déflagration runique un tour sur deux.' },
		kit: ['Bâton noueux', 'Grimoire de runes', 'Craie violette'],
	},
	barde: {
		id: 'barde',
		name: 'Barde',
		names: { f: 'Barde', m: 'Barde' },
		tagline: 'Ta musique réchauffe les cœurs gelés.',
		stat: 'charme',
		bonus: { charme: 1, esprit: 1 },
		pvBonus: 0,
		armor: 0,
		move: 3,
		abilities: ['air-guerison', 'bouclier-lune', 'berceuse', 'chant', 'ronde', 'melodie', 'echo', 'coeur-vaillant', 'note-purete'],
		power: { name: 'Chant de courage', text: 'Hors combat : tout le groupe récupère 2 PV. Rechargé au repos.' },
		kit: ['Luth de voyage', 'Dague', 'Carnet de chansons'],
	},
};

export const CLASS_LIST = Object.values(CLASSES);

/** Un dé à 6 faces. */
export function rollD6(): number {
	return 1 + Math.floor(Math.random() * 6);
}

/** Valeur d'une caractéristique à la création : un 1 compte comme un 2. */
export function statFromDie(die: number): number {
	return Math.max(2, die);
}

export function levelFromXp(xp: number): number {
	return 1 + Math.floor(xp / 10);
}

/** Initiative d'un héros (on y ajoute un dé au début du combat). */
export function initiativeOf(c: Character): number {
	return c.stats.initiative;
}

export function computePvMax(stats: Stats, xp: number, classId?: ClassId): number {
	return 6 + (stats.endurance ?? stats.force) + 2 * (levelFromXp(xp) - 1) + (classId ? CLASSES[classId].pvBonus : 0);
}

/** Ancien bonus d'initiative des classes, ajouté à l'Agilité avant que l'Initiative soit une caractéristique. */
const LEGACY_INITIATIVE: Partial<Record<ClassId, number>> = { danseur: 1, rodeur: 2 };

/**
 * Les héros créés avant certaines caractéristiques ne les ont pas : on les déduit de ce qui en tenait lieu.
 * - Endurance : leur Force (c'est elle qui donnait leurs PV) ;
 * - Initiative : leur Agilité + l'ancien bonus de classe (le même ordre de jeu qu'avant).
 */
export function withStats(c: Character): Character {
	const s = c.stats as Partial<Stats> & Pick<Stats, 'force' | 'agilite' | 'esprit' | 'charme'>;
	if (typeof s.endurance === 'number' && typeof s.initiative === 'number') return c;
	return {
		...c,
		stats: {
			...c.stats,
			endurance: s.endurance ?? s.force,
			initiative: s.initiative ?? s.agilite + (LEGACY_INITIATIVE[c.classId] ?? 0),
		},
	};
}

export function finalStats(classId: ClassId, base: Stats): Stats {
	const stats = { ...base };
	for (const [k, v] of Object.entries(CLASSES[classId].bonus) as [StatKey, number][]) stats[k] += v;
	return stats;
}

/** Bonus d'initiative du monstre selon sa difficulté (les héros ajoutent leur Initiative). */
export const ENEMY_INITIATIVE: Record<Difficulty, number> = { facile: 2, moyen: 4, difficile: 5 };

export function makeCharacter(input: {
	id: string;
	name: string;
	player: string;
	gender?: Gender;
	classId: ClassId;
	base: Stats;
	rolls: number[];
}): Character {
	const stats = finalStats(input.classId, input.base);
	const pvMax = computePvMax(stats, 0, input.classId);
	return {
		id: input.id,
		name: input.name.trim() || 'Héros sans nom',
		player: input.player.trim(),
		...(input.gender ? { gender: input.gender } : {}),
		classId: input.classId,
		stats,
		pvMax,
		pv: pvMax,
		xp: 0,
		powerReady: true,
		kit: [...CLASSES[input.classId].kit],
		rolls: input.rolls,
		notes: '',
	};
}

export interface RollResult {
	die: number;
	stat: number;
	total: number;
	target: number;
	success: boolean;
	lucky: boolean;
}

export function evaluateRoll(die: number, stat: number, difficulty: Difficulty, harder = 0): RollResult {
	const target = DIFFICULTY[difficulty].target + harder;
	const total = die + stat;
	const lucky = die === 6;
	return { die, stat, total, target, lucky, success: lucky || total >= target };
}

/** Nom de la classe accordé au genre du héros : « Guerrière », « Rôdeur »… (neutre si non précisé). */
export function className(c: { classId: ClassId; gender?: Gender }): string {
	const cls = CLASSES[c.classId];
	return c.gender ? cls.names[c.gender] : cls.name;
}

/** « la guerrière », « le rôdeur », « la mage »… */
export function classWithArticle(c: { classId: ClassId; gender?: Gender }): string {
	const n = className(c).toLowerCase();
	if (!c.gender) return n;
	return `${c.gender === 'f' ? 'la' : 'le'} ${n}`;
}

/** Identifiant du portrait de classe : classe-guerrier-f, classe-mage-m… */
export function classPortrait(c: { classId: ClassId; gender?: Gender }): string {
	return `classe-${c.classId}-${c.gender ?? 'f'}`;
}
