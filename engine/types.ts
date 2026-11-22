/**
 * Types du moteur de jeu Valombre.
 * Une campagne est un graphe de scènes écrit à l'avance : le moteur ne fait que le dérouler.
 */

export type StatKey = 'force' | 'agilite' | 'esprit' | 'charme';
export type Stats = Record<StatKey, number>;
export type ClassId = 'guerrier' | 'rodeur' | 'mage' | 'barde';
export type Gender = 'f' | 'm';
export type Difficulty = 'facile' | 'moyen' | 'difficile';
export type QuestStatus = 'active' | 'done' | 'failed';

/* ------------------------------------------------------------------ */
/* Personnages                                                         */
/* ------------------------------------------------------------------ */

export interface Character {
	id: string;
	/** Nom du héros. */
	name: string;
	/** Prénom du joueur ou de la joueuse autour de la table. */
	player: string;
	/** Une héroïne (f) ou un héros (m) : accorde le nom de classe et choisit le portrait. */
	gender?: Gender;
	classId: ClassId;
	stats: Stats;
	pvMax: number;
	pv: number;
	xp: number;
	/** Le pouvoir de classe se recharge à chaque repos. */
	powerReady: boolean;
	/** Équipement de départ (texte libre, pour la fiche). */
	kit: string[];
	/** Les 4 jets de création, pour la fiche. */
	rolls: number[];
	notes: string;
}

/* ------------------------------------------------------------------ */
/* Conditions et effets                                                */
/* ------------------------------------------------------------------ */

export type Cond =
	| { flag: string }
	| { notFlag: string }
	| { item: string }
	| { notItem: string }
	| { quest: string; status: QuestStatus | 'none' }
	| { visited: string }
	| { notVisited: string }
	/** Au moins `min` drapeaux de la liste `of`. */
	| { min: number; of: string[] }
	| { gold: number }
	| { hasClass: ClassId }
	/** `true` : le groupe découvre la scène actuelle ; `false` : il y revient. */
	| { firstVisit: boolean };

export type BaseEffect =
	| { setFlag: string }
	| { clearFlag: string }
	| { addItem: string; qty?: number }
	| { removeItem: string }
	| { gold: number }
	| { heal: number | 'full' }
	| { damage: number; target?: 'all' | 'random' }
	| { xp: number }
	| { quest: string; status: QuestStatus }
	/** Repos complet : PV au maximum, pouvoirs rechargés. */
	| { rest: true }
	/** Message affiché en bulle. */
	| { message: string };

export type Effect = BaseEffect & { if?: Cond[] };

/* ------------------------------------------------------------------ */
/* Scènes                                                              */
/* ------------------------------------------------------------------ */

export interface Line {
	/** `narrateur` ou l'identifiant d'un PNJ. */
	who: string;
	text: string;
	if?: Cond[];
}

export interface Outcome {
	to: string;
	effects?: Effect[];
	/** Phrase lue juste après le résultat du dé. */
	text?: string;
}

export interface CheckDef {
	stat: StatKey;
	difficulty: Difficulty;
	success: Outcome;
	failure: Outcome;
}

export interface Choice {
	label: string;
	to?: string;
	if?: Cond[];
	effects?: Effect[];
	check?: CheckDef;
	/** Le choix disparaît une fois pris. */
	once?: boolean;
	/** Ce qui se passe quand on fait ce choix, lu avant la scène suivante. Un choix qui décrit une action raconte son résultat. */
	text?: string;
	/** Qui dit `text` (le conteur par défaut). */
	who?: string;
}

export interface CombatDef {
	enemy: {
		name: string;
		/** Nombre de coups à porter pour gagner. */
		hearts: number;
		difficulty: Difficulty;
		/** PV perdus par le héros qu'il attaque, à son tour (une fois par tour de table). */
		damage: number;
		/** Son attaque, racontée à son tour (« Coup de griffes de braise ! »). */
		attack?: string;
		/** Créature de brume : le pouvoir du mage fait double effet. */
		brume?: boolean;
		image?: string;
	};
	victory: Outcome;
	defeat: Outcome;
	talk?: { label: string; stat: StatKey; difficulty: Difficulty; outcome: Outcome };
	flee?: { label: string; stat: StatKey; difficulty: Difficulty; outcome: Outcome };
}

/** Références vers le catalogue de médias de la campagne (ou le catalogue commun). */
export interface MediaRef {
	image?: string;
	video?: string;
	music?: string;
	/** La musique démarre dès l'entrée en scène (sinon elle attend un peu : voir lib/audio.ts). */
	musicNow?: boolean;
	ambience?: string;
	/** Bruitages joués à l'entrée de la scène. */
	sfx?: string[];
}

export interface Scene {
	id: string;
	title: string;
	chapter: number;
	zone: string;
	/** Scène « pivot » : on y revient toujours, l'excursion repart à zéro. */
	hub?: boolean;
	/** Une scène de rappel ne déclenche jamais un autre rappel. */
	noRecall?: boolean;
	media?: MediaRef;
	lines: Line[];
	onEnter?: Effect[];
	choices?: Choice[];
	combat?: CombatDef;
	ending?: { title: string; text: string; unlock?: string };
	/**
	 * Lieu « autour » de la scène : ses choix sont proposés en plus de ceux de la scène
	 * (sauf ceux qui ramènent ici). Ex. après avoir parlé à Berthe, on peut aller voir Ossian
	 * ou sortir, sans repasser par la salle commune.
	 */
	next?: string;
	/**
	 * Lieu physique de la scène (voir Campaign.places) : la salle commune, l'écurie, le grenier…
	 * Plusieurs scènes partagent un lieu (une conversation). Par défaut : la zone.
	 */
	place?: string;
	/** `false` : la scène raconte elle-même comment on y arrive (réveil, départ…) ; pas de phrase de trajet. */
	transition?: false;
	/** Aiguillage à l'entrée : la première règle vraie envoie vers une autre scène. */
	redirects?: { if: Cond[]; to: string }[];
	/** Note d'écriture pour toi (non affichée en jeu). */
	note?: string;
}

/**
 * Une zone peut avoir une « laisse » : après `leash` scènes loin du pivot,
 * le moteur déclenche un événement de rappel (tempête, loups…) qui ramène au pivot.
 * La laisse saute quand le drapeau `leashUntil` est posé (le scénario avance).
 */
export interface Zone {
	id: string;
	name: string;
	leash?: number;
	leashUntil?: string;
	recalls?: string[];
}

/** Un lieu physique : ce qu'on dit en y arrivant et en le quittant. */
export interface Place {
	name: string;
	/** Lue en arrivant, selon le lieu d'où l'on vient (`>` : depuis une autre zone ; `*` : tous les autres ; '' : rien à dire). */
	arrive?: Record<string, string>;
	/** Lue en quittant ce lieu, selon la destination (`>` : vers une autre zone ; `*` : toutes les autres ; '' : rien à dire). */
	leave?: Record<string, string>;
}

export interface Npc {
	id: string;
	name: string;
	role: string;
	color: string;
	/** Réglages de la voix de secours du navigateur. */
	voice: { pitch: number; rate: number; gender: 'f' | 'm' };
	/** Fiche de casting pour générer la vraie voix (âge, timbre, accent, jeu). */
	casting?: string;
	portrait?: string;
}

export interface Item {
	id: string;
	name: string;
	description: string;
	/** Objet consommable utilisable depuis le sac. */
	use?: { label: string; heal: number; target: 'one' | 'all' };
}

export interface Quest {
	id: string;
	title: string;
	kind: 'principale' | 'secondaire';
	description: string;
	xp: number;
}

export type MediaType = 'image' | 'video' | 'music' | 'ambience' | 'sfx';

export interface MediaAsset {
	id: string;
	type: MediaType;
	title: string;
	/** Prompt spécifique (le guide de style de la campagne s'y ajoute à l'export). */
	prompt: string;
	/** Version anglaise complète, utilisée par `npm run voix -- son` (les générateurs de sons comprennent mieux l'anglais). */
	promptEn?: string;
	/** Images : où placer les éléments importants (calé sur les lumières vivantes posées sur l'image). */
	composition?: string;
	notes?: string;
}

/**
 * Lumière vivante posée sur une image (components/LightLayer.tsx).
 * x, y : position du foyer en % de l'image ; size : rayon en fraction de la largeur ; intensity : 0 à 1,5.
 */
export interface Light {
	kind: 'feu' | 'lanterne' | 'magie' | 'brume' | 'eclair';
	x?: number;
	y?: number;
	size?: number;
	intensity?: number;
	/** Couleur « r,g,b » (sinon celle du type). */
	color?: string;
}

export interface StyleGuide {
	image: string;
	video: string;
	music: string;
	ambience: string;
	sfx: string;
}

export type Unlock =
	| { type: 'default' }
	| { type: 'code'; codes: string[] }
	| { type: 'after'; campaign: string; codes?: string[] };

export interface Campaign {
	id: string;
	title: string;
	subtitle: string;
	pitch: string;
	age: string;
	duration: string;
	/** false : campagne annoncée mais pas encore écrite. */
	playable: boolean;
	unlock: Unlock;
	cover: string;
	startScene: string;
	startGold: number;
	chapters: { n: number; title: string }[];
	zones: Record<string, Zone>;
	/**
	 * Phrases de transition entre zones, clé « depart>arrivee » (ex. 'auberge>village').
	 * Lues quand le groupe change de zone sans que le choix raconte déjà le trajet.
	 */
	transitions?: Record<string, string>;
	/** Lieux physiques (arrivée, sortie). */
	places?: Record<string, Place>;
	npcs: Record<string, Npc>;
	items: Record<string, Item>;
	quests: Record<string, Quest>;
	scenes: Record<string, Scene>;
	media: MediaAsset[];
	/** Lumières vivantes par image (clé : identifiant de l'image). À ajuster quand l'illustration existe. */
	lights?: Record<string, Light[]>;
	style: StyleGuide;
}

/* ------------------------------------------------------------------ */
/* État de partie                                                      */
/* ------------------------------------------------------------------ */

export interface CombatState {
	hearts: number;
	maxHearts: number;
	/** Index du héros dont c'est le tour dans le groupe. */
	actor: number;
	round: number;
}

export interface LogEntry {
	turn: number;
	kind: 'scene' | 'roll' | 'effect' | 'combat' | 'quest';
	text: string;
}

export interface GameState {
	version: 1;
	campaignId: string;
	sceneId: string;
	turn: number;
	flags: string[];
	visited: string[];
	quests: Record<string, QuestStatus>;
	bag: Record<string, number>;
	gold: number;
	/** Excursion en cours : scènes enchaînées loin du pivot (au total, et dans la zone actuelle). */
	excursion: { total: number; zone: string; steps: number };
	/** Index du porte-parole qui choisit pour le groupe. */
	spokes: number;
	combat: CombatState | null;
	/** La scène actuelle vient d'être découverte (pour les répliques de première visite). */
	firstVisit: boolean;
	/** Empreintes des répliques déjà entendues : on ne relit pas automatiquement ce qui a été lu. */
	heard?: string[];
	/** Identifiant de la « manche » : change quand on recommence, pour qu'un vieil onglet ne l'écrase pas. */
	run?: string;
	log: LogEntry[];
	ended: boolean;
}

export interface Game {
	state: GameState;
	party: Character[];
}

export type GameEvent =
	| { kind: 'toast'; text: string; tone: 'good' | 'bad' | 'info' }
	| { kind: 'sfx'; id: string }
	/** Phrase de résultat (après un dé) lue en tête de la scène suivante. */
	| { kind: 'narration'; text: string; who?: string }
	/** Un coup en combat, pour l'animer : l'ennemi touché (carte qui tremble, cœur barré) ou un héros blessé. */
	| { kind: 'hit'; target: 'enemy' | 'hero'; heroId: string; amount: number; spell?: boolean }
	/** Un héros rate son action (le coup fend l'air). */
	| { kind: 'miss'; heroId: string }
	/** Tour du monstre : il attaque un héros. */
	| { kind: 'enemy-turn'; name: string; attack: string; heroId: string; amount: number }
	/** Début du tour d'un héros (bandeau « Au tour de… »). */
	| { kind: 'turn'; heroId: string };

export interface StepResult extends Game {
	events: GameEvent[];
	/** Répliques entendues pour la première fois dans cette étape (empreintes voiceHash). */
	fresh?: string[];
}
