import { BOARD, approach, distance, hexKey, inBoard, neighbors, reachable, sameHex, startPositions, type Hex } from './board';
import { ABILITIES, CLASSES, ENEMY_INITIATIVE, STAT_LABEL, computePvMax, evaluateRoll, initiativeOf, levelFromXp, rollD6, type Ability, type AbilityId, type RollResult } from './rules';
import { voiceHash } from './voices';
import type {
	Affliction,
	Campaign,
	Character,
	CheckDef,
	Choice,
	CombatDef,
	CombatState,
	FoeSpell,
	FoeState,
	Intent,
	Cond,
	Effect,
	Game,
	GameEvent,
	GameState,
	Line,
	Outcome,
	Scene,
	StatKey,
	StepResult,
} from './types';

/* ------------------------------------------------------------------ */
/* Outils                                                              */
/* ------------------------------------------------------------------ */

const clone = <T>(v: T): T => structuredClone(v);

const LOG_MAX = 300;
/** Au-delà de ce nombre de scènes loin du pivot (toutes zones confondues), un rappel se déclenche. */
const MAX_EXCURSION = 9;

function log(state: GameState, kind: GameState['log'][number]['kind'], text: string) {
	state.log.push({ turn: state.turn, kind, text });
	if (state.log.length > LOG_MAX) state.log.splice(0, state.log.length - LOG_MAX);
}

function addFlag(state: GameState, flag: string) {
	if (!state.flags.includes(flag)) state.flags.push(flag);
}

export function hasFlag(state: GameState, flag: string) {
	return state.flags.includes(flag);
}

export function getScene(campaign: Campaign, id: string): Scene {
	const scene = campaign.scenes[id];
	if (!scene) throw new Error(`Scène introuvable : ${id}`);
	return scene;
}

export function activeHeroes(party: Character[]) {
	return party.filter((c) => c.pv > 0);
}

/* ------------------------------------------------------------------ */
/* État initial                                                        */
/* ------------------------------------------------------------------ */

export function createInitialState(campaign: Campaign): GameState {
	return {
		version: 1,
		campaignId: campaign.id,
		sceneId: campaign.startScene,
		turn: 0,
		flags: [],
		visited: [],
		quests: {},
		bag: {},
		gold: campaign.startGold,
		excursion: { total: 0, zone: '', steps: 0 },
		spokes: 0,
		combat: null,
		firstVisit: true,
		log: [],
		ended: false,
	};
}

/** Démarre la partie : entre dans la première scène. */
export function startGame(campaign: Campaign, party: Character[]): StepResult {
	const state = createInitialState(campaign);
	return enterScene(campaign, { state, party: clone(party) }, campaign.startScene, []);
}

/* ------------------------------------------------------------------ */
/* Conditions                                                          */
/* ------------------------------------------------------------------ */

export function evalCond(game: Game, cond: Cond): boolean {
	const { state, party } = game;
	if ('flag' in cond) return hasFlag(state, cond.flag);
	if ('notFlag' in cond) return !hasFlag(state, cond.notFlag);
	if ('item' in cond) return (state.bag[cond.item] ?? 0) > 0;
	if ('notItem' in cond) return !((state.bag[cond.notItem] ?? 0) > 0);
	if ('quest' in cond) return (state.quests[cond.quest] ?? 'none') === cond.status;
	if ('visited' in cond) return state.visited.includes(cond.visited);
	if ('notVisited' in cond) return !state.visited.includes(cond.notVisited);
	if ('min' in cond) return cond.of.filter((f) => hasFlag(state, f)).length >= cond.min;
	if ('gold' in cond) return state.gold >= cond.gold;
	if ('hasClass' in cond) return party.some((c) => c.classId === cond.hasClass);
	if ('firstVisit' in cond) return Boolean(state.firstVisit) === cond.firstVisit;
	return true;
}

export function evalAll(game: Game, conds?: Cond[]) {
	return !conds || conds.every((c) => evalCond(game, c));
}

export function visibleLines(game: Game, scene: Scene): Line[] {
	return scene.lines.filter((l) => evalAll(game, l.if));
}

function onceKey(sceneId: string, index: number) {
	return `choix:${sceneId}#${index}`;
}

export interface VisibleChoice {
	index: number;
	choice: Choice;
	/** Choix emprunté au lieu « autour » (scene.next) : affiché dans un second groupe. */
	around: boolean;
}

/**
 * Tous les choix d'une scène : les siens, puis ceux du lieu autour (scene.next), sans ceux
 * qui ramènent ici ou qui doublonnent une destination déjà proposée. Liste fixe (indépendante
 * de l'état) : l'index d'un choix est donc stable d'un tour à l'autre.
 */
export function sceneChoices(campaign: Campaign, scene: Scene): { choice: Choice; around: boolean; key: string }[] {
	const own = (scene.choices ?? []).map((choice, i) => ({ choice, around: false, key: onceKey(scene.id, i) }));
	if (!scene.next) return own;
	const hub = campaign.scenes[scene.next];
	if (!hub) return own;
	const taken = new Set(own.map(({ choice }) => choice.to).filter(Boolean));
	// Un choix « une seule fois » emprunté garde la clé du lieu d'origine : pris ici ou là-bas, il disparaît partout.
	const around = (hub.choices ?? [])
		.map((choice, i) => ({ choice, around: true, key: onceKey(hub.id, i) }))
		.filter(({ choice: c }) => c.to !== scene.id && !(c.to && taken.has(c.to)));
	return [...own, ...around];
}

export function visibleChoices(campaign: Campaign, game: Game, scene: Scene): VisibleChoice[] {
	return sceneChoices(campaign, scene)
		.map(({ choice, around, key }, index) => ({ choice, index, around, key }))
		.filter(({ choice, key }) => {
			if (choice.once && hasFlag(game.state, key)) return false;
			return evalAll(game, choice.if);
		})
		.map(({ choice, index, around }) => ({ choice, index, around }));
}

function choiceAt(campaign: Campaign, scene: Scene, index: number) {
	return sceneChoices(campaign, scene)[index];
}

/* ------------------------------------------------------------------ */
/* Effets                                                              */
/* ------------------------------------------------------------------ */

function applyXp(c: Character, amount: number, events: GameEvent[]) {
	const before = levelFromXp(c.xp);
	c.xp += amount;
	const after = levelFromXp(c.xp);
	const newMax = computePvMax(c.stats, c.xp, c.classId);
	c.pv += newMax - c.pvMax;
	c.pvMax = newMax;
	if (after > before) {
		events.push({ kind: 'toast', text: `${c.name} passe niveau ${after} ! (+2 PV max)`, tone: 'good' });
	}
}

export function applyEffects(campaign: Campaign, game: Game, effects: Effect[] | undefined, events: GameEvent[]) {
	if (!effects) return;
	const { state, party } = game;
	for (const e of effects) {
		if (!evalAll(game, e.if)) continue;

		if ('setFlag' in e) addFlag(state, e.setFlag);
		else if ('clearFlag' in e) state.flags = state.flags.filter((f) => f !== e.clearFlag);
		else if ('addItem' in e) {
			const qty = e.qty ?? 1;
			state.bag[e.addItem] = (state.bag[e.addItem] ?? 0) + qty;
			const name = campaign.items[e.addItem]?.name ?? e.addItem;
			events.push({ kind: 'toast', text: `Objet obtenu : ${name}${qty > 1 ? ` ×${qty}` : ''} → rangé dans le sac du groupe 🎒`, tone: 'good' });
			events.push({ kind: 'sfx', id: 'sfx-objet' });
			log(state, 'effect', `Objet obtenu : ${name}`);
		} else if ('removeItem' in e) {
			const left = (state.bag[e.removeItem] ?? 0) - 1;
			if (left > 0) state.bag[e.removeItem] = left;
			else delete state.bag[e.removeItem];
		} else if ('gold' in e) {
			state.gold = Math.max(0, state.gold + e.gold);
			events.push({
				kind: 'toast',
				text: `${e.gold >= 0 ? `+${e.gold}` : `−${-e.gold}`} pièces d’argent · bourse du groupe : ${state.gold} 🪙`,
				tone: e.gold >= 0 ? 'good' : 'info',
			});
		} else if ('heal' in e) {
			for (const c of party) c.pv = e.heal === 'full' ? c.pvMax : Math.min(c.pvMax, c.pv + e.heal);
			events.push({ kind: 'sfx', id: 'sfx-soin' });
			events.push({
				kind: 'toast',
				text: e.heal === 'full' ? 'Le groupe est en pleine forme.' : `Le groupe récupère ${e.heal} PV.`,
				tone: 'good',
			});
		} else if ('damage' in e) {
			const targets = e.target === 'random' ? pickRandom(activeHeroes(party)) : activeHeroes(party);
			for (const c of targets) {
				c.pv = Math.max(0, c.pv - e.damage);
				events.push({ kind: 'toast', text: `${c.name} perd ${e.damage} PV.`, tone: 'bad' });
				log(state, 'effect', `${c.name} perd ${e.damage} PV`);
			}
			if (targets.length) events.push({ kind: 'sfx', id: 'sfx-blessure' });
		} else if ('xp' in e) {
			for (const c of party) applyXp(c, e.xp, events);
			events.push({ kind: 'toast', text: `+${e.xp} points d’expérience pour chacun`, tone: 'good' });
		} else if ('quest' in e) {
			const quest = campaign.quests[e.quest];
			const current = state.quests[e.quest];
			if (current === e.status) continue;
			if (e.status === 'active' && current) continue;
			state.quests[e.quest] = e.status;
			if (!quest) continue;
			const label =
				e.status === 'active' ? 'Nouvelle quête' : e.status === 'done' ? 'Quête accomplie' : 'Quête échouée';
			events.push({ kind: 'toast', text: `${label} : ${quest.title}`, tone: e.status === 'failed' ? 'bad' : 'good' });
			events.push({ kind: 'sfx', id: 'sfx-quete' });
			log(state, 'quest', `${label} : ${quest.title}`);
			if (e.status === 'done' && quest.xp) {
				for (const c of party) applyXp(c, quest.xp, events);
				events.push({ kind: 'toast', text: `+${quest.xp} points d’expérience pour chacun`, tone: 'good' });
			}
		} else if ('rest' in e) {
			for (const c of party) {
				c.pv = c.pvMax;
				c.powerReady = true;
			}
			events.push({ kind: 'toast', text: 'Repos : PV et pouvoirs rechargés.', tone: 'good' });
		} else if ('message' in e) {
			events.push({ kind: 'toast', text: e.message, tone: 'info' });
		}
	}
}

function pickRandom<T>(list: T[]): T[] {
	if (!list.length) return [];
	return [list[Math.floor(Math.random() * list.length)]];
}

/* ------------------------------------------------------------------ */
/* Déplacements : entrée en scène, laisse et rappels                   */
/* ------------------------------------------------------------------ */

/**
 * Choisit la scène réellement jouée : si le groupe s'est trop éloigné du pivot
 * dans une zone « en laisse », on bascule sur un événement de rappel.
 */
function resolveDestination(campaign: Campaign, state: GameState, targetId: string): string {
	const target = getScene(campaign, targetId);
	// Rester dans le même lieu (une question à un PNJ, une conversation…) ne compte pas comme un pas,
	// et ne déclenche jamais de rappel : on ne coupe pas la parole à quelqu'un.
	const current = campaign.scenes[state.sceneId];
	if (targetId === state.sceneId || (current && placeOf(current) === placeOf(target))) return targetId;
	if (target.hub) {
		state.excursion = { total: 0, zone: target.zone, steps: 0 };
		return targetId;
	}
	const zone = campaign.zones[target.zone];
	const leashed = zone?.leash && !(zone.leashUntil && hasFlag(state, zone.leashUntil));
	// Revenir dans un lieu sûr (l'auberge…) remet l'excursion à zéro, même sans passer par le pivot.
	if (!leashed || !zone) {
		state.excursion = { total: 0, zone: target.zone, steps: 0 };
		return targetId;
	}

	const ex = state.excursion;
	ex.total += 1;
	ex.steps = ex.zone === zone.id ? ex.steps + 1 : 1;
	ex.zone = zone.id;
	const tooFar = ex.steps > (zone.leash ?? Infinity) || ex.total > MAX_EXCURSION;
	if (target.noRecall || !tooFar) return targetId;

	const recalls = zone.recalls ?? [];
	if (!recalls.length) return targetId;
	// Priorité aux rappels jamais vus ; sinon au hasard parmi tous.
	const fresh = recalls.filter((r) => !state.visited.includes(r));
	const pool = fresh.length ? fresh : recalls;
	state.excursion = { total: 0, zone: '', steps: 0 };
	return pool[Math.floor(Math.random() * pool.length)];
}

export function enterScene(campaign: Campaign, game: Game, targetId: string, events: GameEvent[]): StepResult {
	const next: Game = { state: clone(game.state), party: clone(game.party) };
	const { state } = next;
	const from = campaign.scenes[state.sceneId];
	let sceneId = resolveDestination(campaign, state, targetId);
	const interrupted = sceneId !== targetId; // un rappel coupe le trajet : pas de phrase de trajet
	let scene = getScene(campaign, sceneId);
	// Aiguillages en chaîne (3 sauts maximum pour éviter les boucles).
	for (let hop = 0; hop < 3; hop += 1) {
		const redirect = scene.redirects?.find((r) => evalAll(next, r.if));
		if (!redirect) break;
		sceneId = redirect.to;
		scene = getScene(campaign, sceneId);
	}

	// Se situer dans l'espace (docs/conventions.md) : quand on change de lieu, on raconte la sortie,
	// le trajet d'une zone à l'autre, puis l'arrivée. Si le choix raconte déjà le trajet, il remplace sortie et trajet.
	if (from && !interrupted && scene.transition !== false) {
		for (const text of moveNarration(campaign, from, scene, events.some((e) => e.kind === 'narration')))
			events.push({ kind: 'narration', text });
	}

	state.sceneId = sceneId;
	state.turn += 1;
	state.firstVisit = !state.visited.includes(sceneId);
	if (state.firstVisit) state.visited.push(sceneId);
	log(state, 'scene', scene.title);

	for (const id of scene.media?.sfx ?? []) events.push({ kind: 'sfx', id });
	applyEffects(campaign, next, scene.onEnter, events);

	state.combat = null;
	if (scene.combat) {
		startCombat(next, scene.combat, events);
		// Le monstre peut avoir l'initiative : il agit avant le premier héros.
		advanceCombat(next, scene.combat, events);
	}

	if (scene.ending) state.ended = true;

	// Ce qui va être entendu : phrases de résultat, lignes de la scène, texte de fin.
	const said: [string, string][] = [
		...events.filter((e): e is Extract<GameEvent, { kind: 'narration' }> => e.kind === 'narration').map((e): [string, string] => [e.who ?? 'narrateur', e.text]),
		...visibleLines(next, scene).map((l): [string, string] => [l.who, l.text]),
		...(scene.ending ? [['narrateur', scene.ending.text] as [string, string]] : []),
	];
	const heard = new Set(state.heard ?? []);
	const fresh: string[] = [];
	for (const [who, text] of said) {
		const h = voiceHash(who, text);
		if (!heard.has(h)) fresh.push(h);
		heard.add(h);
	}
	state.heard = [...heard];

	return { ...next, events, fresh };
}

export function placeOf(scene: Scene) {
	return scene.place ?? scene.zone;
}

/** Phrases qui accompagnent un déplacement d'une scène à une autre (sortie, trajet, arrivée). */
export function moveNarration(campaign: Campaign, from: Scene, to: Scene, narrated: boolean): string[] {
	const a = placeOf(from);
	const b = placeOf(to);
	if (a === b) return [];
	const out: string[] = [];
	if (!narrated) {
		const leave = campaign.places?.[a]?.leave;
		const otherZone = from.zone !== to.zone;
		const leaveText = leave?.[b] ?? (otherZone ? leave?.['>'] : undefined) ?? leave?.['*'];
		if (leaveText) out.push(leaveText);
		const transition = from.zone !== to.zone ? campaign.transitions?.[`${from.zone}>${to.zone}`] : undefined;
		if (transition) out.push(transition);
	}
	const arrive = campaign.places?.[b]?.arrive;
	const arriveText = arrive?.[a] ?? (from.zone !== to.zone ? arrive?.['>'] : undefined) ?? arrive?.['*'];
	if (arriveText) out.push(arriveText);
	return out;
}

/** Prochain porte-parole : on fait tourner la parole autour de la table. */
function nextSpokes(game: Game) {
	if (game.party.length) game.state.spokes = (game.state.spokes + 1) % game.party.length;
}

/** Choix simple (sans dé). */
export function takeChoice(campaign: Campaign, game: Game, choiceIndex: number): StepResult {
	const scene = getScene(campaign, game.state.sceneId);
	const entry = choiceAt(campaign, scene, choiceIndex);
	if (!entry) throw new Error('Choix invalide');
	const { choice } = entry;
	const events: GameEvent[] = [];
	const work: Game = { state: clone(game.state), party: clone(game.party) };
	if (choice.once) addFlag(work.state, entry.key);
	if (choice.text) events.push({ kind: 'narration', text: choice.text, who: choice.who });
	applyEffects(campaign, work, choice.effects, events);
	nextSpokes(work);
	return enterScene(campaign, work, choice.to ?? scene.id, events);
}

/* ------------------------------------------------------------------ */
/* Tests de caractéristique                                            */
/* ------------------------------------------------------------------ */

export function rollFor(character: Character, stat: StatKey, difficulty: CheckDef['difficulty'], die: number) {
	return evaluateRoll(die, character.stats[stat], difficulty);
}

/** Applique l'issue d'un test une fois le dé définitivement lancé. */
export function resolveCheck(
	campaign: Campaign,
	game: Game,
	choiceIndex: number,
	characterId: string,
	roll: RollResult,
	usedRerollBy?: string,
): StepResult {
	const scene = getScene(campaign, game.state.sceneId);
	const entry = choiceAt(campaign, scene, choiceIndex);
	const choice = entry?.choice;
	if (!entry || !choice?.check) throw new Error('Ce choix ne demande pas de test');
	const events: GameEvent[] = [];
	const work: Game = { state: clone(game.state), party: clone(game.party) };
	if (choice.once) addFlag(work.state, entry.key);
	if (usedRerollBy) spendPower(work, usedRerollBy);

	const hero = work.party.find((c) => c.id === characterId);
	const outcome: Outcome = roll.success ? choice.check.success : choice.check.failure;
	log(
		work.state,
		'roll',
		`${hero?.name ?? '?'} tente ${STAT_LABEL[choice.check.stat]} : ${roll.die} + ${roll.stat} = ${roll.total} → ${roll.success ? 'réussite' : 'échec'}`,
	);
	events.push({ kind: 'sfx', id: roll.success ? 'sfx-succes' : 'sfx-echec' });
	if (outcome.text) events.push({ kind: 'narration', text: outcome.text });
	applyEffects(campaign, work, choice.effects, events);
	applyEffects(campaign, work, outcome.effects, events);
	nextSpokes(work);
	return enterScene(campaign, work, outcome.to, events);
}

function spendPower(game: Game, characterId: string) {
	const c = game.party.find((h) => h.id === characterId);
	if (c) c.powerReady = false;
}

/* ------------------------------------------------------------------ */
/* Pouvoirs hors combat                                                */
/* ------------------------------------------------------------------ */

/** Chant de courage du barde : +2 PV à tout le groupe (y compris les épuisés). */
export function bardSong(game: Game, bardId: string): StepResult {
	const work: Game = { state: clone(game.state), party: clone(game.party) };
	const bard = work.party.find((c) => c.id === bardId);
	const events: GameEvent[] = [];
	if (!bard || bard.classId !== 'barde' || !bard.powerReady) return { ...work, events };
	bard.powerReady = false;
	for (const c of work.party) c.pv = Math.min(c.pvMax, c.pv + 2);
	events.push({ kind: 'sfx', id: 'sfx-pouvoir' });
	events.push({ kind: 'toast', text: `${bard.name} entonne le Chant de courage : +2 PV pour tous.`, tone: 'good' });
	log(work.state, 'effect', `${bard.name} chante : +2 PV pour tous`);
	return { ...work, events };
}

/** Utiliser un objet du sac (potion…). */
export function consumeItem(campaign: Campaign, game: Game, itemId: string, targetId?: string): StepResult {
	const work: Game = { state: clone(game.state), party: clone(game.party) };
	const events: GameEvent[] = [];
	const item = campaign.items[itemId];
	if (!item?.use || !(work.state.bag[itemId] > 0)) return { ...work, events };
	const targets = item.use.target === 'all' ? work.party : work.party.filter((c) => c.id === targetId);
	for (const c of targets) c.pv = Math.min(c.pvMax, c.pv + item.use.heal);
	work.state.bag[itemId] -= 1;
	if (work.state.bag[itemId] <= 0) delete work.state.bag[itemId];
	events.push({ kind: 'sfx', id: 'sfx-soin' });
	events.push({
		kind: 'toast',
		text: `${item.name} : ${targets.map((t) => t.name).join(', ')} récupère ${item.use.heal} PV.`,
		tone: 'good',
	});
	return { ...work, events };
}

/* ------------------------------------------------------------------ */
/* Combat                                                              */
/* ------------------------------------------------------------------ */

function firstActor(party: Character[], from: number): number {
	for (let i = 0; i < party.length; i += 1) {
		const idx = (from + i) % party.length;
		if (party[idx].pv > 0) return idx;
	}
	return 0;
}

const livingFoes = (combat: CombatState) => combat.foes.filter((f) => f.hp > 0);
const hasAbility = (c: Character, id: AbilityId) => CLASSES[c.classId].abilities.includes(id);
const heroState = (combat: CombatState, id: string) => (combat.heroes[id] ??= { armor: 0 });
const epuise = (c: Character) => (c.gender === 'm' ? 'épuisé' : c.gender === 'f' ? 'épuisée' : 'épuisé·e');

/**
 * Les créatures du combat, adaptées à la taille du groupe (valeurs écrites pour 4 héros).
 * - Une créature seule (`enemy`) : plus de héros, c'est plus de coups à encaisser par tour
 *   et plus de cibles à abattre ; ses PV et la force de ses coups montent.
 * - Une bande (`foes`, écrite pour une table de 6) : plus de héros, plus de créatures.
 *   On garde les premières de la liste ; leurs PV sont ajustés pour que le total suive la même règle.
 */
export function foeScale(partySize: number) {
	// Au-delà de 4 héros, les coups grossissent à peine : c'est le nombre de créatures et leurs PV qui suivent.
	const damage = partySize <= 4 ? 0.1 + partySize * 0.225 : 1 + (partySize - 4) * 0.15;
	const extra = partySize > 4 ? 1 + (partySize - 4) * 0.1 : 1;
	return { hp: ((partySize * partySize + 4 * partySize) / 32) * extra, damage };
}

/** Nombre de créatures d'une bande écrite pour 6 héros, pour un groupe de `partySize`. */
const bandSize = (listed: number, partySize: number) => Math.min(listed, Math.max(2, Math.round((listed * partySize) / 6)));

/** PV des créatures en plus des cœurs écrits (les héros frappent fort : deux haches, flèches à 3 PV…). */
const SOLID = 1.5;
/** Force des coups des créatures, en plus de ce qui est écrit (les héros encaissent, se soignent et contrôlent beaucoup). */
const HIT = 1.5;

/** Le sort d'une créature, ses dégâts ajustés comme ses coups. */
function spellOf(sp: FoeSpell | undefined, mul: number): { spell?: FoeSpell } {
	if (!sp) return {};
	return { spell: sp.damage && sp.kind !== 'rally' ? { ...sp, damage: Math.max(1, Math.round(sp.damage * mul)) } : sp };
}

function foesOf(def: CombatDef, party: Character[]): FoeState[] {
	const partySize = party.length;
	const { hp: scale, damage: hit } = foeScale(partySize);
	// Un coup ne met jamais KO d'un seul coup un héros en pleine forme : au plus la moitié des PV d'un héros moyen du groupe.
	const maxHit = Math.max(2, Math.round((0.5 * party.reduce((a, c) => a + c.pvMax, 0)) / Math.max(1, partySize)));
	const band = Boolean(def.foes && def.foes.length > 1);
	const all = def.foes?.length ? def.foes : [{ name: def.enemy.name, hearts: def.enemy.hearts }];
	const list = band ? all.slice(0, bandSize(all.length, partySize)) : all;
	// Bande : PV totaux = ceux de la bande à 4 héros × la règle de taille ; ses coups ne grossissent pas (le nombre suffit).
	const hearts = (n: number) => all.slice(0, n).reduce((a, f) => a + f.hearts, 0);
	const hpMul = band ? (scale * hearts(bandSize(all.length, 4))) / hearts(list.length) : scale;
	const dmgMul = band ? 1 : hit;
	return list.map((f, i) => {
		const afflict = 'afflict' in f && f.afflict ? f.afflict : def.enemy.afflict;
		// Des monstres solides : un gros coup ne les abat pas d'un seul coup.
		const hp = Math.max(2, Math.round(f.hearts * 2 * hpMul * SOLID));
		return {
			id: `f${i + 1}`,
			name: f.name,
			hp,
			maxHp: hp,
			image: ('image' in f && f.image) || def.enemy.image,
			damage: Math.max(1, Math.round((('damage' in f && f.damage) || def.enemy.damage) * dmgMul * HIT)),
			move: ('move' in f && f.move) || def.enemy.move || 2,
			maxHit,
			range: ('range' in f && f.range) || def.enemy.range || 1,
			...(('cleave' in f && f.cleave) || (!band && def.enemy.cleave) ? { cleave: true } : {}),
			// Un monstre seul face à 5 héros ou plus : une attaque de plus par tour (pas des coups plus gros).
			...(!band && (def.enemy.attacks || partySize >= 5) ? { attacks: (def.enemy.attacks ?? 1) + (partySize >= 5 ? 1 : 0) } : {}),
			...((('stun' in f && f.stun) || (!band && def.enemy.stun)) ? { stun: ('stun' in f && f.stun) || def.enemy.stun } : {}),
			...spellOf(('spell' in f && f.spell) || (!band ? def.enemy.spell : undefined), dmgMul * HIT),
			...(afflict ? { afflict } : {}),
		};
	});
}

/* ---- La Ronde enchantée : une barrière que rien ne traverse ---- */

/** De quel côté des rondes est cette case (la liste des rondes qui l'entourent ; vide : dehors). */
function sideOf(combat: CombatState, h: Hex): string {
	return (combat.barriers ?? [])
		.map((b, i) => (b.zone.some((z) => sameHex(z, h)) ? String(i) : ''))
		.filter(Boolean)
		.join('|');
}

/** Deux cases du même côté des rondes : on peut aller de l'une à l'autre, et se frapper. */
export function sameSide(combat: CombatState, a: Hex, b: Hex): boolean {
	return !combat.barriers?.length || sideOf(combat, a) === sideOf(combat, b);
}

/** Cases interdites à qui se trouve là (l'autre côté des rondes), en plus des cases occupées. */
function blockedFor(combat: CombatState, id: string): Set<string> {
	const set = occupied(combat, id);
	if (!combat.barriers?.length) return set;
	const here = combat.pos[id];
	for (let r = 0; r < BOARD.rows; r += 1) for (let c = 0; c < BOARD.cols; c += 1) if (!sameSide(combat, here, { c, r })) set.add(hexKey({ c, r }));
	return set;
}

/** Cases occupées (les créatures vaincues libèrent la leur ; les héros épuisés restent couchés là). */
function occupied(combat: CombatState, except?: string): Set<string> {
	const set = new Set<string>();
	for (const [id, h] of Object.entries(combat.pos)) {
		if (id === except) continue;
		const foe = combat.foes.find((f) => f.id === id);
		if (foe && foe.hp <= 0) continue;
		set.add(hexKey(h));
	}
	return set;
}

function nearestHero(heroes: Character[], combat: CombatState, from: Hex): Character | undefined {
	let best: Character | undefined;
	let bestD = Infinity;
	for (const c of heroes) {
		const d = distance(from, combat.pos[c.id]) + Math.random() * 0.5;
		if (d < bestD) {
			bestD = d;
			best = c;
		}
	}
	return best;
}

/**
 * Début du combat : placement sur le plateau (créatures en haut, aventuriers en bas, ceux du contact devant),
 * puis initiative : dé + Agilité + bonus de classe ; les créatures : dé + bonus de difficulté.
 */
function startCombat(game: Game, def: CombatDef, events: GameEvent[]) {
	const foes = foesOf(def, game.party);
	const rolls = [
		...game.party.map((c) => ({ id: c.id, name: c.name, bonus: initiativeOf(c) })),
		{ id: 'enemy', name: def.enemy.name, bonus: ENEMY_INITIATIVE[def.enemy.difficulty] },
	].map((r) => {
		const die = rollD6();
		return { ...r, die, total: die + r.bonus };
	});
	// À égalité, les héros passent avant les monstres.
	rolls.sort((a, b) => b.total - a.total || (a.id === 'enemy' ? 1 : b.id === 'enemy' ? -1 : 0));

	const pos: Record<string, Hex> = {};
	const front = game.party.filter((c) => c.classId === 'guerrier' || c.classId === 'danseur');
	const back = game.party.filter((c) => !front.includes(c));
	startPositions(front.length, [BOARD.rows - 2]).forEach((h, i) => (pos[front[i].id] = h));
	startPositions(back.length, [BOARD.rows - 1]).forEach((h, i) => (pos[back[i].id] = h));
	startPositions(foes.length, [1, 0]).forEach((h, i) => (pos[foes[i].id] = h));

	game.state.combat = {
		foes,
		actor: firstActor(game.party, 0),
		round: 1,
		order: rolls.map((r) => r.id),
		turn: -1,
		initiative: Object.fromEntries(rolls.map((r) => [r.id, { die: r.die, bonus: r.bonus, total: r.total }])),
		ready: {},
		heroes: Object.fromEntries(game.party.map((c) => [c.id, { armor: CLASSES[c.classId].armor }])),
		pos,
		moved: false,
		phase: 'hero',
		intents: [],
		reclaimed: [],
	};
	// Le guerrier attire les regards dès le début (l'Aura de bataille).
	for (const c of game.party.filter((h) => hasAbility(h, 'aura'))) for (const f of foes) addThreat(f, c, 2);
	events.push({ kind: 'initiative', order: rolls });
	log(game.state, 'combat', `Initiative : ${rolls.map((r) => `${r.name} ${r.total}`).join(', ')}.`);
}

/** Menace : ce qu'un héros fait énerve les créatures ; l'Aura de bataille du guerrier la double. */
function addThreat(foe: FoeState, hero: Character, amount: number) {
	if (amount <= 0) return;
	const k = CLASSES[hero.classId].threat ?? 1;
	foe.threat = { ...foe.threat, [hero.id]: (foe.threat?.[hero.id] ?? 0) + amount * k };
}

/** Menace d'un héros sur une créature. */
export const threatOf = (foe: FoeState, heroId: string) => foe.threat?.[heroId] ?? 0;

/** Guerriers qui peuvent s'interposer devant le héros visé par cette créature (Intervention : à 2 cases au plus). */
export function interveners(combat: CombatState | null, party: Character[], intent: Intent): Character[] {
	// Une créature moquée frappe le moqueur, quoi qu'il arrive : personne ne s'interpose.
	if (!combat || intent.why === 'spell' || intent.why === 'taunt' || !intent.heroId) return [];
	const target = combat.pos[intent.heroId];
	if (!target || combat.heroes[intent.heroId]?.protectedBy) return [];
	return activeHeroes(party).filter(
		(c) =>
			hasAbility(c, 'intervention') &&
			c.id !== intent.heroId &&
			!combat.heroes[c.id]?.stunned &&
			!combat.reclaimed.includes(c.id) &&
			distance(combat.pos[c.id], target) <= 2 &&
			sameSide(combat, combat.pos[c.id], target),
	);
}

/** Le sort de la créature est-il prêt (et pas bâillonné) ? */
const spellReady = (combat: CombatState, foe: FoeState) => Boolean(foe.spell) && !foe.silenced && (foe.spellReady ?? 0) <= combat.round;

/**
 * Chaque créature choisit ce qu'elle fait :
 * - elle lance le sort qu'elle préparait (à la place de son attaque) ;
 * - sinon elle attaque celui qui l'a provoquée (Moquerie), sinon celui qui l'énerve le plus (la menace) parmi ceux
 *   qu'elle peut atteindre ce tour-ci, sinon le plus proche.
 */
function computeIntents(game: Game, combat: CombatState): Intent[] {
	const active = activeHeroes(game.party);
	const out: Intent[] = [];
	for (const foe of livingFoes(combat)) {
		if (foe.stunned) continue;
		const at = combat.pos[foe.id];
		if (foe.charging) {
			out.push({ foeId: foe.id, heroId: foe.charging.heroId ?? '', why: 'spell' });
			continue;
		}
		const taunter = foe.taunt ? active.find((c) => c.id === foe.taunt) : undefined;
		if (taunter) {
			out.push({ foeId: foe.id, heroId: taunter.id, why: 'taunt' });
			continue;
		}
		// Ceux qu'elle peut atteindre : à portée ce tour-ci, et pas derrière une Ronde enchantée.
		const side = active.filter((c) => sameSide(combat, at, combat.pos[c.id]));
		const reach = side.filter((c) => distance(at, combat.pos[c.id]) <= foe.move + foe.range);
		const angry = (list: Character[]) => list.filter((c) => threatOf(foe, c.id) > 0).sort((a, b) => threatOf(foe, b.id) - threatOf(foe, a.id) || distance(at, combat.pos[a.id]) - distance(at, combat.pos[b.id]))[0];
		const top = angry(reach) ?? angry(side) ?? angry(active);
		if (top) out.push({ foeId: foe.id, heroId: top.id, why: 'threat' });
		else {
			const near = nearestHero(active, combat, at);
			if (near) out.push({ foeId: foe.id, heroId: near.id, why: 'near' });
		}
	}
	return out;
}

/** Arrivée au tour des monstres : le poison les ronge, puis elles annoncent leur cible. */
function beginEnemyTurn(game: Game, def: CombatDef, events: GameEvent[]): 'intent' | 'done' | 'victory' {
	const combat = game.state.combat!;
	events.push({ kind: 'enemy-turn', name: def.enemy.name, attack: def.enemy.attack ?? `${capitalize(def.enemy.name)} attaque !` });
	for (const foe of livingFoes(combat)) {
		if (!foe.poison) continue;
		const amount = Math.min(1, foe.hp);
		foe.hp -= amount;
		foe.poison -= 1;
		if (!foe.poison) delete foe.poison;
		events.push({ kind: 'foe-poison', foeId: foe.id, name: foe.name, amount, dead: foe.hp <= 0 });
		log(game.state, 'combat', `Le poison ronge ${foe.name} : −1 PV${foe.hp <= 0 ? ', elle s’effondre !' : '.'}`);
	}
	// Plaie béante : l'hémorragie.
	for (const foe of livingFoes(combat)) {
		if (!foe.bleed) continue;
		const amount = Math.min(1, foe.hp);
		foe.hp -= amount;
		foe.bleed -= 1;
		if (!foe.bleed) delete foe.bleed;
		events.push({ kind: 'foe-poison', foeId: foe.id, name: foe.name, amount, dead: foe.hp <= 0, bleed: true });
		log(game.state, 'combat', `${capitalize(foe.name)} saigne : −1 PV${foe.hp <= 0 ? ', elle s’effondre !' : '.'}`);
	}
	if (!livingFoes(combat).length) return 'victory';
	combat.intents = computeIntents(game, combat);
	combat.reclaimed = [];
	if (combat.intents.length) events.push({ kind: 'intent', intents: clone(combat.intents) });
	if (combat.intents.some((i) => interveners(combat, game.party, i).length)) {
		combat.phase = 'intent';
		return 'intent';
	}
	resolveEnemies(game, events);
	// Œil pour œil a pu abattre la dernière.
	return livingFoes(combat).length ? 'done' : 'victory';
}

/** Les effets qui s'usent à chaque tour de la créature (aveuglement, bâillon). */
function wearOff(foe: FoeState) {
	if (foe.blind) {
		foe.blind -= 1;
		if (!foe.blind) delete foe.blind;
	}
	if (foe.silenced) {
		foe.silenced -= 1;
		if (!foe.silenced) delete foe.silenced;
	}
}

/** Après son attaque : si son sort est prêt et qu'elle a quelqu'un à portée, elle le prépare (il partira au tour suivant). */
function maybePrepare(game: Game, foe: FoeState, events: GameEvent[]) {
	const combat = game.state.combat!;
	if (!spellReady(combat, foe) || foe.stunned) return;
	const sp = foe.spell!;
	const at = combat.pos[foe.id];
	const aim = activeHeroes(game.party)
		.filter((c) => distance(at, combat.pos[c.id]) <= sp.range && sameSide(combat, at, combat.pos[c.id]))
		.sort((a, b) => threatOf(foe, b.id) - threatOf(foe, a.id))[0];
	if (sp.kind === 'rally' ? livingFoes(combat).length > 1 : aim) prepareSpell(game, foe, sp.kind === 'rally' ? '' : aim!.id, events);
}

/** La créature prépare son sort : on le voit venir, il partira à son prochain tour. */
function prepareSpell(game: Game, foe: FoeState, heroId: string, events: GameEvent[]) {
	const combat = game.state.combat!;
	const sp = foe.spell!;
	const at = heroId ? combat.pos[heroId] : undefined;
	const zone = sp.kind === 'blast' && at ? [at, ...neighbors(at)] : undefined;
	foe.charging = { ...(heroId ? { heroId } : {}), ...(zone ? { zone } : {}) };
	foe.spellReady = combat.round + sp.every;
	events.push({ kind: 'foe-charge', foeId: foe.id, name: foe.name, spell: sp.name, icon: sp.icon, text: sp.prepare, ...(zone ? { zone } : {}) });
	log(game.state, 'combat', `${capitalize(foe.name)} ${sp.prepare}`);
}

/** Le sort part (ou s'éteint si elle a été bâillonnée entre-temps). */
function castSpell(game: Game, foe: FoeState, events: GameEvent[]) {
	const combat = game.state.combat!;
	const sp = foe.spell!;
	const ch = foe.charging!;
	delete foe.charging;
	if (foe.silenced) {
		events.push({ kind: 'foe-fizzle', foeId: foe.id, name: foe.name, spell: sp.name, why: 'muet' });
		log(game.state, 'combat', `${capitalize(foe.name)}, bâillonnée, ne peut pas lancer ${sp.name} !`);
		return;
	}
	events.push({ kind: 'foe-cast', foeId: foe.id, name: foe.name, spell: sp.name, icon: sp.icon, spellKind: sp.kind });
	const active = activeHeroes(game.party);
	// Moquée entre-temps : un sort qui vise quelqu'un part sur le moqueur.
	const taunter = foe.taunt ? active.find((c) => c.id === foe.taunt) : undefined;
	const target = (sp.kind === 'bolt' || sp.kind === 'sleep') && taunter ? taunter : active.find((c) => c.id === ch.heroId);
	if (taunter && (sp.kind === 'bolt' || sp.kind === 'sleep')) {
		delete foe.taunt;
		delete foe.enraged;
	}
	const inReach = (c: Character) => distance(combat.pos[foe.id], combat.pos[c.id]) <= sp.range + 1;
	if (sp.kind === 'rally') {
		for (const f of livingFoes(combat)) if (f.id !== foe.id) f.rallied = (f.rallied ?? 0) + (sp.damage ?? 1);
		log(game.state, 'combat', `${capitalize(foe.name)} lance ${sp.name} : les autres frapperont plus fort !`);
	} else if (sp.kind === 'blast') {
		const zone = new Set((ch.zone ?? []).map(hexKey));
		const hit = active.filter((c) => zone.has(hexKey(combat.pos[c.id])) && sameSide(combat, combat.pos[foe.id], combat.pos[c.id]));
		log(game.state, 'combat', `${capitalize(foe.name)} lance ${sp.name}${hit.length ? '' : ' : tout le monde s’est écarté à temps !'}`);
		for (const c of hit) foeAttack(game, foe, c, events, { damage: sp.damage, spell: sp.name, afflict: sp.afflict, guardable: false });
	} else if (target && !sameSide(combat, combat.pos[foe.id], combat.pos[target.id])) {
		events.push({ kind: 'foe-blocked', foeId: foe.id, name: foe.name, heroId: target.id });
		log(game.state, 'combat', `${capitalize(foe.name)} lance ${sp.name}… qui s’écrase sur la Ronde enchantée !`);
	} else if (!target || !inReach(target)) {
		log(game.state, 'combat', `${capitalize(foe.name)} lance ${sp.name}… mais sa cible est hors de portée !`);
	} else if (sp.kind === 'sleep') {
		heroState(combat, target.id).stunned = true;
		events.push({ kind: 'foe-attack', foeId: foe.id, name: foe.name, heroId: target.id, amount: 0, absorbed: 0, shielded: 0, stunned: true, spell: sp.name });
		log(game.state, 'combat', `${capitalize(foe.name)} lance ${sp.name} : ${target.name} s’endort et passera son tour.`);
	} else foeAttack(game, foe, target, events, { damage: sp.damage, spell: sp.name, afflict: sp.afflict });
}

/** Les créatures agissent : sort, ou elle avance vers sa cible et frappe si elle l'atteint. */
function resolveEnemies(game: Game, events: GameEvent[]) {
	const combat = game.state.combat!;
	for (const foe of livingFoes(combat)) {
		if (foe.stunned) {
			const reason = foe.stunKind ?? 'assomme';
			foe.stunned -= 1;
			if (!foe.stunned) {
				delete foe.stunned;
				delete foe.stunKind;
			}
			events.push({ kind: 'foe-skip', foeId: foe.id, name: foe.name, reason });
			const what = { filet: 'se débat dans le filet', sommeil: 'dort à poings fermés', piege: 'est coincée dans un piège', folie: 'tourne en rond, complètement folle', assomme: 'est encore sonnée' }[reason];
			log(game.state, 'combat', `${capitalize(foe.name)} ${what} et passe son tour.`);
			// Sonnée, prise au filet, endormie : le sort qu'elle préparait s'éteint.
			if (foe.charging && foe.spell) {
				delete foe.charging;
				events.push({ kind: 'foe-fizzle', foeId: foe.id, name: foe.name, spell: foe.spell.name, why: 'assomme' });
			}
			continue;
		}
		const active = activeHeroes(game.party);
		if (!active.length) break;
		const intent = combat.intents.find((i) => i.foeId === foe.id);
		if (foe.charging && foe.spell) {
			castSpell(game, foe, events);
			wearOff(foe);
			continue;
		}
		const target = active.find((c) => c.id === intent?.heroId) ?? nearestHero(active, combat, combat.pos[foe.id]);
		if (!target) break;
		const from = combat.pos[foe.id];
		const to = approach(from, combat.pos[target.id], foe.range, foe.move, blockedFor(combat, foe.id));
		if (!sameHex(from, to)) {
			combat.pos[foe.id] = to;
			events.push({ kind: 'foe-move', foeId: foe.id, from, to });
		}
		const taunted = foe.taunt === target.id;
		delete foe.taunt;
		if (distance(to, combat.pos[target.id]) > foe.range) {
			log(game.state, 'combat', `${capitalize(foe.name)} s’approche de ${target.name}.`);
			maybePrepare(game, foe, events);
			wearOff(foe);
			continue;
		}
		// La Ronde enchantée les sépare : elle tape sur le mur de notes.
		if (!sameSide(combat, to, combat.pos[target.id])) {
			events.push({ kind: 'foe-blocked', foeId: foe.id, name: foe.name, heroId: target.id });
			log(game.state, 'combat', `${capitalize(foe.name)} se cogne contre la Ronde enchantée : rien ne passe !`);
			if (taunted) delete foe.enraged;
			maybePrepare(game, foe, events);
			wearOff(foe);
			continue;
		}
		const near = (h: Character) => h.pv > 0 && distance(combat.pos[foe.id], combat.pos[h.id]) <= 1 && sameSide(combat, combat.pos[foe.id], combat.pos[h.id]);
		// Plusieurs attaques (le Loup) : la même cible, ou s'il est tombé, le héros le plus proche à sa portée.
		let aim: Character | undefined = target;
		for (let n = 0; n < (foe.attacks ?? 1) && aim && foe.hp > 0; n += 1) {
			// Coup balayé (la première attaque) : ceux qui sont collés à elle, à côté de sa cible (regardés avant le coup).
			const swept = foe.cleave && n === 0 ? activeHeroes(game.party).filter((h) => h.id !== aim!.id && near(h)) : [];
			const first = n === 0;
			const rage = first && taunted && Boolean(foe.enraged);
			const struck = foeAttack(game, foe, aim, events, { taunted: first && taunted, rage });
			for (const h of swept) if (foe.hp > 0 && h.pv > 0 && h.id !== struck) foeAttack(game, foe, h, events, { cleave: true });
			if (aim.pv <= 0) aim = activeHeroes(game.party).filter((h) => distance(combat.pos[foe.id], combat.pos[h.id]) <= foe.range && sameSide(combat, combat.pos[foe.id], combat.pos[h.id])).sort((a, b) => distance(combat.pos[foe.id], combat.pos[a.id]) - distance(combat.pos[foe.id], combat.pos[b.id]))[0];
		}
		if (taunted) delete foe.enraged;
		delete foe.rallied;
		if (foe.hp > 0) maybePrepare(game, foe, events);
		wearOff(foe);
	}
	combat.phase = 'hero';
	combat.intents = [];
	combat.reclaimed = [];
}

/** Les dés de la rage (Moquerie) : +25 %, +50 %, +75 % ou +100 %. */
const RAGE = [1.25, 1.5, 1.75, 2];

interface Blow {
	taunted?: boolean;
	cleave?: boolean;
	/** Enragée par la Moquerie. */
	rage?: boolean;
	/** Un sort : ses dégâts, son nom, son mal. */
	damage?: number;
	spell?: string;
	afflict?: Affliction;
	/** Le guerrier peut-il s'interposer (pas devant un souffle qui couvre une zone) ? */
	guardable?: boolean;
}

/** Une créature frappe (ou son sort touche) ; renvoie le héros réellement touché (le guerrier qui s'interpose, sinon la cible). */
function foeAttack(game: Game, foe: FoeState, target: Character, events: GameEvent[], o: Blow = {}): string {
	const combat = game.state.combat!;
	const taunted = Boolean(o.taunted);
	const cleave = Boolean(o.cleave);
	let victim = target;
	let guarded = false;
	// La Moquerie ne se détourne jamais : le coup est pour le moqueur, même si le guerrier le défendait.
	const protector = o.guardable === false || taunted ? undefined : combat.heroes[target.id]?.protectedBy;
	const guard = protector ? activeHeroes(game.party).find((c) => c.id === protector && c.id !== target.id) : undefined;
	if (guard) {
		victim = guard;
		guarded = true;
	}
	// Aveuglée : elle frappe à côté une fois sur deux (ses sorts, eux, partent quand même).
	if (!o.spell && foe.blind && Math.random() < 0.5) {
		events.push({ kind: 'foe-attack', foeId: foe.id, name: foe.name, heroId: victim.id, amount: 0, absorbed: 0, shielded: 0, guarded, taunted, cleave, missed: true });
		log(game.state, 'combat', `${capitalize(foe.name)}, aveuglée, frappe à côté de ${victim.name} !`);
		return victim.id;
	}
	// Cri de rage : le guerrier pare presque tout.
	const guardChance = combat.heroes[victim.id]?.guarding ?? 0;
	const parried = guardChance > 0 && Math.random() < guardChance;
	// Plafonné (personne n'est mis KO d'un coup) ; la rage de la Moquerie, elle, peut le dépasser.
	let base = parried ? 0 : Math.min(foe.maxHit ?? Infinity, (o.damage ?? foe.damage) + (o.spell ? 0 : (foe.rallied ?? 0)));
	const rage = o.rage && victim.id === target.id ? RAGE[Math.floor(Math.random() * RAGE.length)] : undefined;
	if (rage) base = Math.round(base * rage);
	let blow = Math.max(0, base - (guarded ? 1 : 0));
	// Encaisseur : le guerrier absorbe une partie du choc (davantage s'il est endurant).
	const soaked = blow > 0 && hasAbility(victim, 'encaisseur') ? Math.min(blow, victim.stats.endurance >= 8 ? 2 : 1) : 0;
	blow -= soaked;
	const hs = heroState(combat, victim.id);
	const shielded = Math.min(hs.shield ?? 0, blow);
	blow -= shielded;
	if (hs.shield) {
		hs.shield -= shielded;
		if (!hs.shield) delete hs.shield;
	}
	const absorbed = Math.min(hs.armor, blow);
	hs.armor -= absorbed;
	const amount = blow - absorbed;
	let afflict: string | undefined;
	if (amount > 0) victim.pv = Math.max(0, victim.pv - amount);
	// Folie vengeresse : le moindre coup reçu réveille la fureur.
	if (amount + absorbed + shielded > 0 && victim.pv > 0 && hasAbility(victim, 'folie')) hs.fury = true;
	// Gros coup : s'il porte (même sur l'armure), le héros peut être assommé.
	const stunned = !o.spell && amount + absorbed > 0 && victim.pv > 0 && Boolean(foe.stun) && Math.random() < foe.stun!;
	if (stunned) hs.stunned = true;
	const mal = o.afflict ?? (o.spell ? undefined : foe.afflict);
	if (amount > 0 && victim.pv > 0 && mal && Math.random() < (mal.chance ?? 1)) {
		hs.afflict = { ...mal };
		afflict = mal.name;
	}
	events.push({
		kind: 'foe-attack',
		foeId: foe.id,
		name: foe.name,
		heroId: victim.id,
		amount,
		absorbed,
		shielded,
		guarded,
		taunted,
		afflict,
		cleave,
		stunned,
		...(o.spell ? { spell: o.spell } : {}),
		...(rage ? { rage } : {}),
		...(parried ? { parried } : {}),
		...(soaked ? { soaked } : {}),
	});
	const parts = [
		guarded ? `${victim.name} s’interpose devant ${target.name}.` : '',
		parried ? `${victim.name} pare le coup !` : '',
		soaked ? `${victim.name} encaisse le choc (−${soaked}).` : '',
		rage ? `Folle de rage, elle frappe ${Math.round((rage - 1) * 100)} % plus fort !` : '',
		shielded ? `Le bouclier de lune encaisse ${shielded}.` : '',
		absorbed ? `L’armure de ${victim.name} encaisse ${absorbed === 1 ? 'le coup' : `${absorbed} coups`}.` : '',
		amount ? `${victim.name} perd ${amount} PV.` : !shielded && !absorbed && !parried && !soaked ? `${victim.name} ne perd rien.` : '',
		afflict ? `${victim.name} souffre de ${afflict}.` : '',
		stunned ? `${victim.name} est assommé·e et passera son tour.` : '',
	].filter(Boolean);
	const verb = o.spell ? `touche avec ${o.spell}` : cleave ? 'balaie aussi' : 'frappe';
	log(game.state, 'combat', `${capitalize(foe.name)} ${verb} ${guarded ? target.name : victim.name}. ${parts.join(' ')}`);
	if (victim.pv === 0) log(game.state, 'combat', `${victim.name} tombe, ${epuise(victim)} !`);
	// Œil pour œil (passif) : un coup au contact revient à l'envoyeur (même si l'armure l'a encaissé).
	const back = victim.pv > 0 && !o.spell && distance(combat.pos[foe.id], combat.pos[victim.id]) <= 1 ? ABILITIES['oeil-pour-oeil'].riposte : undefined;
	if (back && hasAbility(victim, 'oeil-pour-oeil') && foe.hp > 0 && Math.random() < (back.chance ?? 1)) {
		const hurt = Math.min(back.damage, foe.hp);
		foe.hp -= hurt;
		addThreat(foe, victim, hurt);
		const stunnedFoe = foe.hp > 0 && Math.random() < back.stunChance;
		if (stunnedFoe) {
			foe.stunned = Math.max(foe.stunned ?? 0, 1);
			foe.stunKind = 'assomme';
		}
		events.push({ kind: 'riposte', heroId: victim.id, foeId: foe.id, name: foe.name, amount: hurt, stunned: stunnedFoe, dead: foe.hp <= 0 });
		log(game.state, 'combat', `Œil pour œil : ${victim.name} renvoie le coup, ${foe.name} −${hurt} PV${foe.hp <= 0 ? ' (vaincue !)' : stunnedFoe ? ', assommée !' : '.'}`);
	}
	return victim.id;
}

/** Passe au suivant dans l'ordre de jeu ; les monstres agissent à leur place dans la file. */
function advanceCombat(game: Game, def: CombatDef, events: GameEvent[]): 'hero' | 'intent' | 'defeat' | 'victory' {
	const combat = game.state.combat!;
	const order = combat.order;
	for (let step = 0; step < order.length * 3; step += 1) {
		const turn = (combat.turn + 1) % order.length;
		if (turn === 0 && combat.turn >= 0) {
			combat.round += 1;
			// La colère retombe un peu à chaque tour : l'aggro bouge.
			for (const f of combat.foes) if (f.threat) for (const k of Object.keys(f.threat)) f.threat[k] *= 0.75;
		}
		combat.turn = turn;
		const id = order[turn];
		if (id === 'enemy') {
			const r = beginEnemyTurn(game, def, events);
			if (r === 'victory') return 'victory';
			if (!activeHeroes(game.party).length) return 'defeat';
			if (r === 'intent') return 'intent';
			continue;
		}
		const idx = game.party.findIndex((c) => c.id === id);
		const hero = game.party[idx];
		if (!hero || hero.pv <= 0) continue;
		// Début de son tour : la protection qu'il donnait s'arrête, son mal le ronge.
		for (const h of Object.values(combat.heroes)) if (h.protectedBy === id) delete h.protectedBy;
		// Sa Ronde enchantée s'arrête.
		if (combat.barriers?.some((b) => b.heroId === id)) {
			combat.barriers = combat.barriers.filter((b) => b.heroId !== id);
			if (!combat.barriers.length) delete combat.barriers;
		}
		const hs = combat.heroes[id];
		if (hs?.guarding) delete hs.guarding;
		if (hs?.stunned) {
			delete hs.stunned;
			events.push({ kind: 'hero-skip', heroId: id });
			log(game.state, 'combat', `${hero.name}, encore sonné·e, passe son tour.`);
			continue;
		}
		if (hs?.afflict) {
			// Le Bouclier de lune absorbe aussi les maux (poison, brûlure, froid).
			const shielded = Math.min(hs.shield ?? 0, hs.afflict.damage);
			if (hs.shield) {
				hs.shield -= shielded;
				if (!hs.shield) delete hs.shield;
			}
			const amount = Math.min(hs.afflict.damage - shielded, hero.pv);
			hero.pv -= amount;
			events.push({ kind: 'affliction', heroId: id, name: hs.afflict.name, amount, ...(shielded ? { shielded } : {}) });
			log(game.state, 'combat', `${capitalize(hs.afflict.name)} : ${shielded ? `le bouclier de lune en encaisse ${shielded}, ` : ''}${hero.name} perd ${amount} PV.`);
			hs.afflict.turns -= 1;
			if (hs.afflict.turns <= 0) delete hs.afflict;
			if (hero.pv === 0) {
				log(game.state, 'combat', `${hero.name} tombe, ${epuise(hero)} !`);
				if (!activeHeroes(game.party).length) return 'defeat';
				continue;
			}
		}
		// Mélodie apaisante (sort du barde) : il reprend des PV au début de son tour, quelques tours.
		if (hs?.regen) {
			const gain = Math.min(hs.regen.amount, hero.pvMax - hero.pv);
			hero.pv += gain;
			hs.regen.turns -= 1;
			if (hs.regen.turns <= 0) delete hs.regen;
			if (gain) {
				events.push({ kind: 'support', heroId: id, what: 'heal', targetIds: [id], amount: gain, label: '🎵 Mélodie apaisante' });
				log(game.state, 'combat', `Mélodie apaisante : ${hero.name} +${gain} PV.`);
			}
		}
		combat.actor = idx;
		combat.moved = false;
		events.push({ kind: 'turn', heroId: id });
		return 'hero';
	}
	return activeHeroes(game.party).length ? 'hero' : 'defeat';
}

export type CombatAction =
	| { kind: 'move'; to: Hex }
	| { kind: 'ability'; ability: AbilityId; targets?: string[]; roll: RollResult | null; rerollBy?: string }
	| { kind: 'wait' }
	| { kind: 'intervene'; heroId: string; allyId: string }
	| { kind: 'resolve' }
	| { kind: 'talk'; roll: RollResult; rerollBy?: string }
	| { kind: 'flee'; roll: RollResult; rerollBy?: string };

/** Actions d'un héros en combat (les passives ne sont pas des boutons). */
export function availableAbilities(state: CombatState, hero: Character): Ability[] {
	return CLASSES[hero.classId].abilities.map((id) => ABILITIES[id]).filter((a) => !a.passive);
}

/** Tours à attendre avant de pouvoir relancer une compétence (0 : prête). */
export function cooldownLeft(combat: CombatState, hero: Character, ab: Ability): number {
	const at = combat.ready?.[hero.id]?.[ab.id];
	return at ? Math.max(0, at - combat.round) : 0;
}

export function passiveAbilities(hero: Character): Ability[] {
	return CLASSES[hero.classId].abilities.map((id) => ABILITIES[id]).filter((a) => a.passive);
}

/** Ce qu'une action peut viser depuis la case du héros (créatures et compagnons à portée). */
export function targetsFor(combat: CombatState, party: Character[], hero: Character, ab: Ability): { foes: FoeState[]; allies: Character[] } {
	const here = combat.pos[hero.id];
	const range = ab.range ?? Infinity;
	// Rien ne traverse une Ronde enchantée (sauf la Ronde elle-même, qui se pose où elle veut).
	const across = (h: Hex) => ab.barrier || sameSide(combat, here, h);
	const foes = ['foe', 'foes', 'all'].includes(ab.target)
		? livingFoes(combat).filter((f) => distance(here, combat.pos[f.id]) <= range && across(combat.pos[f.id]))
		: [];
	const allies =
		ab.target === 'ally'
			? (ab.revive ? party : activeHeroes(party)).filter((c) => (c.id === hero.id ? Boolean(ab.self) : distance(here, combat.pos[c.id]) <= range && across(combat.pos[c.id])))
			: [];
	return { foes: foes.sort((a, b) => distance(here, combat.pos[a.id]) - distance(here, combat.pos[b.id])), allies };
}

/** Déflagration : la case d'à côté qui l'éloigne le plus du héros, si elle est libre. */
function pushAway(combat: CombatState, from: Hex, foe: FoeState): Hex | undefined {
	const at = combat.pos[foe.id];
	const taken = blockedFor(combat, foe.id);
	const best = neighbors(at)
		.filter((h) => !taken.has(hexKey(h)) && distance(from, h) > distance(from, at))
		.sort((a, b) => distance(from, b) - distance(from, a))[0];
	return best;
}

/** Une action peut-elle être lancée maintenant (quelqu'un à portée) ? */
export function canUse(combat: CombatState, party: Character[], hero: Character, ab: Ability): boolean {
	// Écho : seul le sort qui résonne peut repartir (gratuitement, même s'il attend son délai).
	if (combat.echo?.heroId === hero.id) {
		if (ab.id !== combat.echo.ability) return false;
	} else if (cooldownLeft(combat, hero, ab)) return false;
	if (ab.target === 'party' || ab.target === 'none' || ab.target === 'hex') return true;
	const t = targetsFor(combat, party, hero, ab);
	return ab.target === 'ally' ? t.allies.length > 0 : t.foes.length > 0;
}

/** Cases où le héros peut aller ce tour-ci. */
export function moveOptions(combat: CombatState, hero: Character): Hex[] {
	if (combat.phase !== 'hero' || combat.moved) return [];
	return reachable(combat.pos[hero.id], CLASSES[hero.classId].move, blockedFor(combat, hero.id));
}

/** Les anciennes parties (combat d'avant le plateau) : on relance proprement le combat en cours. */
export function repairGame(campaign: Campaign, game: Game): Game {
	const combat = game.state.combat as CombatState | null;
	if (!combat || (Array.isArray(combat.foes) && combat.pos)) return game;
	const scene = getScene(campaign, game.state.sceneId);
	if (!scene.combat) return { ...game, state: { ...game.state, combat: null } };
	const work: Game = { state: clone(game.state), party: clone(game.party) };
	startCombat(work, scene.combat, []);
	advanceCombat(work, scene.combat, []);
	return work;
}

/** `free` : l'Écho (le sort repart, sans dé ni délai). */
function resolveAbility(work: Game, def: CombatDef, hero: Character, ab: Ability, action: Extract<CombatAction, { kind: 'ability' }>, events: GameEvent[], free = false) {
	const combat = work.state.combat!;
	const inRange = targetsFor(combat, work.party, hero, ab);
	let foes: FoeState[] = [];
	if (ab.target === 'foe') {
		const f = inRange.foes.find((x) => x.id === action.targets?.[0]) ?? (inRange.foes.length === 1 ? inRange.foes[0] : undefined);
		if (!f) throw new Error('Cible hors de portée');
		foes = [f];
		const mine = (o: FoeState) => ab.barrier || sameSide(combat, combat.pos[hero.id], combat.pos[o.id]);
		if (ab.area) foes.push(...livingFoes(combat).filter((o) => o.id !== f.id && mine(o) && distance(combat.pos[o.id], combat.pos[f.id]) <= 1));
		// Cône : celles juste derrière la première (collées à elle, à 2 cases du héros).
		if (ab.cone) foes.push(...livingFoes(combat).filter((o) => o.id !== f.id && mine(o) && distance(combat.pos[o.id], combat.pos[f.id]) <= 1 && distance(combat.pos[o.id], combat.pos[hero.id]) === 2));
		const chain = ab.chain;
		if (chain) {
			// L'éclair rebondit chaque fois sur la créature la plus proche de la précédente (dans l'ordre : c'est celui de l'effet).
			for (let i = 0; i < chain.jumps; i += 1) {
				const last = foes[foes.length - 1];
				const next = livingFoes(combat)
					.filter((o) => !foes.includes(o) && mine(o) && distance(combat.pos[o.id], combat.pos[last.id]) <= chain.reach)
					.sort((a, b) => distance(combat.pos[a.id], combat.pos[last.id]) - distance(combat.pos[b.id], combat.pos[last.id]))[0];
				if (!next) break;
				foes.push(next);
			}
		}
	} else if (ab.target === 'foes') {
		const chosen = inRange.foes.filter((f) => action.targets?.includes(f.id));
		foes = (chosen.length ? chosen : inRange.foes).slice(0, ab.maxTargets ?? 3);
	} else if (ab.target === 'all') foes = inRange.foes;
	// Cri de rage : toutes les créatures, sauf celles qu'un autre a moquées (la Moquerie ne se détourne jamais).
	else if (ab.rally) foes = livingFoes(combat).filter((f) => sameSide(combat, combat.pos[hero.id], combat.pos[f.id]) && (!f.taunt || f.taunt === hero.id));
	// Une case (Ronde enchantée) : à portée, sur le plateau.
	let at: Hex | undefined;
	if (ab.target === 'hex') {
		const [c, r] = (action.targets?.[0] ?? '').split(',').map(Number);
		at = { c, r };
		if (!Number.isInteger(c) || !Number.isInteger(r) || !inBoard(at) || distance(combat.pos[hero.id], at) > (ab.range ?? Infinity)) throw new Error('Case hors de portée');
	}
	if (['foe', 'foes', 'all'].includes(ab.target) && !foes.length) throw new Error('Personne à portée');
	const ally = ab.target === 'ally' ? inRange.allies.find((c) => c.id === action.targets?.[0]) : undefined;
	if (ab.target === 'ally' && !ally) throw new Error('Compagnon hors de portée');

	// Une volée sur une case (Pièges en pagaille) : les créatures de la case et des 6 voisines.
	if (at && ab.area) {
		const zone = new Set([at, ...neighbors(at)].map(hexKey));
		foes = livingFoes(combat).filter((f) => zone.has(hexKey(combat.pos[f.id])) && sameSide(combat, combat.pos[hero.id], combat.pos[f.id]));
	}
	// Boule de neige (mage) : le sort rebondit sur une créature proche, et encore, tant que la chance tient.
	if (hasAbility(hero, 'boule-de-neige') && ab.spell && ab.damage && foes.length) {
		while (Math.random() < 0.15) {
			const last = foes[foes.length - 1];
			const next = livingFoes(combat)
				.filter((o) => !foes.includes(o) && sameSide(combat, combat.pos[hero.id], combat.pos[o.id]) && distance(combat.pos[o.id], combat.pos[last.id]) <= 2)
				.sort((a, b) => distance(combat.pos[a.id], combat.pos[last.id]) - distance(combat.pos[b.id], combat.pos[last.id]))[0];
			if (!next) break;
			foes.push(next);
			events.push({ kind: 'proc', heroId: hero.id, name: 'Boule de neige', icon: '❄️', foeId: next.id });
		}
	}
	if (!free && cooldownLeft(combat, hero, ab)) throw new Error('Compétence pas encore prête');
	if (ab.every && !free) {
		combat.ready = { ...combat.ready, [hero.id]: { ...combat.ready?.[hero.id], [ab.id]: combat.round + ab.every } };
		events.push({ kind: 'sfx', id: 'sfx-pouvoir' });
	}
	if (ab.spell) events.push({ kind: 'sfx', id: 'sfx-sort' });
	// Une créature prise au filet est touchée à coup sûr ; l'Écho ne rate jamais.
	const netted = foes.length > 0 && foes.every((f) => f.stunned && f.stunKind === 'filet');
	const success = free || !ab.stat || Boolean(action.roll?.success) || netted;
	events.push({ kind: 'ability', heroId: hero.id, ability: ab.id, foeIds: foes.map((f) => f.id), allyId: ally?.id, success, crit: success && Boolean(ab.damage) && Boolean(ab.crit), ...(at ? { at } : {}) });
	const how = action.roll ? `${ab.name} : ${action.roll.die} + ${action.roll.stat} = ${action.roll.total}` : ab.name;
	const names = (list: FoeState[]) => list.map((f) => f.name).join(', ');

	if (!success) {
		events.push({ kind: 'sfx', id: 'sfx-rate' });
		events.push({ kind: 'miss', heroId: hero.id });
		for (const f of foes) if (!ab.damage) events.push({ kind: 'foe-status', foeId: f.id, heroId: hero.id, what: ab.stun?.kind ?? (ab.blind ? 'aveugle' : 'provoque'), failed: true });
		log(work.state, 'combat', `${hero.name} (${how}) rate son coup.`);
		return;
	}

	if (ab.damage) {
		const hs = heroState(combat, hero.id);
		const fury = Boolean(hs.fury);
		if (fury) delete hs.fury;
		const hits: string[] = [];
		for (const foe of foes) {
			let main = ab.damage;
			if (ab.brumeBonus && def.enemy.brume) main *= 2;
			// Œil de lynx : une flèche sur 5 est un coup critique.
			const crit = Boolean(ab.crit) || (Boolean(ab.arrow) && hasAbility(hero, 'oeil-de-lynx') && Math.random() < 0.2);
			// Critique : dégâts doublés (les deux mains). Folie vengeresse : +50 % (arrondi au-dessus), sans être un critique.
			const amount = Math.min(Math.ceil((main + (ab.offhand ?? 0)) * (crit ? 2 : 1) * (fury ? 1.5 : 1)), foe.hp);
			foe.hp -= amount;
			// Menace : les dégâts énervent, un critique deux fois plus.
			addThreat(foe, hero, amount * (crit ? 2 : 1) * (ab.threatMul ?? 1));
			events.push({ kind: 'hit', heroId: hero.id, foeId: foe.id, amount, spell: ab.spell, crit, offhand: Boolean(ab.offhand) });
			hits.push(`${foe.name} −${amount} PV${foe.hp <= 0 ? ' (vaincue !)' : ''}`);
		}
		events.push({ kind: 'sfx', id: ab.spell ? 'sfx-coeur-brise' : 'sfx-coup' });
		log(work.state, 'combat', `${hero.name} (${how})${fury ? ', en pleine folie vengeresse,' : ''} touche : ${hits.join(' · ')}.`);
		// Fureur de l'ours (soin fixe) et Cœur battant (1 chance sur 3 par créature touchée aux haches) : un seul soin affiché.
		const beats = hasAbility(hero, 'coeur-battant') && !ab.spell ? Array.from({ length: hits.length }, () => Math.random() < 1 / 3).filter(Boolean).length : 0;
		if (ab.lifesteal || beats) {
			const gain = Math.min((ab.lifesteal ?? 0) + beats, hero.pvMax - hero.pv);
			hero.pv += gain;
			events.push({ kind: 'support', heroId: hero.id, what: 'heal', targetId: hero.id, amount: gain });
			if (gain && ab.lifesteal) log(work.state, 'combat', `La fureur de l’ours requinque ${hero.name} : +${gain} PV.`);
			else if (gain) log(work.state, 'combat', `Cœur battant : ${hero.name} reprend ${gain} PV.`);
		}
		if (ab.push) {
			const here = combat.pos[hero.id];
			// Les plus loin d'abord : elles libèrent la place pour celles de devant.
			const order = foes.filter((f) => f.hp > 0).sort((a, b) => distance(here, combat.pos[b.id]) - distance(here, combat.pos[a.id]));
			for (const foe of order) {
				const to = pushAway(combat, here, foe);
				if (!to) continue;
				events.push({ kind: 'foe-move', foeId: foe.id, from: combat.pos[foe.id], to, pushed: true });
				combat.pos[foe.id] = to;
			}
		}
	}

	for (const foe of foes.filter((f) => f.hp > 0)) {
		// Contrôler une créature l'énerve aussi.
		if (ab.stun || ab.blind || ab.poison || ab.silence) addThreat(foe, hero, 2);
		if (ab.silence) {
			foe.silenced = Math.max(foe.silenced ?? 0, ab.silence);
			events.push({ kind: 'foe-status', foeId: foe.id, heroId: hero.id, what: 'muet' });
		}
		// Pointes trempées : chaque flèche qui touche peut aveugler, ou bâillonner.
		if (ab.arrow && hasAbility(hero, 'pointes-trempees')) {
			if (Math.random() < 0.25) {
				foe.blind = Math.max(foe.blind ?? 0, 2);
				events.push({ kind: 'foe-status', foeId: foe.id, heroId: hero.id, what: 'aveugle' });
			}
			if (!ab.silence && Math.random() < 0.25) {
				foe.silenced = Math.max(foe.silenced ?? 0, 2);
				events.push({ kind: 'foe-status', foeId: foe.id, heroId: hero.id, what: 'muet' });
			}
		}
		// Plaie béante : une flèche sur 4 fait saigner.
		if (ab.arrow && ab.damage && hasAbility(hero, 'plaie-beante') && Math.random() < 0.25) {
			foe.bleed = Math.max(foe.bleed ?? 0, 2);
			events.push({ kind: 'proc', heroId: hero.id, name: 'Hémorragie', icon: '🩸', foeId: foe.id });
		}
		// Folie (mage) : la créature touchée perd la tête (1 tour seulement pour un gros monstre seul).
		if (ab.spell && ab.damage && hasAbility(hero, 'folie-mage') && Math.random() < 0.15) {
			foe.stunned = Math.max(foe.stunned ?? 0, combat.foes.length === 1 ? 1 : 2);
			foe.stunKind = 'folie';
			events.push({ kind: 'foe-status', foeId: foe.id, heroId: hero.id, what: 'folie' });
		}
		if (ab.stun) {
			foe.stunned = Math.max(foe.stunned ?? 0, ab.stun.turns);
			foe.stunKind = ab.stun.kind;
			events.push({ kind: 'foe-status', foeId: foe.id, heroId: hero.id, what: ab.stun.kind });
		}
		if (ab.poison) {
			foe.poison = Math.max(foe.poison ?? 0, ab.poison);
			events.push({ kind: 'foe-status', foeId: foe.id, heroId: hero.id, what: 'poison' });
		}
		if (ab.blind) {
			foe.blind = Math.max(foe.blind ?? 0, ab.blind);
			events.push({ kind: 'foe-status', foeId: foe.id, heroId: hero.id, what: 'aveugle' });
		}
		if (ab.taunt) {
			foe.taunt = hero.id;
			// Moquerie : il passe en tête de sa menace, et elle est folle de rage.
			const top = Math.max(0, ...Object.values(foe.threat ?? {}));
			foe.threat = { ...foe.threat, [hero.id]: top + 5 };
			if (ab.rage) foe.enraged = true;
			events.push({ kind: 'foe-status', foeId: foe.id, heroId: hero.id, what: 'provoque' });
		}
	}
	if (!ab.damage && !ab.barrier && foes.length) {
		const what = ab.stun?.kind === 'filet' ? 'prend au filet' : ab.stun?.kind === 'sommeil' ? 'endort' : ab.blind ? 'aveugle' : ab.taunt ? 'nargue' : 'vise';
		log(work.state, 'combat', `${hero.name} (${how}) ${what} ${names(foes)} !`);
	}

	if (ab.barrier && at) {
		const zone = [at, ...neighbors(at)];
		combat.barriers = [...(combat.barriers ?? []).filter((b) => b.heroId !== hero.id), { heroId: hero.id, zone }];
		events.push({ kind: 'support', heroId: hero.id, what: 'barrier' });
		log(work.state, 'combat', `${hero.name} joue la Ronde enchantée : un mur de notes tourne autour de ${zone.length} cases. Rien ne passe jusqu’à son prochain tour !`);
	}
	if (ab.rally) {
		heroState(combat, hero.id).guarding = ab.rally;
		for (const foe of foes) {
			foe.taunt = hero.id;
			const top = Math.max(0, ...Object.values(foe.threat ?? {}));
			foe.threat = { ...foe.threat, [hero.id]: top + 5 };
			events.push({ kind: 'foe-status', foeId: foe.id, heroId: hero.id, what: 'provoque' });
		}
		events.push({ kind: 'support', heroId: hero.id, what: 'rally', targetId: hero.id });
		log(work.state, 'combat', `${hero.name} pousse un Cri de rage ! Toutes les créatures se tournent vers ${hero.name}, qui lève son bouclier.`);
	}
	if (ab.protect && ally) {
		heroState(combat, ally.id).protectedBy = hero.id;
		events.push({ kind: 'support', heroId: hero.id, what: 'protect', targetId: ally.id });
		log(work.state, 'combat', `${hero.name} se poste devant ${ally.name} pour le défendre.`);
	}
	if (ab.shield && ally) {
		const hs = heroState(combat, ally.id);
		hs.shield = (hs.shield ?? 0) + ab.shield;
		for (const f of livingFoes(combat)) addThreat(f, hero, ab.shield / 2);
		events.push({ kind: 'support', heroId: hero.id, what: 'shield', targetId: ally.id, amount: ab.shield });
		log(work.state, 'combat', `${hero.name} entoure ${ally.id === hero.id ? 'son propre corps' : ally.name} d’un bouclier de lune.`);
	}
	if (ab.heal && ally) {
		const amount = Math.min(ab.heal, ally.pvMax - ally.pv);
		const revived = ally.pv <= 0 && amount > 0;
		ally.pv += amount;
		if (revived) log(work.state, 'combat', `${ally.name} se relève !`);
		// Soigner attire un peu l'attention de toutes les créatures.
		for (const f of livingFoes(combat)) addThreat(f, hero, amount / 2);
		events.push({ kind: 'sfx', id: 'sfx-soin' });
		events.push({ kind: 'support', heroId: hero.id, what: 'heal', targetId: ally.id, amount });
		log(work.state, 'combat', `${hero.name} joue l’${ab.name} : ${ally.id === hero.id ? 'soi-même' : ally.name} +${amount} PV.`);
	} else if (ab.heal) {
		let healed = 0;
		for (const c of work.party) {
			const gain = c.pv > 0 && sameSide(combat, combat.pos[hero.id], combat.pos[c.id]) ? Math.min(ab.heal, c.pvMax - c.pv) : 0;
			c.pv += gain;
			healed += gain;
		}
		for (const f of livingFoes(combat)) addThreat(f, hero, healed / 2);
		events.push({ kind: 'sfx', id: 'sfx-soin' });
		events.push({ kind: 'support', heroId: hero.id, what: 'heal', amount: ab.heal });
		log(work.state, 'combat', `${hero.name} entonne le ${ab.name} : +${ab.heal} PV pour tout le groupe.`);
	}
	if (ab.regen) {
		const team = activeHeroes(work.party).filter((c) => sameSide(combat, combat.pos[hero.id], combat.pos[c.id]));
		for (const c of team) heroState(combat, c.id).regen = { ...ab.regen };
		events.push({ kind: 'support', heroId: hero.id, what: 'regen', targetIds: team.map((c) => c.id), label: '🎵 Mélodie apaisante' });
		log(work.state, 'combat', `${hero.name} joue la Mélodie apaisante : ${ab.regen.amount} PV au début de chaque tour, pendant ${ab.regen.turns} tours.`);
	}
	// Les passifs du barde, à chaque sort (pas sur l'Écho : une seule fois).
	if (ab.spell && !free) {
		const team = activeHeroes(work.party).filter((c) => sameSide(combat, combat.pos[hero.id], combat.pos[c.id]));
		if (hasAbility(hero, 'coeur-vaillant') && Math.random() < 0.25) {
			const healed = team.filter((c) => c.pv < c.pvMax);
			for (const c of healed) c.pv = Math.min(c.pvMax, c.pv + 2);
			events.push({ kind: 'support', heroId: hero.id, what: 'heal', targetIds: team.map((c) => c.id), amount: 2, label: '💛 Cœur vaillant' });
			log(work.state, 'combat', `Cœur vaillant : la musique de ${hero.name} redonne courage à tout le groupe (+2 PV).`);
		}
		if (hasAbility(hero, 'note-purete') && Math.random() < 0.15 && team.length) {
			const weak = [...team].sort((a, b) => a.pv / a.pvMax - b.pv / b.pvMax)[0];
			const hs = heroState(combat, weak.id);
			hs.shield = (hs.shield ?? 0) + 2;
			events.push({ kind: 'support', heroId: hero.id, what: 'shield', targetIds: [weak.id], amount: 2, label: '🤍 Note de pureté' });
			log(work.state, 'combat', `Note de pureté : un petit bouclier (2) entoure ${weak.name}.`);
		}
	}
	if (ab.cleanse) {
		const healed = work.party.filter((c) => combat.heroes[c.id]?.afflict && sameSide(combat, combat.pos[hero.id], combat.pos[c.id]));
		for (const c of healed) delete combat.heroes[c.id].afflict;
		events.push({ kind: 'sfx', id: 'sfx-soin' });
		events.push({ kind: 'support', heroId: hero.id, what: 'cleanse' });
		log(work.state, 'combat', healed.length ? `${hero.name} chante : ${healed.map((c) => c.name).join(', ')} ${healed.length > 1 ? 'sont délivrés' : 'est délivré·e'} de leurs maux.` : `${hero.name} chante une mélodie claire : personne ne souffre de rien.`);
	}
}

/** Une étape de combat : déplacement, action, Intervention… puis la suite de la file. */
export function combatTurn(campaign: Campaign, game: Game, action: CombatAction): StepResult {
	const scene = getScene(campaign, game.state.sceneId);
	const def = scene.combat;
	if (!def || !game.state.combat) throw new Error('Pas de combat en cours');

	const events: GameEvent[] = [];
	const work: Game = { state: clone(game.state), party: clone(game.party) };
	const combat = work.state.combat!;
	const hero = work.party[combat.actor];
	if ('rerollBy' in action && action.rerollBy) spendPower(work, action.rerollBy);
	const rollText = (r: RollResult) => `${r.die} + ${r.stat} = ${r.total}`;

	/** Le combat se termine : on garde une photo du plateau pour en jouer la fin à l'écran. */
	const ended = (result: 'victory' | 'defeat' | 'peace' | 'escape') => {
		events.push({ kind: 'combat-end', result, name: def.enemy.name, combat: clone(work.state.combat!) });
		// Personne ne meurt à Valombre : les héros KO se relèvent, sonnés, avec 1 PV.
		for (const c of work.party.filter((h) => h.pv <= 0)) {
			c.pv = 1;
			events.push({ kind: 'wake', heroId: c.id });
			log(work.state, 'combat', `${c.name}, qui était KO, se relève avec 1 PV.`);
		}
	};
	const finish = (result: 'hero' | 'intent' | 'defeat' | 'victory'): StepResult => {
		if (result === 'victory' || result === 'defeat') ended(result);
		if (result === 'victory') {
			log(work.state, 'combat', `Victoire contre ${def.enemy.name}`);
			if (def.victory.text) events.push({ kind: 'narration', text: def.victory.text });
			applyEffects(campaign, work, def.victory.effects, events);
			nextSpokes(work);
			return enterScene(campaign, work, def.victory.to, events);
		}
		if (result === 'defeat') {
			log(work.state, 'combat', `Le groupe est épuisé…`);
			if (def.defeat.text) events.push({ kind: 'narration', text: def.defeat.text });
			applyEffects(campaign, work, def.defeat.effects, events);
			return enterScene(campaign, work, def.defeat.to, events);
		}
		return { ...work, events };
	};
	const afterHero = () => (livingFoes(combat).length ? finish(advanceCombat(work, def, events)) : finish('victory'));
	const afterEnemies = () => {
		resolveEnemies(work, events);
		if (!livingFoes(combat).length) return finish('victory');
		if (!activeHeroes(work.party).length) return finish('defeat');
		return finish(advanceCombat(work, def, events));
	};

	/* ---- Tour des monstres : le guerrier s'interpose (Intervention), ou on les laisse faire ---- */
	if (combat.phase === 'intent') {
		if (action.kind === 'intervene') {
			const who = work.party.find((c) => c.id === action.heroId);
			const intent = combat.intents.find((i) => i.heroId === action.allyId && interveners(combat, work.party, i).some((c) => c.id === action.heroId));
			const ally = work.party.find((c) => c.id === action.allyId);
			if (!who || !ally || !intent) throw new Error('Impossible de s’interposer');
			combat.reclaimed.push(who.id);
			heroState(combat, ally.id).protectedBy = who.id;
			events.push({ kind: 'sfx', id: 'sfx-succes' });
			events.push({ kind: 'intervene', heroId: who.id, allyId: ally.id });
			log(work.state, 'combat', `${who.name} se jette devant ${ally.name} : les coups seront pour ${who.name} !`);
			if (combat.intents.some((i) => interveners(combat, work.party, i).length)) return finish('intent');
			return afterEnemies();
		}
		if (action.kind === 'resolve') return afterEnemies();
		throw new Error('Les monstres vont agir');
	}

	/* ---- Tour d'un héros ---- */
	if (action.kind === 'move') {
		if (!moveOptions(combat, hero).some((h) => sameHex(h, action.to))) throw new Error('Case inaccessible');
		const from = combat.pos[hero.id];
		combat.pos[hero.id] = action.to;
		combat.moved = true;
		events.push({ kind: 'hero-move', heroId: hero.id, from, to: action.to });
		return { ...work, events };
	}
	if (action.kind === 'wait') {
		if (combat.echo) {
			delete combat.echo;
			log(work.state, 'combat', `${hero.name} laisse l’écho s’éteindre.`);
		} else log(work.state, 'combat', `${hero.name} attend son heure.`);
		return afterHero();
	}
	if (action.kind === 'talk' && def.talk) {
		log(work.state, 'combat', `${hero.name} tente de parlementer (${rollText(action.roll)}) : ${action.roll.success ? 'ça marche !' : 'raté…'}`);
		if (action.roll.success) {
			events.push({ kind: 'sfx', id: 'sfx-succes' });
			ended('peace');
			if (def.talk.outcome.text) events.push({ kind: 'narration', text: def.talk.outcome.text });
			applyEffects(campaign, work, def.talk.outcome.effects, events);
			nextSpokes(work);
			return enterScene(campaign, work, def.talk.outcome.to, events);
		}
		events.push({ kind: 'sfx', id: 'sfx-echec' });
		events.push({ kind: 'miss', heroId: hero.id });
		return afterHero();
	}
	if (action.kind === 'flee' && def.flee) {
		log(work.state, 'combat', `${hero.name} tente de fuir (${rollText(action.roll)}) : ${action.roll.success ? 'ça marche !' : 'raté…'}`);
		if (action.roll.success) {
			ended('escape');
			if (def.flee.outcome.text) events.push({ kind: 'narration', text: def.flee.outcome.text });
			applyEffects(campaign, work, def.flee.outcome.effects, events);
			nextSpokes(work);
			return enterScene(campaign, work, def.flee.outcome.to, events);
		}
		events.push({ kind: 'sfx', id: 'sfx-echec' });
		events.push({ kind: 'miss', heroId: hero.id });
		return afterHero();
	}
	if (action.kind === 'ability') {
		const ab = ABILITIES[action.ability];
		if (!ab || !availableAbilities(combat, hero).some((a) => a.id === ab.id)) throw new Error('Action impossible');
		// Le second lancer de l'Écho : gratuit, sans dé, sur la cible choisie ; il ne résonne pas à son tour.
		const echoing = combat.echo?.heroId === hero.id;
		if (echoing && combat.echo!.ability !== ab.id) throw new Error('L’écho ne relance que le même sort');
		resolveAbility(work, def, hero, ab, echoing ? { ...action, roll: null } : action, events, echoing);
		delete combat.echo;
		if (echoing || !livingFoes(combat).length) return afterHero();
		// Écho (mage, barde) : 1 chance sur 4 que le sort résonne. Un sort qui vise : le héros choisit la nouvelle cible
		// (son tour continue) ; un sort sans cible (chant, mélodie) repart tout seul.
		if (ab.spell && hasAbility(hero, 'echo') && hero.pv > 0 && Math.random() < 0.25) {
			events.push({ kind: 'proc', heroId: hero.id, name: 'Écho', icon: '🔁' });
			const aimed = ab.target === 'foe' || ab.target === 'foes' || ab.target === 'ally' || ab.target === 'hex';
			if (aimed) {
				combat.echo = { heroId: hero.id, ability: ab.id };
				if (canUse(combat, work.party, hero, ab)) {
					log(work.state, 'combat', `Écho ! ${hero.name} peut relancer ${ab.name}, gratuitement, sur la cible de son choix.`);
					return { ...work, events };
				}
				delete combat.echo;
				events.pop();
			} else {
				const mark = events.length - 1;
				try {
					resolveAbility(work, def, hero, ab, { ...action, roll: null }, events, true);
					log(work.state, 'combat', `Écho : le sort de ${hero.name} repart !`);
				} catch {
					// Plus personne à toucher (tout est tombé) : l'écho s'éteint.
					events.splice(mark);
				}
			}
		}
		return afterHero();
	}
	throw new Error('Action inconnue');
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function classPowerLabel(c: Character) {
	return CLASSES[c.classId].power.name;
}
