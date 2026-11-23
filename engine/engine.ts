import { ABILITIES, CLASSES, ENEMY_INITIATIVE, STAT_LABEL, computePvMax, evaluateRoll, levelFromXp, rollD6, type Ability, type AbilityId, type RollResult } from './rules';
import { voiceHash } from './voices';
import type {
	Campaign,
	Character,
	CheckDef,
	Choice,
	CombatDef,
	CombatState,
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

/**
 * Début du combat : chacun lance l'initiative (dé + Agilité ; le monstre : dé + bonus de difficulté).
 * On joue ensuite dans cet ordre, le monstre à sa place dans la file.
 */
function startCombat(game: Game, def: CombatDef, events: GameEvent[]) {
	const rolls = [
		...game.party.map((c) => ({ id: c.id, name: c.name, bonus: c.stats.agilite })),
		{ id: 'enemy', name: def.enemy.name, bonus: ENEMY_INITIATIVE[def.enemy.difficulty] },
	].map((r) => {
		const die = rollD6();
		return { ...r, die, total: die + r.bonus };
	});
	// À égalité, les héros passent avant le monstre.
	rolls.sort((a, b) => b.total - a.total || (a.id === 'enemy' ? 1 : b.id === 'enemy' ? -1 : 0));
	game.state.combat = {
		hearts: def.enemy.hearts,
		maxHearts: def.enemy.hearts,
		actor: firstActor(game.party, 0),
		round: 1,
		order: rolls.map((r) => r.id),
		turn: -1,
		initiative: Object.fromEntries(rolls.map((r) => [r.id, { die: r.die, bonus: r.bonus, total: r.total }])),
		used: {},
		guard: null,
		asleep: false,
		armor: Object.fromEntries(game.party.map((c) => [c.id, CLASSES[c.classId].armor])),
	};
	events.push({ kind: 'initiative', order: rolls });
	log(game.state, 'combat', `Initiative : ${rolls.map((r) => `${r.name} ${r.total}`).join(', ')}.`);
}

/** Le monstre agit : il attaque un héros (celui qui s'est interposé s'il y en a un), sauf s'il dort. */
function enemyAct(game: Game, def: CombatDef, events: GameEvent[]) {
	const combat = game.state.combat!;
	const name = def.enemy.name;
	if (combat.asleep) {
		combat.asleep = false;
		events.push({ kind: 'enemy-turn', name, attack: `${capitalize(name)} dort à poings fermés et passe son tour !`, heroId: '', amount: 0, asleep: true });
		log(game.state, 'combat', `${capitalize(name)} dort et passe son tour.`);
		return;
	}
	const active = activeHeroes(game.party);
	const guard = combat.guard ? active.find((c) => c.id === combat.guard) : undefined;
	const victim = guard ?? active[Math.floor(Math.random() * active.length)];
	combat.guard = null;
	if (!victim) return;
	const blow = Math.max(0, def.enemy.damage - (guard ? 1 : 0));
	// L'armure prend les coups avant les PV.
	const armor = combat.armor?.[victim.id] ?? 0;
	const absorbed = Math.min(armor, blow);
	if (absorbed) combat.armor = { ...combat.armor, [victim.id]: armor - absorbed };
	const amount = blow - absorbed;
	const attack = def.enemy.attack ?? `${capitalize(name)} attaque !`;
	events.push({ kind: 'enemy-turn', name, attack, heroId: victim.id, amount, guarded: Boolean(guard), absorbed });
	const armorText = absorbed ? ` L’armure de ${victim.name} encaisse ${absorbed === 1 ? 'le coup' : `${absorbed} coups`}.` : '';
	const lost = amount ? ` ${victim.name} perd ${amount} PV.` : '';
	log(game.state, 'combat', guard ? `${attack} ${victim.name} s’est interposé·e.${armorText}${lost}` : `${attack}${armorText}${lost}`);
	if (amount > 0) hurt(game, victim, amount, events, false);
}

/** Passe au suivant dans l'ordre de jeu ; le monstre agit quand vient sa place. Renvoie 'defeat' si le groupe tombe. */
function advanceCombat(game: Game, def: CombatDef, events: GameEvent[]): 'hero' | 'defeat' {
	const combat = game.state.combat!;
	const order = combat.order ?? [...game.party.map((c) => c.id), 'enemy'];
	combat.order = order;
	for (let step = 0; step < order.length * 2; step += 1) {
		const turn = ((combat.turn ?? -1) + 1) % order.length;
		if (turn === 0 && (combat.turn ?? -1) >= 0) combat.round += 1;
		combat.turn = turn;
		const id = order[turn];
		if (id === 'enemy') {
			enemyAct(game, def, events);
			if (activeHeroes(game.party).length === 0) return 'defeat';
			continue;
		}
		const idx = game.party.findIndex((c) => c.id === id);
		if (idx >= 0 && game.party[idx].pv > 0) {
			combat.actor = idx;
			events.push({ kind: 'turn', heroId: id });
			return 'hero';
		}
	}
	return activeHeroes(game.party).length ? 'hero' : 'defeat';
}

export type CombatAction =
	| { kind: 'ability'; ability: AbilityId; roll: RollResult | null; rerollBy?: string }
	| { kind: 'talk'; roll: RollResult; rerollBy?: string }
	| { kind: 'flee'; roll: RollResult; rerollBy?: string };

/** Actions possibles pour un héros en combat (celles « une fois par combat » disparaissent une fois utilisées). */
export function availableAbilities(state: CombatState, hero: Character): Ability[] {
	const used = state.used?.[hero.id] ?? [];
	return CLASSES[hero.classId].abilities.map((id) => ABILITIES[id]).filter((a) => !(a.perCombat && used.includes(a.id)));
}

/** Le tour d'un héros, puis la suite de la file (le monstre peut agir avant le héros suivant). */
export function combatTurn(campaign: Campaign, game: Game, action: CombatAction): StepResult {
	const scene = getScene(campaign, game.state.sceneId);
	const def = scene.combat;
	if (!def || !game.state.combat) throw new Error('Pas de combat en cours');

	const events: GameEvent[] = [];
	const work: Game = { state: clone(game.state), party: clone(game.party) };
	const combat = work.state.combat!;
	const hero = work.party[combat.actor];
	if (action.rerollBy) spendPower(work, action.rerollBy);
	const rollText = (r: RollResult) => `${r.die} + ${r.stat} = ${r.total}`;

	if (action.kind === 'talk' && def.talk) {
		log(work.state, 'combat', `${hero.name} tente de parlementer (${rollText(action.roll)}) : ${action.roll.success ? 'ça marche !' : 'raté…'}`);
		if (action.roll.success) {
			events.push({ kind: 'sfx', id: 'sfx-succes' });
			if (def.talk.outcome.text) events.push({ kind: 'narration', text: def.talk.outcome.text });
			applyEffects(campaign, work, def.talk.outcome.effects, events);
			nextSpokes(work);
			return enterScene(campaign, work, def.talk.outcome.to, events);
		}
		events.push({ kind: 'sfx', id: 'sfx-echec' });
		events.push({ kind: 'miss', heroId: hero.id });
	} else if (action.kind === 'flee' && def.flee) {
		log(work.state, 'combat', `${hero.name} tente de fuir (${rollText(action.roll)}) : ${action.roll.success ? 'ça marche !' : 'raté…'}`);
		if (action.roll.success) {
			if (def.flee.outcome.text) events.push({ kind: 'narration', text: def.flee.outcome.text });
			applyEffects(campaign, work, def.flee.outcome.effects, events);
			nextSpokes(work);
			return enterScene(campaign, work, def.flee.outcome.to, events);
		}
		events.push({ kind: 'sfx', id: 'sfx-echec' });
		events.push({ kind: 'miss', heroId: hero.id });
	} else if (action.kind === 'ability') {
		const ab = ABILITIES[action.ability];
		if (!ab || !availableAbilities(combat, hero).some((a) => a.id === ab.id)) throw new Error('Action impossible');
		if (ab.perCombat) {
			combat.used = { ...(combat.used ?? {}), [hero.id]: [...(combat.used?.[hero.id] ?? []), ab.id] };
			events.push({ kind: 'sfx', id: 'sfx-pouvoir' });
		}
		if (ab.spell) events.push({ kind: 'sfx', id: 'sfx-sort' });
		const how = action.roll ? `${ab.name} : ${rollText(action.roll)}` : ab.name;

		if (ab.effect === 'hit' || ab.effect === 'hit2' || ab.effect === 'hit3' || ab.effect === 'double' || ab.effect === 'sure') {
			const success = ab.effect === 'sure' || Boolean(action.roll?.success);
			if (success) {
				const base =
					ab.effect === 'hit3' ? 3
					: ab.effect === 'hit2' ? 2
					: ab.effect === 'double' ? ((action.roll?.die ?? 0) >= 4 ? 2 : 1)
					: ab.effect === 'sure' && def.enemy.brume ? 2
					: 1;
				const dmg = Math.min(base, combat.hearts);
				combat.hearts -= dmg;
				events.push({ kind: 'sfx', id: ab.spell ? 'sfx-coeur-brise' : 'sfx-coup' });
				events.push({ kind: 'hit', target: 'enemy', heroId: hero.id, amount: dmg, spell: ab.spell });
				log(work.state, 'combat', `${hero.name} (${how}) touche ${def.enemy.name} !${ab.effect === 'double' && base === 2 ? ' Les deux lames font mouche !' : ''} −${dmg} ♥`);
			} else {
				events.push({ kind: 'sfx', id: 'sfx-rate' });
				events.push({ kind: 'miss', heroId: hero.id });
				log(work.state, 'combat', `${hero.name} (${how}) rate son coup.`);
			}
		} else if (ab.effect === 'guard') {
			combat.guard = hero.id;
			events.push({ kind: 'support', heroId: hero.id, what: 'guard' });
			log(work.state, 'combat', `${hero.name} se rue devant ses amis et provoque ${def.enemy.name} !`);
		} else if (ab.effect === 'sleep') {
			const ok = Boolean(action.roll?.success);
			if (ok) combat.asleep = true;
			events.push({ kind: 'support', heroId: hero.id, what: ok ? 'sleep' : 'sleep-fail' });
			log(work.state, 'combat', ok ? `${hero.name} (${how}) endort ${def.enemy.name} !` : `${hero.name} (${how}) chante, mais ${def.enemy.name} reste bien éveillé.`);
		} else if (ab.effect === 'heal') {
			for (const c of work.party) c.pv = Math.min(c.pvMax, c.pv + 2);
			events.push({ kind: 'sfx', id: 'sfx-soin' });
			events.push({ kind: 'support', heroId: hero.id, what: 'heal', amount: 2 });
			log(work.state, 'combat', `${hero.name} entonne le ${ab.name} : +2 PV pour tout le groupe.`);
		}
	}

	if (combat.hearts <= 0) {
		log(work.state, 'combat', `Victoire contre ${def.enemy.name}`);
		if (def.victory.text) events.push({ kind: 'narration', text: def.victory.text });
		applyEffects(campaign, work, def.victory.effects, events);
		nextSpokes(work);
		return enterScene(campaign, work, def.victory.to, events);
	}

	if (advanceCombat(work, def, events) === 'defeat') {
		log(work.state, 'combat', `Le groupe est épuisé…`);
		if (def.defeat.text) events.push({ kind: 'narration', text: def.defeat.text });
		applyEffects(campaign, work, def.defeat.effects, events);
		return enterScene(campaign, work, def.defeat.to, events);
	}
	return { ...work, events };
}

function hurt(game: Game, hero: Character, amount: number, events: GameEvent[], withLog = true) {
	hero.pv = Math.max(0, hero.pv - amount);
	events.push({ kind: 'hit', target: 'hero', heroId: hero.id, amount });
	if (hero.pv === 0) log(game.state, 'combat', `${hero.name} tombe, ${hero.gender === 'm' ? 'épuisé' : hero.gender === 'f' ? 'épuisée' : 'épuisé·e'} !`);
	else if (withLog) log(game.state, 'combat', `${hero.name} perd ${amount} PV.`);
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function classPowerLabel(c: Character) {
	return CLASSES[c.classId].power.name;
}
