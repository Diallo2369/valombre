import { BOARD, approach, distance, hexKey, neighbors, reachable, sameHex, startPositions, type Hex } from './board';
import { ABILITIES, CLASSES, ENEMY_INITIATIVE, STAT_LABEL, computePvMax, evaluateRoll, initiativeOf, levelFromXp, rollD6, type Ability, type AbilityId, type RollResult } from './rules';
import { voiceHash } from './voices';
import type {
	Campaign,
	Character,
	CheckDef,
	Choice,
	CombatDef,
	CombatState,
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
	return { hp: (partySize * partySize + 4 * partySize) / 32, damage: 0.1 + partySize * 0.225 };
}

/** Nombre de créatures d'une bande écrite pour 6 héros, pour un groupe de `partySize`. */
const bandSize = (listed: number, partySize: number) => Math.min(listed, Math.max(2, Math.round((listed * partySize) / 6)));

function foesOf(def: CombatDef, partySize: number): FoeState[] {
	const { hp: scale, damage: hit } = foeScale(partySize);
	const band = Boolean(def.foes && def.foes.length > 1);
	const all = def.foes?.length ? def.foes : [{ name: def.enemy.name, hearts: def.enemy.hearts }];
	const list = band ? all.slice(0, bandSize(all.length, partySize)) : all;
	// Bande : PV totaux = ceux de la bande à 4 héros × la règle de taille ; ses coups ne grossissent pas (le nombre suffit).
	const hearts = (n: number) => all.slice(0, n).reduce((a, f) => a + f.hearts, 0);
	const hpMul = band ? (scale * hearts(bandSize(all.length, 4))) / hearts(list.length) : scale;
	const dmgMul = band ? 1 : hit;
	return list.map((f, i) => {
		const afflict = 'afflict' in f && f.afflict ? f.afflict : def.enemy.afflict;
		const hp = Math.max(2, Math.round(f.hearts * 2 * hpMul));
		return {
			id: `f${i + 1}`,
			name: f.name,
			hp,
			maxHp: hp,
			image: ('image' in f && f.image) || def.enemy.image,
			damage: Math.max(1, Math.round((('damage' in f && f.damage) || def.enemy.damage) * dmgMul)),
			move: ('move' in f && f.move) || def.enemy.move || 2,
			range: ('range' in f && f.range) || def.enemy.range || 1,
			...(('cleave' in f && f.cleave) || (!band && def.enemy.cleave) ? { cleave: true } : {}),
			...(!band && def.enemy.attacks ? { attacks: def.enemy.attacks } : {}),
			...((('stun' in f && f.stun) || (!band && def.enemy.stun)) ? { stun: ('stun' in f && f.stun) || def.enemy.stun } : {}),
			...(afflict ? { afflict } : {}),
		};
	});
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
	const foes = foesOf(def, game.party.length);
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
	events.push({ kind: 'initiative', order: rolls });
	log(game.state, 'combat', `Initiative : ${rolls.map((r) => `${r.name} ${r.total}`).join(', ')}.`);
}

/** Héros qui peuvent tenter de détourner cette créature vers eux (guerrier, virevolteur). */
export function reclaimers(combat: CombatState | null, party: Character[], intent: Intent): Character[] {
	if (!combat || intent.tried) return [];
	return activeHeroes(party).filter((c) => CLASSES[c.classId].aggro && c.id !== intent.heroId && !combat.reclaimed.includes(c.id));
}

/** Chaque créature choisit sa cible : celui qui l'a provoquée, sinon le guerrier (aura, jet caché), sinon le plus proche. */
function computeIntents(game: Game, combat: CombatState): Intent[] {
	const active = activeHeroes(game.party);
	const tank = active.find((c) => hasAbility(c, 'aura'));
	const out: Intent[] = [];
	for (const foe of livingFoes(combat)) {
		if (foe.stunned) continue;
		const taunter = foe.taunt ? active.find((c) => c.id === foe.taunt) : undefined;
		if (taunter) out.push({ foeId: foe.id, heroId: taunter.id, why: 'taunt' });
		// Aura de bataille : la créature lui résiste seulement sur 5 ou 6 (jet qu'on ne voit pas).
		else if (tank && rollD6() <= 4) out.push({ foeId: foe.id, heroId: tank.id, why: 'aura' });
		else {
			const near = nearestHero(active, combat, combat.pos[foe.id]);
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
	if (!livingFoes(combat).length) return 'victory';
	combat.intents = computeIntents(game, combat);
	combat.reclaimed = [];
	if (combat.intents.length) events.push({ kind: 'intent', intents: clone(combat.intents) });
	if (combat.intents.some((i) => reclaimers(combat, game.party, i).length)) {
		combat.phase = 'intent';
		return 'intent';
	}
	resolveEnemies(game, events);
	// Œil pour œil a pu abattre la dernière.
	return livingFoes(combat).length ? 'done' : 'victory';
}

/** Les créatures agissent : chacune avance vers sa cible et frappe si elle l'atteint. */
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
			const what = reason === 'filet' ? 'se débat dans le filet' : reason === 'sommeil' ? 'dort à poings fermés' : 'est encore sonnée';
			log(game.state, 'combat', `${capitalize(foe.name)} ${what} et passe son tour.`);
			continue;
		}
		const active = activeHeroes(game.party);
		if (!active.length) break;
		const intent = combat.intents.find((i) => i.foeId === foe.id);
		const target = active.find((c) => c.id === intent?.heroId) ?? nearestHero(active, combat, combat.pos[foe.id]);
		if (!target) break;
		const from = combat.pos[foe.id];
		const to = approach(from, combat.pos[target.id], foe.range, foe.move, occupied(combat, foe.id));
		if (!sameHex(from, to)) {
			combat.pos[foe.id] = to;
			events.push({ kind: 'foe-move', foeId: foe.id, from, to });
		}
		const taunted = foe.taunt === target.id;
		delete foe.taunt;
		if (distance(to, combat.pos[target.id]) > foe.range) {
			log(game.state, 'combat', `${capitalize(foe.name)} s’approche de ${target.name}.`);
			continue;
		}
		const near = (h: Character) => h.pv > 0 && distance(combat.pos[foe.id], combat.pos[h.id]) <= 1;
		// Plusieurs attaques (le Loup) : la même cible, ou s'il est tombé, le héros le plus proche à sa portée.
		let aim: Character | undefined = target;
		for (let n = 0; n < (foe.attacks ?? 1) && aim && foe.hp > 0; n += 1) {
			// Coup balayé (la première attaque) : ceux qui sont collés à elle, à côté de sa cible (regardés avant le coup).
			const swept = foe.cleave && n === 0 ? activeHeroes(game.party).filter((h) => h.id !== aim!.id && near(h)) : [];
			const struck = foeAttack(game, foe, aim, n === 0 && intent?.why === 'aura', n === 0 && (taunted || intent?.why === 'taunt'), events);
			for (const h of swept) if (foe.hp > 0 && h.pv > 0 && h.id !== struck) foeAttack(game, foe, h, false, false, events, true);
			if (aim.pv <= 0) aim = activeHeroes(game.party).filter((h) => distance(combat.pos[foe.id], combat.pos[h.id]) <= foe.range).sort((a, b) => distance(combat.pos[foe.id], combat.pos[a.id]) - distance(combat.pos[foe.id], combat.pos[b.id]))[0];
		}
		if (foe.blind) {
			foe.blind -= 1;
			if (!foe.blind) delete foe.blind;
		}
	}
	combat.phase = 'hero';
	combat.intents = [];
	combat.reclaimed = [];
}

/** Une créature frappe ; renvoie le héros réellement touché (le guerrier qui s'interpose, sinon la cible). */
function foeAttack(game: Game, foe: FoeState, target: Character, aura: boolean, taunted: boolean, events: GameEvent[], cleave = false): string {
	const combat = game.state.combat!;
	let victim = target;
	let guarded = false;
	const protector = combat.heroes[target.id]?.protectedBy;
	const guard = protector ? activeHeroes(game.party).find((c) => c.id === protector && c.id !== target.id) : undefined;
	if (guard) {
		victim = guard;
		guarded = true;
	}
	// Aveuglée : elle frappe à côté une fois sur deux.
	if (foe.blind && Math.random() < 0.5) {
		events.push({ kind: 'foe-attack', foeId: foe.id, name: foe.name, heroId: victim.id, amount: 0, absorbed: 0, shielded: 0, guarded, aura, taunted, cleave, missed: true });
		log(game.state, 'combat', `${capitalize(foe.name)}, aveuglée, frappe à côté de ${victim.name} !`);
		return victim.id;
	}
	let blow = Math.max(0, foe.damage - (guarded ? 1 : 0));
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
	const stunned = amount + absorbed > 0 && victim.pv > 0 && Boolean(foe.stun) && Math.random() < foe.stun!;
	if (stunned) hs.stunned = true;
	if (amount > 0 && victim.pv > 0 && foe.afflict && Math.random() < (foe.afflict.chance ?? 1)) {
		hs.afflict = { ...foe.afflict };
		afflict = foe.afflict.name;
	}
	events.push({ kind: 'foe-attack', foeId: foe.id, name: foe.name, heroId: victim.id, amount, absorbed, shielded, guarded, aura, taunted, afflict, cleave, stunned });
	const parts = [
		guarded ? `${victim.name} s’interpose devant ${target.name}.` : '',
		shielded ? `Le bouclier de lune encaisse ${shielded}.` : '',
		absorbed ? `L’armure de ${victim.name} encaisse ${absorbed === 1 ? 'le coup' : `${absorbed} coups`}.` : '',
		amount ? `${victim.name} perd ${amount} PV.` : !shielded && !absorbed ? `${victim.name} ne perd rien.` : '',
		afflict ? `${victim.name} souffre de ${afflict}.` : '',
		stunned ? `${victim.name} est assommé·e et passera son tour.` : '',
	].filter(Boolean);
	log(game.state, 'combat', `${capitalize(foe.name)} ${cleave ? 'balaie aussi' : 'frappe'} ${guarded ? target.name : victim.name}. ${parts.join(' ')}`);
	if (victim.pv === 0) log(game.state, 'combat', `${victim.name} tombe, ${epuise(victim)} !`);
	// Œil pour œil : le coup revient à l'envoyeur (même si l'armure l'a encaissé).
	const back = hs.riposte;
	if (back && foe.hp > 0) {
		const hurt = Math.min(back.damage, foe.hp);
		foe.hp -= hurt;
		const stunned = foe.hp > 0 && Math.random() < back.stunChance;
		if (stunned) {
			foe.stunned = Math.max(foe.stunned ?? 0, 1);
			foe.stunKind = 'assomme';
		}
		events.push({ kind: 'riposte', heroId: victim.id, foeId: foe.id, name: foe.name, amount: hurt, stunned, dead: foe.hp <= 0 });
		log(game.state, 'combat', `Œil pour œil : ${victim.name} renvoie le coup, ${foe.name} −${hurt} PV${foe.hp <= 0 ? ' (vaincue !)' : stunned ? ', assommée !' : '.'}`);
	}
	return victim.id;
}

/** Passe au suivant dans l'ordre de jeu ; les monstres agissent à leur place dans la file. */
function advanceCombat(game: Game, def: CombatDef, events: GameEvent[]): 'hero' | 'intent' | 'defeat' | 'victory' {
	const combat = game.state.combat!;
	const order = combat.order;
	for (let step = 0; step < order.length * 3; step += 1) {
		const turn = (combat.turn + 1) % order.length;
		if (turn === 0 && combat.turn >= 0) combat.round += 1;
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
		const hs = combat.heroes[id];
		if (hs?.riposte) delete hs.riposte;
		if (hs?.stunned) {
			delete hs.stunned;
			events.push({ kind: 'hero-skip', heroId: id });
			log(game.state, 'combat', `${hero.name}, encore sonné·e, passe son tour.`);
			continue;
		}
		if (hs?.afflict) {
			const amount = Math.min(hs.afflict.damage, hero.pv);
			hero.pv -= amount;
			events.push({ kind: 'affliction', heroId: id, name: hs.afflict.name, amount });
			log(game.state, 'combat', `${capitalize(hs.afflict.name)} : ${hero.name} perd ${amount} PV.`);
			hs.afflict.turns -= 1;
			if (hs.afflict.turns <= 0) delete hs.afflict;
			if (hero.pv === 0) {
				log(game.state, 'combat', `${hero.name} tombe, ${epuise(hero)} !`);
				if (!activeHeroes(game.party).length) return 'defeat';
				continue;
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
	| { kind: 'reclaim'; foeId: string; heroId: string; roll: RollResult; rerollBy?: string }
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
	const foes = ['foe', 'foes', 'all'].includes(ab.target)
		? livingFoes(combat).filter((f) => distance(here, combat.pos[f.id]) <= range && (!ab.leap || Boolean(landing(combat, hero, f))))
		: [];
	const allies =
		ab.target === 'ally'
			? activeHeroes(party).filter((c) => (c.id === hero.id ? Boolean(ab.self) : distance(here, combat.pos[c.id]) <= range))
			: [];
	return { foes: foes.sort((a, b) => distance(here, combat.pos[a.id]) - distance(here, combat.pos[b.id])), allies };
}

/** Bond sauvage : la case où le héros atterrit, collée à la créature (la plus proche de lui ; la sienne s'il y est déjà). */
function landing(combat: CombatState, hero: Character, foe: FoeState): Hex | undefined {
	const here = combat.pos[hero.id];
	if (distance(here, combat.pos[foe.id]) <= 1) return here;
	const taken = occupied(combat, hero.id);
	return neighbors(combat.pos[foe.id])
		.filter((h) => !taken.has(hexKey(h)))
		.sort((a, b) => distance(here, a) - distance(here, b))[0];
}

/** Déflagration : la case d'à côté qui l'éloigne le plus du héros, si elle est libre. */
function pushAway(combat: CombatState, from: Hex, foe: FoeState): Hex | undefined {
	const at = combat.pos[foe.id];
	const taken = occupied(combat, foe.id);
	const best = neighbors(at)
		.filter((h) => !taken.has(hexKey(h)) && distance(from, h) > distance(from, at))
		.sort((a, b) => distance(from, b) - distance(from, a))[0];
	return best;
}

/** Une action peut-elle être lancée maintenant (quelqu'un à portée) ? */
export function canUse(combat: CombatState, party: Character[], hero: Character, ab: Ability): boolean {
	if (cooldownLeft(combat, hero, ab)) return false;
	if (ab.target === 'party' || ab.target === 'none') return true;
	const t = targetsFor(combat, party, hero, ab);
	return ab.target === 'ally' ? t.allies.length > 0 : t.foes.length > 0;
}

/** Cases où le héros peut aller ce tour-ci. */
export function moveOptions(combat: CombatState, hero: Character): Hex[] {
	if (combat.phase !== 'hero' || combat.moved) return [];
	return reachable(combat.pos[hero.id], CLASSES[hero.classId].move, occupied(combat, hero.id));
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

function resolveAbility(work: Game, def: CombatDef, hero: Character, ab: Ability, action: Extract<CombatAction, { kind: 'ability' }>, events: GameEvent[]) {
	const combat = work.state.combat!;
	const inRange = targetsFor(combat, work.party, hero, ab);
	let foes: FoeState[] = [];
	if (ab.target === 'foe') {
		const f = inRange.foes.find((x) => x.id === action.targets?.[0]) ?? (inRange.foes.length === 1 ? inRange.foes[0] : undefined);
		if (!f) throw new Error('Cible hors de portée');
		foes = [f];
		if (ab.area) foes.push(...livingFoes(combat).filter((o) => o.id !== f.id && distance(combat.pos[o.id], combat.pos[f.id]) <= 1));
		const chain = ab.chain;
		if (chain) {
			// L'éclair rebondit chaque fois sur la créature la plus proche de la précédente (dans l'ordre : c'est celui de l'effet).
			for (let i = 0; i < chain.jumps; i += 1) {
				const last = foes[foes.length - 1];
				const next = livingFoes(combat)
					.filter((o) => !foes.includes(o) && distance(combat.pos[o.id], combat.pos[last.id]) <= chain.reach)
					.sort((a, b) => distance(combat.pos[a.id], combat.pos[last.id]) - distance(combat.pos[b.id], combat.pos[last.id]))[0];
				if (!next) break;
				foes.push(next);
			}
		}
	} else if (ab.target === 'foes') {
		const chosen = inRange.foes.filter((f) => action.targets?.includes(f.id));
		foes = (chosen.length ? chosen : inRange.foes).slice(0, ab.maxTargets ?? 3);
	} else if (ab.target === 'all') foes = inRange.foes;
	else if (ab.riposte) foes = livingFoes(combat).filter((f) => distance(combat.pos[hero.id], combat.pos[f.id]) <= ab.riposte!.provoke);
	if (['foe', 'foes', 'all'].includes(ab.target) && !foes.length) throw new Error('Personne à portée');
	const ally = ab.target === 'ally' ? inRange.allies.find((c) => c.id === action.targets?.[0]) : undefined;
	if (ab.target === 'ally' && !ally) throw new Error('Compagnon hors de portée');

	if (cooldownLeft(combat, hero, ab)) throw new Error('Compétence pas encore prête');
	if (ab.every) {
		combat.ready = { ...combat.ready, [hero.id]: { ...combat.ready?.[hero.id], [ab.id]: combat.round + ab.every } };
		events.push({ kind: 'sfx', id: 'sfx-pouvoir' });
	}
	if (ab.spell) events.push({ kind: 'sfx', id: 'sfx-sort' });
	if (ab.leap && foes[0]) {
		const from = combat.pos[hero.id];
		const to = landing(combat, hero, foes[0]);
		if (to && !sameHex(from, to)) {
			combat.pos[hero.id] = to;
			events.push({ kind: 'hero-move', heroId: hero.id, from, to });
		}
	}
	const success = !ab.stat || Boolean(action.roll?.success);
	events.push({ kind: 'ability', heroId: hero.id, ability: ab.id, foeIds: foes.map((f) => f.id), allyId: ally?.id, success, crit: success && Boolean(ab.damage) && (ab.crit || Boolean(heroState(combat, hero.id).fury)) });
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
			const crit = Boolean(ab.crit) || fury;
			// Critique : les deux haches font double dégâts.
			const amount = Math.min((main + (ab.offhand ?? 0)) * (crit ? 2 : 1), foe.hp);
			foe.hp -= amount;
			events.push({ kind: 'hit', heroId: hero.id, foeId: foe.id, amount, spell: ab.spell, crit, offhand: Boolean(ab.offhand) });
			hits.push(`${foe.name} −${amount} PV${foe.hp <= 0 ? ' (vaincue !)' : ''}`);
		}
		events.push({ kind: 'sfx', id: ab.spell ? 'sfx-coeur-brise' : 'sfx-coup' });
		log(work.state, 'combat', `${hero.name} (${how})${fury ? ', en pleine folie vengeresse,' : ''} touche : ${hits.join(' · ')}.`);
		if (ab.lifesteal) {
			const gain = Math.min(ab.lifesteal, hero.pvMax - hero.pv);
			hero.pv += gain;
			events.push({ kind: 'support', heroId: hero.id, what: 'heal', targetId: hero.id, amount: gain });
			if (gain) log(work.state, 'combat', `La fureur de l’ours requinque ${hero.name} : +${gain} PV.`);
		}
		if (ab.push) {
			const here = combat.pos[hero.id];
			for (const foe of foes.filter((f) => f.hp > 0)) {
				const to = pushAway(combat, here, foe);
				if (!to) continue;
				events.push({ kind: 'foe-move', foeId: foe.id, from: combat.pos[foe.id], to, pushed: true });
				combat.pos[foe.id] = to;
			}
		}
	}

	for (const foe of foes.filter((f) => f.hp > 0)) {
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
			events.push({ kind: 'foe-status', foeId: foe.id, heroId: hero.id, what: 'provoque' });
		}
	}
	if (!ab.damage && !ab.riposte && foes.length) {
		const what = ab.stun?.kind === 'filet' ? 'prend au filet' : ab.stun?.kind === 'sommeil' ? 'endort' : ab.blind ? 'aveugle' : ab.taunt ? 'nargue' : 'vise';
		log(work.state, 'combat', `${hero.name} (${how}) ${what} ${names(foes)} !`);
	}

	if (ab.riposte) {
		heroState(combat, hero.id).riposte = { damage: ab.riposte.damage, stunChance: ab.riposte.stunChance };
		for (const foe of foes) {
			foe.taunt = hero.id;
			events.push({ kind: 'foe-status', foeId: foe.id, heroId: hero.id, what: 'provoque' });
		}
		events.push({ kind: 'support', heroId: hero.id, what: 'riposte', targetId: hero.id });
		log(work.state, 'combat', `${hero.name} lève son bouclier : œil pour œil !${foes.length ? ` ${names(foes)} ne pensent plus qu’à ${hero.name}.` : ''}`);
	}
	if (ab.protect && ally) {
		heroState(combat, ally.id).protectedBy = hero.id;
		events.push({ kind: 'support', heroId: hero.id, what: 'protect', targetId: ally.id });
		log(work.state, 'combat', `${hero.name} se poste devant ${ally.name} pour le défendre.`);
	}
	if (ab.shield && ally) {
		const hs = heroState(combat, ally.id);
		hs.shield = (hs.shield ?? 0) + ab.shield;
		events.push({ kind: 'support', heroId: hero.id, what: 'shield', targetId: ally.id, amount: ab.shield });
		log(work.state, 'combat', `${hero.name} entoure ${ally.id === hero.id ? 'son propre corps' : ally.name} d’un bouclier de lune.`);
	}
	if (ab.heal && ally) {
		const amount = Math.min(ab.heal, ally.pvMax - ally.pv);
		ally.pv += amount;
		events.push({ kind: 'sfx', id: 'sfx-soin' });
		events.push({ kind: 'support', heroId: hero.id, what: 'heal', targetId: ally.id, amount });
		log(work.state, 'combat', `${hero.name} joue l’${ab.name} : ${ally.id === hero.id ? 'soi-même' : ally.name} +${amount} PV.`);
	} else if (ab.heal) {
		for (const c of work.party) c.pv = Math.min(c.pvMax, c.pv + ab.heal);
		events.push({ kind: 'sfx', id: 'sfx-soin' });
		events.push({ kind: 'support', heroId: hero.id, what: 'heal', amount: ab.heal });
		log(work.state, 'combat', `${hero.name} entonne le ${ab.name} : +${ab.heal} PV pour tout le groupe.`);
	}
	if (ab.cleanse) {
		const healed = work.party.filter((c) => combat.heroes[c.id]?.afflict);
		for (const c of healed) delete combat.heroes[c.id].afflict;
		events.push({ kind: 'sfx', id: 'sfx-soin' });
		events.push({ kind: 'support', heroId: hero.id, what: 'cleanse' });
		log(work.state, 'combat', healed.length ? `${hero.name} chante : ${healed.map((c) => c.name).join(', ')} ${healed.length > 1 ? 'sont délivrés' : 'est délivré·e'} de leurs maux.` : `${hero.name} chante une mélodie claire : personne ne souffre de rien.`);
	}
}

/** Une étape de combat : déplacement, action, reprise d'aggro… puis la suite de la file. */
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
	const ended = (result: 'victory' | 'defeat' | 'peace' | 'escape') =>
		events.push({ kind: 'combat-end', result, name: def.enemy.name, combat: clone(work.state.combat!) });
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

	/* ---- Tour des monstres : reprendre l'aggro, ou les laisser faire ---- */
	if (combat.phase === 'intent') {
		if (action.kind === 'reclaim') {
			const intent = combat.intents.find((i) => i.foeId === action.foeId);
			const who = work.party.find((c) => c.id === action.heroId);
			if (!intent || !who || !reclaimers(combat, work.party, intent).some((c) => c.id === who.id)) throw new Error('Impossible de reprendre l’aggro');
			intent.tried = true;
			combat.reclaimed.push(who.id);
			const foe = combat.foes.find((f) => f.id === intent.foeId)!;
			const ok = action.roll.success;
			if (ok) {
				intent.heroId = who.id;
				intent.why = 'reclaim';
			}
			events.push({ kind: 'sfx', id: ok ? 'sfx-succes' : 'sfx-echec' });
			events.push({ kind: 'reclaim', heroId: who.id, foeId: foe.id, success: ok });
			const cry = who.classId === 'danseur' ? 'nargue' : 'rugit vers';
			log(work.state, 'combat', `${who.name} ${cry} ${foe.name} (${rollText(action.roll)}) : ${ok ? 'elle change de cible !' : 'elle ne se laisse pas distraire.'}`);
			if (combat.intents.some((i) => reclaimers(combat, work.party, i).length)) return finish('intent');
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
		log(work.state, 'combat', `${hero.name} attend son heure.`);
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
		resolveAbility(work, def, hero, ab, action, events);
		return afterHero();
	}
	throw new Error('Action inconnue');
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function classPowerLabel(c: Character) {
	return CLASSES[c.classId].power.name;
}
