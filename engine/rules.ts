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

export interface ClassDef {
	id: ClassId;
	name: string;
	/** Nom accordé : héroïne (f) ou héros (m). */
	names: Record<Gender, string>;
	tagline: string;
	stat: StatKey;
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
		power: { name: 'Coup puissant', text: 'En combat, une attaque réussie retire 2 cœurs à l’ennemi au lieu d’un.' },
		kit: ['Épée courte', 'Bouclier cabossé', 'Gourde'],
	},
	rodeur: {
		id: 'rodeur',
		name: 'Rôdeur·se',
		names: { f: 'Rôdeuse', m: 'Rôdeur' },
		tagline: 'Les sentiers n’ont pas de secret pour toi.',
		stat: 'agilite',
		power: { name: 'Seconde chance', text: 'Après un dé raté (le tien ou celui d’un ami), tu peux le relancer.' },
		kit: ['Arc et flèches', 'Cape de laine', 'Silex'],
	},
	mage: {
		id: 'mage',
		name: 'Mage',
		names: { f: 'Mage', m: 'Mage' },
		tagline: 'Une étincelle d’aube au creux de la main.',
		stat: 'esprit',
		power: {
			name: 'Étincelle d’aube',
			text: 'En combat, ton attaque réussit sans lancer le dé. Contre une créature de brume, elle retire 2 cœurs.',
		},
		kit: ['Bâton noueux', 'Grimoire écorné', 'Bougie'],
	},
	barde: {
		id: 'barde',
		name: 'Barde',
		names: { f: 'Barde', m: 'Barde' },
		tagline: 'Ta musique réchauffe les cœurs gelés.',
		stat: 'charme',
		power: { name: 'Chant de courage', text: 'Tout le groupe récupère 2 PV. Utilisable à tout moment.' },
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

export function computePvMax(stats: Stats, xp: number): number {
	return 6 + stats.force + 2 * (levelFromXp(xp) - 1);
}

export function finalStats(classId: ClassId, base: Stats): Stats {
	const stats = { ...base };
	stats[CLASSES[classId].stat] += 1;
	return stats;
}

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
	const pvMax = computePvMax(stats, 0);
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
