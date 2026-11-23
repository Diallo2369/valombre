import type { Character, ClassId, Difficulty, Gender, StatKey, Stats } from './types';

/**
 * Règles « Valombre » pensées pour une première initiation :
 * - 5 caractéristiques, tirées chacune avec 1 dé à 6 faces (un 1 compte comme 2) ;
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
];

export const STAT_LABEL: Record<StatKey, string> = {
	force: 'Force',
	agilite: 'Agilité',
	endurance: 'Endurance',
	esprit: 'Esprit',
	charme: 'Charme',
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
	| 'aura'
	// Danseur de guerre
	| 'double-attaque'
	| 'moquerie'
	| 'tourbillon'
	| 'ambidextrie'
	| 'folie'
	// Rôdeur
	| 'tir'
	| 'fleche-visee'
	| 'salve'
	| 'filet'
	| 'fleche-empoisonnee'
	// Mage
	| 'trait-lumiere'
	| 'etincelle'
	| 'pluie-etoiles'
	| 'bouclier-lune'
	| 'lueur'
	// Barde
	| 'note-percante'
	| 'berceuse'
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
	/** Pour `foes` : nombre maximal de créatures touchées. */
	maxTargets?: number;
	/** Pour `ally` : le héros peut se choisir lui-même. */
	self?: boolean;
	/** Caractéristique du jet ; sans `stat`, pas de dé (ça marche à tous les coups). */
	stat?: StatKey;
	/** Plus dur à réussir : s'ajoute au score à atteindre. */
	harder?: number;
	/** Dégâts si ça touche, en demi-cœurs (2 = 1 ♥). */
	damage?: number;
	/** Second coup, de l'autre main (Ambidextrie), en demi-cœurs. */
	offhand?: number;
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
	/** PV rendus à tout le groupe. */
	heal?: number;
	/** Bouclier posé sur un compagnon (dégâts absorbés). */
	shield?: number;
	/** Enlève les maux (poison, brûlure…) du groupe. */
	cleanse?: boolean;
	spell?: boolean;
	/** Une seule fois par combat. */
	perCombat?: boolean;
}

const A = (a: Ability) => a;

export const ABILITIES: Record<AbilityId, Ability> = {
	/* ---- Guerrier : le rempart ---- */
	frapper: A({ id: 'frapper', range: 1, name: 'Frapper', icon: '⚔️', target: 'foe', stat: 'force', damage: 2, text: 'Un bon coup d’épée : 1 ♥.' }),
	'coup-assommant': A({
		id: 'coup-assommant', range: 1,
		name: 'Coup assommant',
		icon: '💫',
		target: 'foe',
		stat: 'force',
		damage: 2,
		stun: { kind: 'assomme', turns: 1 },
		perCombat: true,
		text: 'Un coup de pommeau sur le crâne : 1 ♥, et la créature, sonnée, passe son prochain tour.',
	}),
	taillade: A({
		id: 'taillade', range: 1,
		name: 'Taillade',
		icon: '🌙',
		target: 'foes',
		maxTargets: 3,
		stat: 'force',
		damage: 2,
		perCombat: true,
		text: 'Un grand revers d’épée : jusqu’à 3 créatures collées à toi perdent 1 ♥.',
	}),
	intervention: A({
		id: 'intervention', range: 1,
		name: 'Intervention',
		icon: '🛡️',
		target: 'ally',
		protect: true,
		text: 'Défendre un compagnon collé à toi : jusqu’à ton prochain tour, les coups qui le visent sont pour toi, avec 1 dégât de moins.',
	}),
	aura: A({
		id: 'aura',
		name: 'Aura de bataille',
		icon: '🔱',
		passive: true,
		target: 'none',
		text: 'Les monstres ont bien du mal à résister à l’envie de t’attaquer, toi plutôt que tes amis (sauf ceux qu’on a provoqués).',
	}),

	/* ---- Danseur de guerre : deux haches, pas d'armure ---- */
	'double-attaque': A({
		id: 'double-attaque', range: 1,
		name: 'Double attaque',
		icon: '🪓',
		target: 'foe',
		stat: 'agilite',
		damage: 2,
		offhand: 1,
		text: 'Une hache, puis l’autre : 1 ♥ et encore ½ ♥ si ça touche.',
	}),
	moquerie: A({
		id: 'moquerie', range: 4,
		name: 'Moquerie',
		icon: '😜',
		target: 'foe',
		taunt: true,
		text: 'Tu nargues une créature : elle ne pense plus qu’à toi et t’attaquera à son prochain tour (même l’aura du guerrier n’y peut rien).',
	}),
	tourbillon: A({
		id: 'tourbillon', range: 1,
		name: 'Tourbillon',
		icon: '🌀',
		target: 'all',
		stat: 'agilite',
		damage: 2,
		offhand: 1,
		perCombat: true,
		text: 'Les deux haches tournoient : toutes les créatures collées à toi perdent 1 ♥ ½.',
	}),
	ambidextrie: A({
		id: 'ambidextrie',
		name: 'Ambidextrie',
		icon: '✋',
		passive: true,
		target: 'none',
		text: 'Une hache dans chaque main : chaque attaque frappe deux fois, le second coup un peu moins fort (½ ♥).',
	}),
	folie: A({
		id: 'folie',
		name: 'Folie vengeresse',
		icon: '🔥',
		passive: true,
		target: 'none',
		text: 'Quand tu reçois un coup, la fureur monte : ta prochaine attaque est un coup critique (dégâts doublés).',
	}),

	/* ---- Rôdeur : à distance ---- */
	tir: A({ id: 'tir', range: 5, name: 'Tir à l’arc', icon: '🏹', target: 'foe', stat: 'agilite', damage: 2, text: 'Une flèche bien ajustée, de loin : 1 ♥.' }),
	'fleche-visee': A({
		id: 'fleche-visee', range: 5,
		name: 'Flèche visée',
		icon: '🎯',
		target: 'foe',
		stat: 'agilite',
		harder: 2,
		damage: 2,
		crit: true,
		text: 'Prendre le temps de viser le point faible : plus dur à réussir (+2), mais coup critique : 2 ♥.',
	}),
	salve: A({
		id: 'salve', range: 5,
		name: 'Salve',
		icon: '🎆',
		target: 'foes',
		maxTargets: 3,
		stat: 'agilite',
		damage: 2,
		perCombat: true,
		text: 'Trois flèches d’affilée : jusqu’à 3 créatures à portée perdent 1 ♥.',
	}),
	filet: A({
		id: 'filet', range: 4,
		name: 'Filet',
		icon: '🕸️',
		target: 'foe',
		stat: 'agilite',
		stun: { kind: 'filet', turns: 2 },
		perCombat: true,
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
		perCombat: true,
		text: '1 ♥, puis le poison ronge la créature : ½ ♥ à chacun de ses 3 prochains tours.',
	}),

	/* ---- Mage ---- */
	'trait-lumiere': A({
		id: 'trait-lumiere', range: 4,
		name: 'Trait de lumière',
		icon: '✨',
		target: 'foe',
		stat: 'esprit',
		damage: 2,
		spell: true,
		text: 'Un rayon de lumière jaillit du bâton : 1 ♥.',
	}),
	etincelle: A({
		id: 'etincelle', range: 4,
		name: 'Étincelle d’aube',
		icon: '☀️',
		target: 'foe',
		damage: 2,
		brumeBonus: true,
		spell: true,
		perCombat: true,
		text: 'Touche à coup sûr, sans dé : 1 ♥, et 2 ♥ contre une créature de brume. Une fois par combat.',
	}),
	'pluie-etoiles': A({
		id: 'pluie-etoiles', range: 4, area: true,
		name: 'Pluie d’étoiles',
		icon: '🌠',
		target: 'foe',
		stat: 'esprit',
		damage: 2,
		spell: true,
		perCombat: true,
		text: 'Des étoiles filantes tombent sur une créature et sur celles collées à elle : 1 ♥ chacune.',
	}),
	'bouclier-lune': A({
		id: 'bouclier-lune', range: 4,
		name: 'Bouclier de lune',
		icon: '🌕',
		target: 'ally',
		self: true,
		shield: 2,
		spell: true,
		perCombat: true,
		text: 'Une bulle argentée entoure un compagnon (ou toi) : elle absorbe les 2 prochains dégâts.',
	}),
	lueur: A({
		id: 'lueur', range: 4,
		name: 'Lueur aveuglante',
		icon: '🔆',
		target: 'foe',
		stat: 'esprit',
		blind: 2,
		spell: true,
		text: 'Un éclair blanc dans les yeux : pendant 2 tours, les coups de la créature font 1 dégât de moins.',
	}),

	/* ---- Barde : magie et contrôle ---- */
	'note-percante': A({
		id: 'note-percante', range: 4,
		name: 'Note perçante',
		icon: '🎵',
		target: 'foe',
		stat: 'charme',
		damage: 2,
		spell: true,
		text: 'Une note magique si aiguë qu’elle fait mal aux oreilles : 1 ♥.',
	}),
	berceuse: A({
		id: 'berceuse', range: 4,
		name: 'Berceuse',
		icon: '😴',
		target: 'foe',
		stat: 'charme',
		stun: { kind: 'sommeil', turns: 1 },
		spell: true,
		perCombat: true,
		text: 'La créature s’endort et passe son prochain tour.',
	}),
	chant: A({
		id: 'chant',
		name: 'Chant de courage',
		icon: '🎶',
		target: 'party',
		heal: 2,
		spell: true,
		perCombat: true,
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

/** Demi-cœurs en texte : 1 → « ½ ♥ », 3 → « 1 ♥ ½ ». */
export function heartsText(half: number): string {
	const full = Math.floor(half / 2);
	const rest = half % 2;
	if (!full) return '½ ♥';
	return `${full} ♥${rest ? ' ½' : ''}`;
}

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
	/** Bonus d'initiative (ajouté au dé et à l'Agilité au début du combat). */
	initiative: number;
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
		initiative: 0,
		move: 2,
		aggro: 'force',
		abilities: ['frapper', 'coup-assommant', 'taillade', 'intervention', 'aura'],
		power: { name: 'Le rempart', text: 'Le plus solide du groupe : +2 Endurance, +2 PV et 3 points d’armure. En combat, il s’interpose pour protéger ses amis.' },
		kit: ['Épée courte', 'Bouclier cabossé', 'Gourde'],
	},
	danseur: {
		id: 'danseur',
		name: 'Danseur·se de guerre',
		names: { f: 'Danseuse de guerre', m: 'Danseur de guerre' },
		tagline: 'Deux haches, un grand sourire, et la fureur au fond des yeux.',
		stat: 'agilite',
		bonus: { agilite: 2 },
		pvBonus: 1,
		armor: 0,
		initiative: 1,
		move: 4,
		aggro: 'charme',
		abilities: ['double-attaque', 'moquerie', 'tourbillon', 'ambidextrie', 'folie'],
		power: { name: 'Ambidextre', text: 'Une hache dans chaque main : beaucoup de dégâts, mais rien qu’une fourrure sur le dos. Il faut frapper vite, avant d’être touché.' },
		kit: ['Deux haches de guerre', 'Manteau de fourrure', 'Pot de peinture de guerre'],
	},
	rodeur: {
		id: 'rodeur',
		name: 'Rôdeur·se',
		names: { f: 'Rôdeuse', m: 'Rôdeur' },
		tagline: 'Les sentiers n’ont pas de secret pour toi.',
		stat: 'agilite',
		bonus: { agilite: 1, force: 1 },
		pvBonus: 1,
		armor: 1,
		initiative: 2,
		move: 3,
		abilities: ['tir', 'fleche-visee', 'salve', 'filet', 'fleche-empoisonnee'],
		power: { name: 'Seconde chance', text: 'Après un dé raté (le tien ou celui d’un ami), tu peux le relancer. Rechargé au repos.' },
		kit: ['Arc et flèches', 'Cape de laine', 'Silex'],
	},
	mage: {
		id: 'mage',
		name: 'Mage',
		names: { f: 'Mage', m: 'Mage' },
		tagline: 'Une étincelle d’aube au creux de la main.',
		stat: 'esprit',
		bonus: { esprit: 2 },
		pvBonus: 0,
		armor: 0,
		initiative: 0,
		move: 2,
		abilities: ['trait-lumiere', 'etincelle', 'pluie-etoiles', 'bouclier-lune', 'lueur'],
		power: { name: 'Cinq sorts', text: 'Trait de lumière et Lueur aveuglante à volonté ; Étincelle d’aube, Pluie d’étoiles et Bouclier de lune une fois par combat.' },
		kit: ['Bâton noueux', 'Grimoire écorné', 'Bougie'],
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
		initiative: 0,
		move: 3,
		abilities: ['note-percante', 'berceuse', 'chant', 'delivrance'],
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

/** Initiative d'un héros : Agilité + bonus de classe (on y ajoute un dé au début du combat). */
export function initiativeOf(c: Character): number {
	return c.stats.agilite + CLASSES[c.classId].initiative;
}

export function computePvMax(stats: Stats, xp: number, classId?: ClassId): number {
	return 6 + (stats.endurance ?? stats.force) + 2 * (levelFromXp(xp) - 1) + (classId ? CLASSES[classId].pvBonus : 0);
}

/**
 * Les héros créés avant l'Endurance n'en ont pas : on reprend leur Force (c'est elle qui donnait leurs PV).
 */
export function withEndurance(c: Character): Character {
	if (typeof c.stats.endurance === 'number') return c;
	return { ...c, stats: { ...c.stats, endurance: c.stats.force } };
}

export function finalStats(classId: ClassId, base: Stats): Stats {
	const stats = { ...base };
	for (const [k, v] of Object.entries(CLASSES[classId].bonus) as [StatKey, number][]) stats[k] += v;
	return stats;
}

/** Bonus d'initiative du monstre selon sa difficulté (les héros ajoutent leur Agilité). */
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
