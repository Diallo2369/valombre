import type { Character, ClassId, Difficulty, Gender, StatKey, Stats } from './types';

/**
 * Règles « Valombre » pensées pour une première initiation :
 * - 4 caractéristiques, tirées chacune avec 1 dé à 6 faces (un 1 compte comme 2) ;
 * - +1 dans la caractéristique favorite de la classe ;
 * - un test = 1 dé + la caractéristique, à comparer à la difficulté ;
 * - un 6 naturel réussit toujours (« coup de chance ! ») ;
 * - personne ne meurt : à 0 PV, un héros est épuisé jusqu'au prochain soin.
 */

export const STATS: { key: StatKey; label: string; short: string; hint: string }[] = [
	{ key: 'force', label: 'Force', short: 'FOR', hint: 'Soulever, frapper fort, grimper à la corde.' },
	{ key: 'agilite', label: 'Agilité', short: 'AGI', hint: 'Courir, se cacher, viser, sauter.' },
	{ key: 'esprit', label: 'Esprit', short: 'ESP', hint: 'Observer, réfléchir, lancer un sort.' },
	{ key: 'charme', label: 'Charme', short: 'CHA', hint: 'Convaincre, rassurer, amadouer une bête.' },
];

export const STAT_LABEL: Record<StatKey, string> = {
	force: 'Force',
	agilite: 'Agilité',
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
	| 'frapper'
	| 'coup-puissant'
	| 'intervention'
	| 'tir'
	| 'corps-a-corps'
	| 'trait-lumiere'
	| 'etincelle'
	| 'note-percante'
	| 'berceuse'
	| 'chant';

export interface Ability {
	id: AbilityId;
	name: string;
	icon: string;
	text: string;
	/** Caractéristique du jet ; sans `stat`, pas de dé. */
	stat?: StatKey;
	/** Effet : toucher (1 cœur, 2 pour `hit2`), toucher à coup sûr, protéger, endormir, soigner. */
	effect: 'hit' | 'hit2' | 'sure' | 'guard' | 'sleep' | 'heal';
	spell?: boolean;
	/** Une seule fois par combat. */
	perCombat?: boolean;
}

export const ABILITIES: Record<AbilityId, Ability> = {
	frapper: { id: 'frapper', name: 'Frapper', icon: '⚔️', stat: 'force', effect: 'hit', text: 'Un bon coup d’épée.' },
	'coup-puissant': {
		id: 'coup-puissant',
		name: 'Coup puissant',
		icon: '💥',
		stat: 'force',
		effect: 'hit2',
		perCombat: true,
		text: 'Un coup de toutes ses forces : 2 cœurs d’un coup si ça touche. Une fois par combat.',
	},
	intervention: {
		id: 'intervention',
		name: 'Intervention',
		icon: '🛡️',
		effect: 'guard',
		text: 'Se ruer devant ses amis et provoquer le monstre : sa prochaine attaque est pour lui, et le bouclier en absorbe 1 dégât.',
	},
	tir: { id: 'tir', name: 'Tir à l’arc', icon: '🏹', stat: 'agilite', effect: 'hit', text: 'Une flèche bien ajustée, de loin.' },
	'corps-a-corps': { id: 'corps-a-corps', name: 'Corps à corps', icon: '🗡️', stat: 'force', effect: 'hit', text: 'Au contact, avec le couteau de chasse.' },
	'trait-lumiere': {
		id: 'trait-lumiere',
		name: 'Trait de lumière',
		icon: '✨',
		stat: 'esprit',
		effect: 'hit',
		spell: true,
		text: 'Un rayon de lumière jaillit du bâton.',
	},
	etincelle: {
		id: 'etincelle',
		name: 'Étincelle d’aube',
		icon: '☀️',
		effect: 'sure',
		spell: true,
		perCombat: true,
		text: 'Touche à coup sûr, sans dé ; 2 cœurs contre une créature de brume. Une fois par combat.',
	},
	'note-percante': {
		id: 'note-percante',
		name: 'Note perçante',
		icon: '🎵',
		stat: 'charme',
		effect: 'hit',
		spell: true,
		text: 'Une note magique si aiguë qu’elle fait mal aux oreilles du monstre.',
	},
	berceuse: {
		id: 'berceuse',
		name: 'Berceuse',
		icon: '🌙',
		stat: 'charme',
		effect: 'sleep',
		spell: true,
		perCombat: true,
		text: 'Le monstre s’endort et passe son prochain tour. Une fois par combat.',
	},
	chant: {
		id: 'chant',
		name: 'Chant de courage',
		icon: '🎶',
		effect: 'heal',
		spell: true,
		perCombat: true,
		text: 'Tout le groupe récupère 2 PV. Une fois par combat.',
	},
};

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
	/** PV en plus (endurance). */
	pvBonus: number;
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
		bonus: { force: 2 },
		pvBonus: 3,
		abilities: ['frapper', 'coup-puissant', 'intervention'],
		power: { name: 'Endurance', text: '+3 PV : le plus solide du groupe. En combat, il peut s’interposer pour protéger ses amis.' },
		kit: ['Épée courte', 'Bouclier cabossé', 'Gourde'],
	},
	rodeur: {
		id: 'rodeur',
		name: 'Rôdeur·se',
		names: { f: 'Rôdeuse', m: 'Rôdeur' },
		tagline: 'Les sentiers n’ont pas de secret pour toi.',
		stat: 'agilite',
		bonus: { agilite: 1, force: 1 },
		pvBonus: 1,
		abilities: ['tir', 'corps-a-corps'],
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
		abilities: ['trait-lumiere', 'etincelle'],
		power: { name: 'Deux sorts', text: 'Trait de lumière à volonté, et l’Étincelle d’aube qui touche à coup sûr, une fois par combat.' },
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
		abilities: ['note-percante', 'berceuse', 'chant'],
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

export function computePvMax(stats: Stats, xp: number, classId?: ClassId): number {
	return 6 + stats.force + 2 * (levelFromXp(xp) - 1) + (classId ? CLASSES[classId].pvBonus : 0);
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

export function evaluateRoll(die: number, stat: number, difficulty: Difficulty): RollResult {
	const target = DIFFICULTY[difficulty].target;
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
