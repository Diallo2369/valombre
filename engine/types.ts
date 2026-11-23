/**
 * Types du moteur de jeu Valombre.
 * Une campagne est un graphe de scènes écrit à l'avance : le moteur ne fait que le dérouler.
 */

import type { Hex } from './board';

export type StatKey = 'force' | 'agilite' | 'endurance' | 'esprit' | 'charme' | 'initiative';
export type Stats = Record<StatKey, number>;
export type ClassId = 'guerrier' | 'danseur' | 'rodeur' | 'mage' | 'barde';
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
	/**
	 * Image choisie par le joueur à la place du portrait de classe : adresse /heros/portrait/<id>?v=…
	 * (pendant la création seulement, une data URL pas encore enregistrée).
	 */
	portrait?: string;
	classId: ClassId;
	stats: Stats;
	pvMax: number;
	pv: number;
	xp: number;
	/** Le pouvoir de classe se recharge à chaque repos. */
	powerReady: boolean;
	/** Équipement de départ (texte libre, pour la fiche). */
	kit: string[];
	/** Les jets de création (un par caractéristique), pour la fiche. */
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

/** Un mal qui ronge un héros : il perd des PV au début de ses tours. */
export interface Affliction {
	/** « brûlure », « poison », « froid de brume »… */
	name: string;
	/** PV perdus au début de chacun de ses tours. */
	damage: number;
	turns: number;
	/** Probabilité que le coup le transmette (1 par défaut). */
	chance?: number;
}

/** Une créature d'un groupe. Ce qui n'est pas précisé vient de `CombatDef.enemy`. */
/**
 * Un sort de monstre. Il s'annonce un tour à l'avance (la créature le prépare, sans attaquer) : le groupe a un tour
 * pour réagir (bâillonner, assommer, endormir la créature, ou sortir de la zone). Puis il part, à la place de son attaque.
 */
export interface FoeSpell {
	id: string;
	name: string;
	icon: string;
	/** Endormir un héros, le frapper de loin, souffler sur une zone (la cible et ses voisins), encourager les autres. */
	kind: 'sleep' | 'bolt' | 'blast' | 'rally';
	/** Ce qu'on voit pendant la préparation (« prend une grande inspiration… »). */
	prepare: string;
	/** Dégâts (bolt, blast) ; pour rally : dégâts en plus au prochain coup de chaque créature. */
	damage?: number;
	afflict?: Affliction;
	/** Portée en cases (pour viser au moment de préparer). */
	range: number;
	/** Délai : 1 tour sur `every`. */
	every: number;
}

export interface FoeDef {
	name: string;
	hearts: number;
	image?: string;
	damage?: number;
	afflict?: Affliction;
	move?: number;
	range?: number;
	/** Coup balayé : frappe aussi les autres héros collés à elle. */
	cleave?: boolean;
	/** Attaques par tour (1 par défaut). */
	attacks?: number;
	/** Chance (0-1) qu'un coup qui porte assomme le héros : il passe son prochain tour. */
	stun?: number;
	/** Son sort (un seul par créature). */
	spell?: FoeSpell;
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
		/** Mal laissé par ses coups (brûlure, poison…) : le barde peut l'enlever. */
		afflict?: Affliction;
		/** Cases parcourues par tour (2 par défaut) et portée de ses coups (1 = au contact). */
		move?: number;
		range?: number;
		/** Coup balayé (les gros monstres) : sa griffe frappe aussi les autres héros collés à elle. */
		cleave?: boolean;
		/** Attaques par tour (1 par défaut) : le Loup frappe deux fois. */
		attacks?: number;
		/** Gros coup : chance (0-1) qu'un coup qui porte assomme le héros, qui passe son prochain tour. */
		stun?: number;
		/** Son sort (une créature seule ; dans une bande, sur la créature de `foes`). */
		spell?: FoeSpell;
	};
	/**
	 * Plusieurs créatures, chacune avec ses cœurs (sinon une seule : `enemy`).
	 * `enemy` garde alors le nom du groupe, la difficulté, l'attaque racontée et les valeurs par défaut.
	 * La liste est écrite pour une table de 6 : avec moins de héros, on n'en garde que les premières
	 * (4 sur 6 à 4 héros, 2 sur 6 à 2 héros) ; mettre les plus importantes en tête.
	 */
	foes?: FoeDef[];
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
	/** « pluie » : des gouttes qui tombent sur toute l'image (intensity : densité, x : vent en degrés). */
	/** « yeux » : une paire d'yeux qui clignent et se déplacent parfois ; « flaque » : des ronds dans l'eau (size : largeur de la flaque). */
	kind: 'feu' | 'lanterne' | 'bougie' | 'magie' | 'brume' | 'eclair' | 'pluie' | 'yeux' | 'flaque';
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
	/** Carte du monde (écran de chargement au début de l'aventure) : son image, et la position de chaque zone en %. */
	map?: { image: string; zones: Record<string, [number, number]> };
	style: StyleGuide;
}

/* ------------------------------------------------------------------ */
/* État de partie                                                      */
/* ------------------------------------------------------------------ */

/** Une créature pendant le combat. Ses points de vie sont comptés en demi-cœurs. */
export interface FoeState {
	id: string;
	name: string;
	hp: number;
	maxHp: number;
	image?: string;
	damage: number;
	afflict?: Affliction;
	move: number;
	range: number;
	cleave?: boolean;
	attacks?: number;
	stun?: number;
	spell?: FoeSpell;
	/** Tour à partir duquel son sort est de nouveau prêt. */
	spellReady?: number;
	/** Le sort qu'elle prépare : il part à son prochain tour (la cible, et la zone pour un souffle). */
	charging?: { heroId?: string; zone?: Hex[] };
	/** Tours de bâillon restants (Flèche visée, Pointes trempées) : pas de sort. */
	silenced?: number;
	/** Cri de ralliement : dégâts en plus à son prochain coup. */
	rallied?: number;
	/** Menace de chaque héros sur elle : elle attaque celui qui l'énerve le plus (parmi ceux qu'elle peut atteindre). */
	threat?: Record<string, number>;
	/** Provoquée par la Moquerie : son prochain coup sur le moqueur fait de +25 % à +100 % de dégâts. */
	enraged?: boolean;
	/** Tours qu'elle doit encore passer : sonnée (Coup assommant), prise au filet, endormie. */
	stunned?: number;
	stunKind?: StunKind;
	/** Tours de poison restants (1 PV perdu à chacun de ses tours). */
	poison?: number;
	/** Tours d'aveuglement restants (elle rate un coup sur deux). */
	blind?: number;
	/** Héros qui l'a provoquée (Moquerie) : sa prochaine attaque est pour lui. */
	taunt?: string;
}

export type StunKind = 'assomme' | 'filet' | 'sommeil';

/** Ce qui arrive à un héros pendant le combat. */
export interface HeroCombatState {
	/** Armure restante : elle prend les coups avant les PV, réparée à chaque combat. */
	armor: number;
	/** Bouclier de lune posé par le barde : absorbe les prochains dégâts. */
	shield?: number;
	/** Folie vengeresse : il a reçu un coup, sa prochaine attaque est un coup critique. */
	fury?: boolean;
	/** Assommé par un gros coup : il passe son prochain tour. */
	stunned?: boolean;
	/** Cri de rage : jusqu'à son prochain tour, il pare les coups (cette chance, 0-1). */
	guarding?: number;
	/** Le guerrier qui le protège (Intervention) jusqu'à son prochain tour. */
	protectedBy?: string;
	afflict?: Affliction;
}

export interface CombatState {
	foes: FoeState[];
	/** Index du héros dont c'est le tour dans le groupe. */
	actor: number;
	round: number;
	/** Ordre de jeu tiré à l'initiative : identifiants des héros, et 'enemy' pour les monstres. */
	order: string[];
	/** Position actuelle dans l'ordre de jeu. */
	turn: number;
	/** Jets d'initiative (dé + bonus), pour les afficher. */
	initiative: Record<string, { die: number; bonus: number; total: number }>;
	/** Délais de récupération : pour chaque héros, le tour (round) où chaque compétence redevient utilisable. */
	ready: Record<string, Record<string, number>>;
	heroes: Record<string, HeroCombatState>;
	/** Position de chacun sur le plateau (héros et créatures). */
	pos: Record<string, Hex>;
	/** Le héros dont c'est le tour s'est déjà déplacé. */
	moved: boolean;
	/**
	 * 'hero' : un héros joue. 'intent' : les créatures ont annoncé leur cible,
	 * le guerrier peut s'interposer devant un compagnon visé (Intervention) avant qu'elles n'agissent.
	 */
	phase: 'hero' | 'intent';
	intents: Intent[];
	/** Guerriers qui se sont déjà interposés (Intervention) pendant ce tour des monstres. */
	reclaimed: string[];
	/** Ronde enchantée du barde : une barrière de notes autour de ces cases, jusqu'à son prochain tour. Rien ne la traverse. */
	barriers?: { heroId: string; zone: Hex[] }[];
}

/** Ce qu'une créature s'apprête à faire : aller frapper tel héros. */
export interface Intent {
	foeId: string;
	heroId: string;
	/** Provoquée (Moquerie), la plus forte menace, la plus proche, ou un sort (préparé ou lancé). */
	why: 'taunt' | 'threat' | 'near' | 'spell';
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
	/** Un héros touche une créature (amount en demi-cœurs). */
	| { kind: 'hit'; heroId: string; foeId: string; amount: number; spell?: boolean; crit?: boolean; offhand?: boolean }
	/** Un héros rate son action (le coup fend l'air). */
	| { kind: 'miss'; heroId: string }
	/** Une compétence part (pour les effets visuels) : qui, laquelle, vers qui, et si elle réussit. */
	| { kind: 'ability'; heroId: string; ability: string; foeIds: string[]; allyId?: string; success: boolean; crit?: boolean; at?: Hex }
	/** Fin du combat (victoire, défaite, paix ou fuite), avec le plateau tel qu'il était au dernier coup. */
	| { kind: 'combat-end'; result: 'victory' | 'defeat' | 'peace' | 'escape'; name: string; combat: CombatState }
	/** Début du tour des monstres (l'attaque du groupe, racontée par le conteur). */
	| { kind: 'enemy-turn'; name: string; attack: string }
	/** Une créature attaque un héros. */
	| {
			kind: 'foe-attack';
			foeId: string;
			name: string;
			heroId: string;
			/** PV perdus. */
			amount: number;
			/** Encaissé par l'armure, par le bouclier de lune. */
			absorbed: number;
			shielded: number;
			/** Le guerrier s'est interposé ; l'aura l'a attirée ; elle a été provoquée. */
			guarded?: boolean;
			aura?: boolean;
			taunted?: boolean;
			/** Mal transmis (brûlure…). */
			afflict?: string;
			/** Coup balayé : ce héros était collé à la créature, à côté de sa cible. */
			cleave?: boolean;
			/** Aveuglée, elle a frappé à côté. */
			missed?: boolean;
			/** Gros coup : le héros est assommé (ou endormi, par un sort). */
			stunned?: boolean;
			/** Paré (Cri de rage du guerrier) : rien ne passe. */
			parried?: boolean;
			/** Un sort, pas un coup (son nom). */
			spell?: string;
			/** Enragée par la Moquerie : multiplicateur des dégâts (1,25 à 2). */
			rage?: number;
	  }
	/** Un héros assommé passe son tour. */
	| { kind: 'hero-skip'; heroId: string }
	/** Une créature prépare son sort (il partira à son prochain tour). */
	| { kind: 'foe-charge'; foeId: string; name: string; spell: string; icon: string; text: string; zone?: Hex[] }
	/** Elle le lance. */
	| { kind: 'foe-cast'; foeId: string; name: string; spell: string; icon: string; spellKind: FoeSpell['kind'] }
	/** Le sort ne part pas : elle a été bâillonnée ou assommée pendant qu'elle le préparait. */
	| { kind: 'foe-fizzle'; foeId: string; name: string; spell: string; why: 'muet' | 'assomme' }
	/** Le guerrier s'interpose devant un compagnon visé (Intervention, pendant le tour des monstres). */
	| { kind: 'intervene'; heroId: string; allyId: string }
	/** La Ronde enchantée arrête le coup (ou le sort) : la cible est de l'autre côté. */
	| { kind: 'foe-blocked'; foeId: string; name: string; heroId: string }
	/** Œil pour œil : le guerrier renvoie le coup (et parfois assomme la créature). */
	| { kind: 'riposte'; heroId: string; foeId: string; name: string; amount: number; stunned: boolean; dead: boolean }
	/** Une créature passe son tour (sonnée, au filet, endormie). */
	| { kind: 'foe-skip'; foeId: string; name: string; reason: StunKind }
	/** Le poison ronge une créature. */
	| { kind: 'foe-poison'; foeId: string; name: string; amount: number; dead: boolean }
	/** Un état posé sur une créature par un héros (ou raté). */
	| { kind: 'foe-status'; foeId: string; heroId: string; what: StunKind | 'poison' | 'aveugle' | 'provoque' | 'muet'; failed?: boolean }
	/** Un mal ronge un héros au début de son tour. */
	| { kind: 'affliction'; heroId: string; name: string; amount: number; shielded?: number }
	/** Le héros KO se relève à la fin du combat. */
	| { kind: 'wake'; heroId: string }
	/** Déplacements sur le plateau. */
	| { kind: 'hero-move'; heroId: string; from: Hex; to: Hex }
	/** `pushed` : repoussée par un héros (Déflagration runique), pas un déplacement à elle. */
	| { kind: 'foe-move'; foeId: string; from: Hex; to: Hex; pushed?: boolean }
	/** Les créatures annoncent leur cible. */
	| { kind: 'intent'; intents: Intent[] }
	/** Ordre de jeu tiré au début du combat. */
	| { kind: 'initiative'; order: { id: string; name: string; die: number; bonus: number; total: number }[] }
	/** Actions de soutien : protéger un compagnon, soigner, bouclier, délivrer des maux. */
	| { kind: 'support'; heroId: string; what: 'protect' | 'heal' | 'shield' | 'cleanse' | 'barrier' | 'rally'; targetId?: string; targetIds?: string[]; amount?: number }
	/** Début du tour d'un héros (bandeau « Au tour de… »). */
	| { kind: 'turn'; heroId: string };

export interface StepResult extends Game {
	events: GameEvent[];
	/** Répliques entendues pour la première fois dans cette étape (empreintes voiceHash). */
	fresh?: string[];
}
