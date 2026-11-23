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
	| 'taillade'
	| 'intervention'
	| 'oeil-pour-oeil'
	| 'aura'
	// Virevolteur
	| 'double-attaque'
	| 'moquerie'
	| 'tourbillon'
	| 'fureur-ours'
	| 'bond'
	| 'ambidextrie'
	| 'folie'
	// Rôdeur
	| 'tir'
	| 'salve'
	| 'filet'
	| 'fleche-empoisonnee'
	| 'fleche-aveuglante'
	// Mage : la magie des runes
	| 'projectiles-runes'
	| 'rune-eclat'
	| 'rune-ricochet'
	| 'orbe-runique'
	| 'deflagration'
	// Barde
	| 'bouclier-lune'
	| 'berceuse'
	| 'air-guerison'
	| 'chant'
	| 'delivrance';

/** Qui l'action vise : une créature, plusieurs, toutes ; un compagnon ; le groupe ; personne. */
export type AbilityTarget = 'foe' | 'foes' | 'all' | 'ally' | 'party' | 'none';

export interface Ability {
	id: AbilityId;
	name: string;
	icon: string;
	text: string;
	/** Capacité passive : toujours active, pas un bouton. */
	passive?: boolean;
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
	/** Caractéristique du jet ; sans `stat`, pas de dé (ça marche à tous les coups). */
	stat?: StatKey;
	/** Plus dur à réussir : s'ajoute au score à atteindre. */
	harder?: number;
	/** Dégâts si ça touche, en PV. */
	damage?: number;
	/** Second coup, de l'autre main (Ambidextrie), en PV. */
	offhand?: number;
	/** PV que le héros récupère si ça touche (Fureur de l'ours). */
	lifesteal?: number;
	/** Bondit jusqu'à la cible (sur une case libre collée à elle) avant de frapper (Bond sauvage). */
	leap?: boolean;
	/** Repousse d'une case les créatures touchées, loin du héros (Déflagration runique). */
	push?: boolean;
	/**
	 * Œil pour œil : jusqu'au prochain tour du héros, chaque créature qui le frappe reçoit `damage` PV en retour,
	 * avec `stunChance` d'être assommée ; les créatures à `provoke` cases ou moins sont provoquées.
	 */
	riposte?: { damage: number; stunChance: number; provoke: number };
	/** Coup critique : dégâts doublés. */
	crit?: boolean;
	/** Dégâts doublés contre une créature de brume. */
	brumeBonus?: boolean;
	/** États posés sur la créature touchée. */
	stun?: { kind: 'assomme' | 'filet' | 'sommeil'; turns: number };
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
	frapper: A({ id: 'frapper', range: 1, name: 'Frapper', icon: '⚔️', target: 'foe', stat: 'force', damage: 2, text: 'Un bon coup d’épée : 2 PV.' }),
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
	taillade: A({
		id: 'taillade', range: 1,
		name: 'Taillade',
		icon: '🌙',
		target: 'foes',
		maxTargets: 3,
		stat: 'force',
		damage: 2,
		every: 3,
		text: 'Un grand revers d’épée : jusqu’à 3 créatures collées à toi perdent 2 PV.',
	}),
	intervention: A({
		id: 'intervention', range: 1,
		name: 'Intervention',
		icon: '🛡️',
		target: 'ally',
		protect: true,
		text: 'Défendre un compagnon collé à toi : jusqu’à ton prochain tour, les coups qui le visent sont pour toi, avec 1 dégât de moins.',
	}),
	'oeil-pour-oeil': A({
		id: 'oeil-pour-oeil',
		name: 'Œil pour œil',
		icon: '👁️',
		target: 'none',
		riposte: { damage: 2, stunChance: 0.25, provoke: 2 },
		every: 3,
		text: 'Tu lèves ton bouclier et tu défies tout le monde : les créatures à 2 cases ou moins ne pensent plus qu’à toi. Jusqu’à ton prochain tour, chaque créature qui te frappe reçoit 2 PV en retour, et 1 fois sur 4 elle est assommée.',
	}),
	aura: A({
		id: 'aura',
		name: 'Aura de bataille',
		icon: '🔱',
		passive: true,
		target: 'none',
		text: 'Les monstres ont bien du mal à résister à l’envie de t’attaquer, toi plutôt que tes amis (sauf ceux qu’on a provoqués).',
	}),

	/* ---- Virevolteur : deux haches, pas d'armure ---- */
	'double-attaque': A({
		id: 'double-attaque', range: 1,
		name: 'Double attaque',
		icon: '🪓',
		target: 'foe',
		stat: 'agilite',
		damage: 2,
		offhand: 2,
		text: 'Une hache, puis l’autre : 2 PV + 2 PV.',
	}),
	moquerie: A({
		id: 'moquerie', range: 4,
		name: 'Moquerie',
		icon: '😜',
		target: 'foe',
		taunt: true,
		every: 3,
		text: 'Tu nargues une créature : elle ne pense plus qu’à toi et t’attaquera à son prochain tour (même l’aura du guerrier n’y peut rien). Attention : sans armure, ça peut faire très mal.',
	}),
	'fureur-ours': A({
		id: 'fureur-ours', range: 1,
		name: 'Fureur de l’ours',
		icon: '🐻',
		target: 'foe',
		stat: 'agilite',
		damage: 2,
		offhand: 2,
		lifesteal: 3,
		every: 2,
		text: 'La rage de l’ours te porte : 2 PV + 2 PV, et si ça touche tu récupères 3 PV.',
	}),
	bond: A({
		id: 'bond', range: 3,
		name: 'Bond sauvage',
		icon: '🐾',
		target: 'foe',
		stat: 'agilite',
		damage: 2,
		offhand: 2,
		leap: true,
		every: 2,
		text: 'Tu bondis sur une créature jusqu’à 3 cases (tu atterris collé à elle) et tu frappes des deux haches : 2 PV + 2 PV.',
	}),
	tourbillon: A({
		id: 'tourbillon', range: 1,
		name: 'Tourbillon',
		icon: '🌀',
		target: 'all',
		stat: 'agilite',
		damage: 2,
		offhand: 2,
		every: 2,
		text: 'Les deux haches tournoient : toutes les créatures collées à toi perdent 2 PV + 2 PV.',
	}),
	ambidextrie: A({
		id: 'ambidextrie',
		name: 'Ambidextrie',
		icon: '✋',
		passive: true,
		target: 'none',
		text: 'Une hache dans chaque main : chaque attaque frappe deux fois, aussi fort d’une main que de l’autre.',
	}),
	folie: A({
		id: 'folie',
		name: 'Folie vengeresse',
		icon: '🔥',
		passive: true,
		target: 'none',
		text: 'Quand tu reçois un coup, la fureur monte : ta prochaine attaque est un coup critique (les deux haches font double dégâts, même en Tourbillon).',
	}),

	/* ---- Rôdeur : à distance ---- */
	tir: A({ id: 'tir', range: 5, name: 'Tir à l’arc', icon: '🏹', target: 'foe', stat: 'agilite', damage: 2, text: 'Une flèche bien ajustée, de loin : 2 PV.' }),
	salve: A({
		id: 'salve', range: 5,
		name: 'Salve',
		icon: '🎆',
		target: 'foes',
		maxTargets: 3,
		stat: 'agilite',
		damage: 2,
		every: 3,
		text: 'Trois flèches d’affilée : jusqu’à 3 créatures à portée perdent 2 PV.',
	}),
	filet: A({
		id: 'filet', range: 4,
		name: 'Filet',
		icon: '🕸️',
		target: 'foe',
		stat: 'agilite',
		stun: { kind: 'filet', turns: 2 },
		every: 3,
		text: 'Un filet lancé de loin : la créature, empêtrée, passe ses 2 prochains tours.',
	}),
	'fleche-empoisonnee': A({
		id: 'fleche-empoisonnee', range: 5,
		name: 'Flèche empoisonnée',
		icon: '🧪',
		target: 'foe',
		stat: 'agilite',
		damage: 2,
		poison: 3,
		every: 3,
		text: '2 PV, puis le poison ronge la créature : 1 PV à chacun de ses 3 prochains tours.',
	}),
	'fleche-aveuglante': A({
		id: 'fleche-aveuglante', range: 5,
		name: 'Flèche aveuglante',
		icon: '🌫️',
		target: 'foe',
		stat: 'agilite',
		damage: 1,
		blind: 2,
		poison: 2,
		every: 3,
		text: 'Une flèche trempée dans le suc piquant de l’herbe-aux-larmes : 1 PV, la créature pleure et n’y voit plus rien (elle rate un coup sur deux pendant 2 tours), et le poison la ronge (1 PV à ses 2 prochains tours).',
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
		spell: true,
		every: 2,
		text: 'Une mélodie douce referme les blessures d’un compagnon (ou les tiennes) : +5 PV.',
	}),
	chant: A({
		id: 'chant',
		name: 'Chant de courage',
		icon: '🎶',
		target: 'party',
		heal: 2,
		spell: true,
		every: 4,
		text: 'Tout le groupe récupère 2 PV.',
	}),
	delivrance: A({
		id: 'delivrance',
		name: 'Chant de délivrance',
		icon: '🕊️',
		target: 'party',
		cleanse: true,
		spell: true,
		text: 'Une mélodie claire qui chasse les maux : poison, brûlure et froid quittent tout le groupe.',
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
	/** Points de mouvement : cases parcourues par tour. */
	move: number;
	/** Capacité d'aggro : peut tenter de détourner un monstre vers lui (avec cette caractéristique). */
	aggro?: StatKey;
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
		pvBonus: 2,
		armor: 3,
		move: 2,
		aggro: 'force',
		abilities: ['frapper', 'coup-assommant', 'taillade', 'intervention', 'oeil-pour-oeil', 'aura'],
		power: { name: 'Le rempart', text: 'Le plus solide du groupe : +2 Endurance, +2 PV et 3 points d’armure. En combat, il attire les coups, les renvoie (Œil pour œil) et s’interpose pour protéger ses amis.' },
		kit: ['Épée courte', 'Bouclier cabossé', 'Gourde'],
	},
	danseur: {
		id: 'danseur',
		name: 'Virevolteur·se',
		names: { f: 'Virevolteuse', m: 'Virevolteur' },
		tagline: 'Deux haches, un grand sourire, et la fureur au fond des yeux.',
		stat: 'agilite',
		bonus: { agilite: 2, initiative: 1 },
		pvBonus: 1,
		armor: 0,
		move: 4,
		aggro: 'charme',
		abilities: ['double-attaque', 'bond', 'fureur-ours', 'tourbillon', 'moquerie', 'ambidextrie', 'folie'],
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
		abilities: ['tir', 'salve', 'filet', 'fleche-empoisonnee', 'fleche-aveuglante'],
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
		abilities: ['projectiles-runes', 'rune-eclat', 'rune-ricochet', 'orbe-runique', 'deflagration'],
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
		abilities: ['air-guerison', 'bouclier-lune', 'berceuse', 'chant', 'delivrance'],
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
