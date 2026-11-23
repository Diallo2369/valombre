'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BOARD, BOARD_H, BOARD_W, HEX_W, center, distance, hexKey, hexPoints, type Hex } from '@/engine/board';
import { availableAbilities, canUse, moveOptions, passiveAbilities, reclaimers, targetsFor } from '@/engine/engine';
import { CLASSES, DIFFICULTY, STATS, STAT_LABEL, className, classWithArticle, heartsText, type Ability, type AbilityId } from '@/engine/rules';
import type { Character, CombatDef, CombatState, FoeState, GameEvent, Intent } from '@/engine/types';
import type { MediaMap } from '@/lib/media-types';
import { CombatIntro } from './fx/CombatIntro';
import { FxEngine } from './fx/fx-engine';
import { BIG_FX, celebrate, playAbility, playFoeAttack, playPoison } from './fx/fx-library';
import { HeroPortrait } from './HeroPortrait';
import { MediaView } from './MediaView';

type Ev<K extends GameEvent['kind']> = Extract<GameEvent, { kind: K }>;

interface Props {
	def: CombatDef;
	combat: CombatState;
	party: Character[];
	actor: Character;
	media: MediaMap;
	/** Événements de la dernière étape, et un compteur qui change à chaque étape. */
	events: GameEvent[];
	seq: number;
	/** Récit des derniers coups. */
	log: string[];
	onSfx: (id: string) => void;
	/** URL de l'enregistrement d'une phrase du conteur (l'attaque des monstres), s'il existe. */
	voiceFor: (text: string) => string | undefined;
	voiceVolume: number;
	onAbility: (id: AbilityId, targets?: string[]) => void;
	onMove: (to: Hex) => void;
	onWait: () => void;
	onReclaim: (foeId: string, heroId: string) => void;
	onResolve: () => void;
	onTalk: () => void;
	onFlee: () => void;
	/** Colonne où poser la carte des compétences (à la place du groupe) ; sinon, sous le plateau. */
	sideEl?: HTMLElement | null;
	/** Héros dont on regarde les compétences (clic sur son jeton ou dans le groupe) ; par défaut, celui qui joue. */
	viewId?: string | null;
	onView: (id: string | null) => void;
	onSheet: (id: string) => void;
	/** Effets de combat : complets (fondu, effets animés) ou simples (seulement les jetons qui réagissent). */
	fx: 'full' | 'simple';
	/** Images du fondu d'entrée en combat : la scène, puis le combat (URL). */
	introFrom?: string;
	introTo?: string;
	/** Appelé quand la mise en scène de l'étape est finie (fin de combat : on passe alors à la suite). */
	onSequenceEnd?: () => void;
}

/** Une étape de la mise en scène : bandeau plein écran, ou phrase d'action sur le plateau. */
type Beat =
	| { kind: 'wait'; ms: number }
	/** Le fondu d'entrée en combat. */
	| { kind: 'intro'; ms: number }
	/** Une compétence part : effet animé, puis impact. */
	| { kind: 'act'; ms: number; ev: Ev<'ability'> }
	| { kind: 'banner'; title: string; subtitle?: string; lines?: string[]; tone: 'start' | 'hero' | 'foe' | 'win'; ms: number }
	| {
			kind: 'say';
			text: string;
			tone: 'foe' | 'hero';
			ms: number;
			/** Créature qui agit (mise en avant), et qui se déplace à ce moment-là. */
			foeId?: string;
			move?: boolean;
			/** Héros touché : ses PV baissent à ce moment-là. */
			heroId?: string;
			/** Le poison ronge la créature : ses cœurs baissent à ce moment-là. */
			poison?: boolean;
			amount?: number;
			voice?: string;
	  };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** « Au tour de la boule de brume », « des brumelins », « du Loup de Cendre ». */
function turnOf(name: string) {
	if (/^les\s/i.test(name)) return `Au tour des ${name.slice(4)} !`;
	if (/^le\s/i.test(name)) return `Au tour du ${name.slice(3)} !`;
	return `Au tour de ${name} !`;
}

/** Ce que le héros doit faire au dé (un 6 réussit toujours). */
function need(stat: number, target: number) {
	const min = target - stat;
	if (min <= 1) return 'réussite assurée';
	if (min >= 6) return 'il faut un 6';
	return `il faut ${min} ou plus`;
}

const STUN_ICON = { assomme: '💫', filet: '🕸️', sommeil: '😴' } as const;
const STUN_TEXT = { assomme: 'est encore sonnée', filet: 'se débat dans le filet', sommeil: 'dort à poings fermés' } as const;

/** Les cœurs d'une créature, avec les demi-cœurs. */
function Hearts({ foe, hp = foe.hp, small = false }: { foe: FoeState; hp?: number; small?: boolean }) {
	const count = Math.ceil(foe.maxHp / 2);
	// Les cœurs qui viennent de tomber sautent et s'éteignent (on garde l'ancien total jusqu'au prochain coup).
	const track = useRef({ hp, from: hp });
	if (track.current.hp !== hp) track.current = { hp, from: track.current.hp };
	const from = track.current.from;
	return (
		<span className={`hearts${small ? ' hearts--small' : ''}`} aria-label={`${heartsText(Math.max(0, hp))} sur ${heartsText(foe.maxHp)}`}>
			{Array.from({ length: count }, (_, i) => {
				const left = hp - i * 2;
				const before = from - i * 2;
				const cls = left >= 2 ? '' : left === 1 ? ' is-half' : ' is-lost';
				const drop = before > left && before > 0 && left < 2 ? ' is-dropping' : '';
				return (
					<span key={i} className={`heart${cls}${drop}`} aria-hidden="true">
						♥
					</span>
				);
			})}
		</span>
	);
}

/** Des petits cœurs qui s'envolent du jeton touché. */
function HeartPop({ count }: { count: number }) {
	return (
		<span className="token__pop" aria-hidden="true">
			{Array.from({ length: Math.max(1, Math.min(4, count)) }, (_, i) => (
				<span key={i} style={{ '--i': i, '--n': Math.max(1, Math.min(4, count)) } as React.CSSProperties}>
					♥
				</span>
			))}
		</span>
	);
}

/** Pourcentages pour poser un jeton au centre d'une case. */
function place(h: Hex) {
	const { x, y } = center(h);
	return { left: `${(x / BOARD_W) * 100}%`, top: `${(y / BOARD_H) * 100}%`, width: `${((HEX_W * 0.86) / BOARD_W) * 100}%` };
}

/**
 * L'écran de combat, façon plateau : les créatures en haut, les aventuriers en bas, sur des hexagones.
 * Le héros dont c'est le tour voit sa carte (dans la colonne du groupe, ou sous le plateau) : il se déplace (cases lumineuses), puis choisit une action
 * et touche sa cible sur le plateau. Au tour des monstres, chacun annonce sa cible (flèche) : le guerrier ou
 * le danseur de guerre peuvent tenter de reprendre l'aggro avant qu'ils frappent.
 */
/** Durée de lecture confortable d'un texte (lecture à voix haute en famille). */
const readMs = (text: string) => 1500 + text.length * 60;

export function CombatPanel(props: Props) {
	const { def, combat, party, actor, media, events, seq, log, onSfx, voiceFor, voiceVolume } = props;
	const difficulty = DIFFICULTY[def.enemy.difficulty].target;
	const [beat, setBeat] = useState<Beat | null>(null);
	const [selected, setSelected] = useState<AbilityId | null>(null);
	/** Compétence passive dont on lit l'explication (clic sur son badge). */
	const [passiveId, setPassiveId] = useState<AbilityId | null>(null);
	/** Pendant la mise en scène : PV pas encore perdus, et cases d'où partent les créatures. */
	const [dmgLeft, setDmgLeft] = useState<Record<string, number>>({});
	const [posFrom, setPosFrom] = useState<Record<string, Hex>>({});
	const [hurtId, setHurtId] = useState<string | null>(null);
	/** L'action du héros a touché (les bulles de dégâts et les cœurs qui tombent n'apparaissent qu'à l'impact). */
	const [landed, setLanded] = useState(false);
	const [shake, setShake] = useState(false);
	/** Le jet automatique, affiché au-dessus du héros qui agit. */
	const timers = useRef<number[]>([]);
	const fxCanvas = useRef<HTMLCanvasElement>(null);
	const fxEngine = useRef<FxEngine | null>(null);

	// La couche d'effets, seulement en effets complets ; elle suit la taille du plateau.
	useEffect(() => {
		const canvas = fxCanvas.current;
		if (props.fx !== 'full' || !canvas) return;
		let eng: FxEngine;
		try {
			eng = new FxEngine(canvas, BOARD_W, BOARD_H);
		} catch {
			return;
		}
		fxEngine.current = eng;
		const ro = new ResizeObserver(() => eng.resize());
		ro.observe(canvas);
		return () => {
			ro.disconnect();
			eng.clear();
			fxEngine.current = null;
		};
	}, [props.fx]);

	const foeById = (id: string) => combat.foes.find((f) => f.id === id);
	const heroById = (id: string) => party.find((c) => c.id === id);
	const nameOf = (id: string) => (id === 'enemy' ? def.enemy.name : heroById(id)?.name ?? foeById(id)?.name ?? '');
	const hits = new Map(events.filter((e): e is Ev<'hit'> => e.kind === 'hit').map((e) => [e.foeId, e]));
	const missedBy = events.find((e): e is Ev<'miss'> => e.kind === 'miss')?.heroId;
	const statuses = events.filter((e): e is Ev<'foe-status'> => e.kind === 'foe-status');
	const support = events.find((e): e is Ev<'support'> => e.kind === 'support');

	// À chaque étape : on compose la séquence (ouverture, action du héros, tour des monstres, tour suivant) et on la joue.
	useEffect(() => {
		timers.current.forEach(clearTimeout);
		timers.current = [];
		setSelected(null);
		setLanded(false);
		setShake(false);
		const beats: Beat[] = [];
		const pending: Record<string, number> = {};
		const from: Record<string, Hex> = {};
		let acted = false;
		for (const e of events) {
			if (e.kind === 'initiative') {
				if (props.fx === 'full') beats.push({ kind: 'intro', ms: 1700 });
				beats.push({ kind: 'banner', title: 'Combat !', subtitle: def.enemy.name, tone: 'start', ms: 2400 });
				beats.push({
					kind: 'banner',
					title: 'Initiative',
					subtitle: 'Chacun lance un dé et ajoute son initiative : le plus rapide commence.',
					lines: e.order.map((o, i) => `${i + 1}. ${o.name} : ${o.die} + ${o.bonus} = ${o.total}`),
					tone: 'start',
					ms: 4200,
				});
			} else if (e.kind === 'ability') {
				beats.push({ kind: 'act', ev: e, ms: 1900 });
				acted = true;
			} else if (e.kind === 'hit' || e.kind === 'miss' || e.kind === 'support' || e.kind === 'foe-status') {
				if (e.kind === 'hit') pending[e.foeId] = (pending[e.foeId] ?? 0) + e.amount;
				if (!acted) beats.push({ kind: 'wait', ms: 1800 });
				acted = true;
			} else if (e.kind === 'reclaim') {
				const hero = nameOf(e.heroId);
				const foe = nameOf(e.foeId);
				beats.push({
					kind: 'say',
					tone: 'hero',
					ms: 2400,
					text: e.success ? `${hero} attire ${foe} : elle change de cible !` : `${hero} tente d’attirer ${foe}… elle ne se laisse pas distraire.`,
				});
			} else if (e.kind === 'enemy-turn') {
				beats.push({ kind: 'banner', title: turnOf(e.name), subtitle: 'Attention…', tone: 'foe', ms: 2200 });
				if (e.attack) beats.push({ kind: 'say', tone: 'foe', text: e.attack, voice: e.attack, ms: 3400 });
			} else if (e.kind === 'foe-poison') {
				pending[e.foeId] = (pending[e.foeId] ?? 0) + 1;
				beats.push({ kind: 'say', tone: 'hero', foeId: e.foeId, poison: true, ms: 1900, text: `🧪 Le poison ronge ${e.name} : −½ ♥${e.dead ? ', elle s’effondre !' : '.'}` });
			} else if (e.kind === 'foe-skip') {
				beats.push({ kind: 'say', tone: 'hero', foeId: e.foeId, ms: 1900, text: `${STUN_ICON[e.reason]} ${cap(e.name)} ${STUN_TEXT[e.reason]} et passe son tour.` });
			} else if (e.kind === 'foe-move') {
				from[e.foeId] ??= e.from;
				beats.push({ kind: 'say', tone: 'foe', foeId: e.foeId, move: true, ms: 1100, text: `${cap(nameOf(e.foeId))} s’avance…` });
			} else if (e.kind === 'foe-attack') {
				pending[e.heroId] = (pending[e.heroId] ?? 0) + e.amount;
				const victim = nameOf(e.heroId);
				const why = e.taunted ? `, folle de rage contre ${victim},` : e.aura ? `, attirée par l’aura de ${victim},` : '';
				const parts = [
					e.guarded ? `${victim} s’interpose !` : '',
					e.shielded ? `Le bouclier de lune encaisse ${e.shielded}.` : '',
					e.absorbed ? `L’armure encaisse ${e.absorbed === 1 ? 'le coup' : `${e.absorbed} coups`}.` : '',
					e.amount ? `${victim} perd ${e.amount} PV !` : !e.shielded && !e.absorbed ? `${victim} ne perd rien !` : '',
					e.afflict ? `Et ${e.afflict} commence à le ronger…` : '',
				].filter(Boolean);
				beats.push({ kind: 'say', tone: 'foe', foeId: e.foeId, heroId: e.heroId, amount: e.amount, ms: 2800, text: `${cap(e.name)}${why} frappe ${victim}. ${parts.join(' ')}` });
			} else if (e.kind === 'affliction') {
				pending[e.heroId] = (pending[e.heroId] ?? 0) + e.amount;
				beats.push({ kind: 'say', tone: 'foe', heroId: e.heroId, amount: e.amount, ms: 2000, text: `🔥 ${cap(e.name)} : ${nameOf(e.heroId)} perd ${e.amount} PV.` });
			} else if (e.kind === 'combat-end') {
				const end = {
					victory: { title: 'Victoire !', subtitle: `${cap(e.name)} ${/^les\s/i.test(e.name) ? 'sont vaincus' : 'est vaincu'} !`, tone: 'win' as const },
					defeat: { title: 'Le groupe est épuisé…', subtitle: 'Mais l’aventure n’est pas finie.', tone: 'foe' as const },
					peace: { title: 'La paix est faite', subtitle: 'Le combat s’arrête là.', tone: 'win' as const },
					escape: { title: 'Fuite réussie !', subtitle: 'Le groupe s’échappe.', tone: 'hero' as const },
				}[e.result];
				beats.push({ kind: 'banner', ...end, ms: 3000 });
			} else if (e.kind === 'turn') {
				const hero = heroById(e.heroId);
				if (hero)
					beats.push({
						kind: 'banner',
						title: `Au tour de ${hero.name} !`,
						subtitle: `${hero.player ? `${hero.player} joue · ` : ''}${className(hero)}`,
						tone: 'hero',
						ms: 2200,
					});
			}
		}
		// Le temps de lire : chaque texte reste affiché selon sa longueur (jamais moins que prévu).
		for (const b of beats) {
			const text = b.kind === 'say' ? b.text : b.kind === 'banner' ? [b.title, b.subtitle, ...(b.lines ?? [])].join(' ') : '';
			if (text && !(b.kind === 'say' && b.move)) b.ms = Math.max(b.ms, readMs(text));
		}
		setDmgLeft(pending);
		setPosFrom(from);

		let t = 0;
		for (const b of beats) {
			timers.current.push(
				window.setTimeout(() => {
					setBeat(b.kind === 'wait' ? null : b);
					if (b.kind === 'banner' && b.tone === 'win' && fxEngine.current) {
						const eng = fxEngine.current;
						for (const c of party) if (c.pv > 0) celebrate(eng, center(combat.pos[c.id]));
					}
					if (b.kind === 'act') {
						const ev = b.ev;
						const at = (id: string) => center(combat.pos[id]);
						const allies = ev.allyId ? [at(ev.allyId)] : ev.foeIds.length ? [] : party.filter((c) => c.pv > 0).map((c) => at(c.id));
						const land = () => {
							setLanded(true);
							if (ev.crit || (ev.success && BIG_FX.has(ev.ability))) setShake(true);
							setDmgLeft((d) => {
								const next = { ...d };
								for (const id of ev.foeIds) delete next[id];
								return next;
							});
						};
						const eng = fxEngine.current;
						const hitAt = eng ? playAbility(eng, ev.ability, { from: at(ev.heroId), foes: ev.foeIds.map(at), allies, success: ev.success, crit: Boolean(ev.crit) }) : 350;
						timers.current.push(window.setTimeout(land, hitAt));
						return;
					}
					if (b.kind !== 'say') return;
					if (b.poison && b.foeId) {
						const id = b.foeId;
						if (fxEngine.current) playPoison(fxEngine.current, center(combat.pos[id]));
						timers.current.push(window.setTimeout(() => setDmgLeft((d) => ({ ...d, [id]: Math.max(0, (d[id] ?? 0) - 1) })), 300));
					}
					if (b.move && b.foeId) {
						const id = b.foeId;
						setPosFrom((p) => {
							const next = { ...p };
							delete next[id];
							return next;
						});
					}
					if (b.voice) {
						const url = voiceFor(b.voice);
						if (url) {
							const a = new Audio(url);
							a.volume = voiceVolume;
							void a.play().catch(() => {});
						}
					}
					if (b.heroId) {
						const id = b.heroId;
						const amount = b.amount ?? 0;
						if (b.foeId) onSfx('sfx-griffe');
						const foe = b.foeId ? foeById(b.foeId) : undefined;
						if (foe && fxEngine.current) {
							const eng = fxEngine.current;
							const from = center(combat.pos[foe.id]);
							const to = center(combat.pos[id]);
							timers.current.push(window.setTimeout(() => playFoeAttack(eng, foe.name, from, to, amount > 0), 520));
						}
						// Les PV baissent au moment où le coup tombe.
						timers.current.push(
							window.setTimeout(() => {
								setDmgLeft((d) => ({ ...d, [id]: Math.max(0, (d[id] ?? 0) - amount) }));
								setHurtId(id);
								if (amount > 0) onSfx('sfx-blessure');
							}, 700),
						);
					}
				}, t),
			);
			t += b.ms;
		}
		timers.current.push(
			window.setTimeout(() => {
				setBeat(null);
				setHurtId(null);
				setDmgLeft({});
				setPosFrom({});
				props.onSequenceEnd?.();
			}, t),
		);
		return () => timers.current.forEach(clearTimeout);
		// On rejoue la séquence à chaque nouvelle étape seulement.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [seq]);

	const busy = beat !== null;
	const phase = combat.phase;
	const say = beat?.kind === 'say' ? beat : null;
	const ability = selected ? availableAbilities(combat, actor).find((a) => a.id === selected) : undefined;
	const targets = ability ? targetsFor(combat, party, actor, ability) : { foes: [], allies: [] };
	const moves = useMemo(() => (busy || selected || phase !== 'hero' ? [] : moveOptions(combat, actor)), [busy, selected, phase, combat, actor]);
	const moveSet = new Set(moves.map(hexKey));
	const rangeSet = useMemo(() => {
		const set = new Set<string>();
		if (!ability?.range) return set;
		const here = combat.pos[actor.id];
		for (let r = 0; r < BOARD.rows; r += 1) for (let c = 0; c < BOARD.cols; c += 1) if (distance(here, { c, r }) <= ability.range) set.add(hexKey({ c, r }));
		return set;
	}, [ability, combat.pos, actor.id]);
	const intents = phase === 'intent' && !busy ? combat.intents : [];
	const aggroHeroes = new Set(intents.flatMap((i) => reclaimers(combat, party, i).map((c) => c.id)));
	const posOf = (id: string) => posFrom[id] ?? combat.pos[id];

	const fire = (ab: Ability, ids?: string[]) => {
		setSelected(null);
		props.onAbility(ab.id, ids);
	};
	const pickAbility = (ab: Ability) => {
		const t = targetsFor(combat, party, actor, ab);
		if (ab.target === 'foe') {
			if (t.foes.length === 1) fire(ab, [t.foes[0].id]);
			else setSelected(ab.id);
		} else if (ab.target === 'ally') {
			if (t.allies.length === 1) fire(ab, [t.allies[0].id]);
			else setSelected(ab.id);
		} else fire(ab);
	};

	const order = combat.order;
	/** Héros affiché sur la carte : celui qu'on regarde, sinon celui qui joue. */
	const shown = (props.viewId && heroById(props.viewId)) || actor;
	/** La carte est jouable seulement pour le héros dont c'est le tour. */
	const mine = shown.id === actor.id && phase === 'hero';
	const abilities = availableAbilities(combat, shown);
	const passives = passiveAbilities(shown);
	const passive = passives.find((a) => a.id === passiveId);
	const hs = combat.heroes[shown.id];
	const cls = CLASSES[shown.classId];

	const intentLine = (i: Intent) => {
		const foe = foeById(i.foeId);
		const hero = heroById(i.heroId);
		if (!foe || !hero) return '';
		const why =
			i.why === 'aura' ? ` (attirée par l’aura de ${hero.name})` : i.why === 'taunt' ? ` (folle de rage : ${hero.name} l’a provoquée)` : i.why === 'reclaim' ? ` (détournée par ${hero.name})` : '';
		return `${cap(foe.name)} semble se diriger vers ${hero.name}${why}.`;
	};

	const side = (
		<>
			{/* ---------- Tour des monstres : on peut tenter de reprendre l'aggro ---------- */}
			{phase === 'intent' && !busy ? (
				<section className="intent-panel card" aria-labelledby="intent-title">
					<h3 id="intent-title">Les monstres préparent leur coup…</h3>
					<ul className="intent-panel__list">
						{combat.intents.map((i) => {
							const who = reclaimers(combat, party, i);
							return (
								<li key={i.foeId}>
									<p>{intentLine(i)}</p>
									{who.length ? (
										<div className="intent-panel__actions">
											{who.map((c) => {
												const stat = CLASSES[c.classId].aggro!;
												return (
													<button key={c.id} type="button" className="btn btn--small" onClick={() => props.onReclaim(i.foeId, c.id)}>
														{c.classId === 'danseur' ? '😜' : '🔱'} {c.name} tente de l’attirer · {STAT_LABEL[stat]} {c.stats[stat]} : {need(c.stats[stat], difficulty)}
													</button>
												);
											})}
										</div>
									) : null}
								</li>
							);
						})}
					</ul>
					<button type="button" className="btn btn--ghost" onClick={props.onResolve}>
						⚔️ Laisser les monstres attaquer
					</button>
				</section>
			) : null}

			{/* ---------- La carte du héros : celui dont c'est le tour, ou celui qu'on regarde ---------- */}
			{phase === 'hero' || shown.id !== actor.id ? (
				<section className={`hero-card card${busy && mine ? ' is-waiting' : ''}${mine ? '' : ' is-preview'}`} aria-labelledby="hero-card-title">
					<HeroPortrait className="hero-card__portrait" character={shown} media={media} />
					<div className="hero-card__head">
						<h3 id="hero-card-title">
							{!mine ? (
								<>
									Compétences de <strong>{shown.name}</strong>, {classWithArticle(shown)}
								</>
							) : busy ? (
								'…'
							) : (
								<>
									À <strong>{actor.name}</strong>
									{actor.player ? ` (${actor.player})` : ''}, {classWithArticle(actor)}, de jouer !
								</>
							)}
						</h3>
						<p className="hero-card__stats">
							<span>
								♥ {shown.pv}/{shown.pvMax} PV
							</span>
							{cls.armor ? (
								<span>
									🛡️ armure {hs?.armor ?? cls.armor}/{cls.armor}
								</span>
							) : null}
							<span>👣 {mine && combat.moved ? 'déjà déplacé' : `${cls.move} cases`}</span>
							{hs?.shield ? <span>🌕 bouclier {hs.shield}</span> : null}
							{hs?.fury ? <span className="is-hot">🔥 folie vengeresse : prochaine attaque critique !</span> : null}
							{hs?.afflict ? <span className="is-bad">🤒 {hs.afflict.name}</span> : null}
							{hs?.protectedBy ? <span>🛡️ défendu par {heroById(hs.protectedBy)?.name}</span> : null}
						</p>
						<dl className="hero-card__attrs" aria-label={`Caractéristiques de ${shown.name}`}>
							{STATS.map((st) => (
								<div key={st.key} className="hero-card__attr" title={st.hint}>
									<dt>{st.label}</dt>
									<dd>{shown.stats[st.key] ?? '–'}</dd>
								</div>
							))}
						</dl>
						{passives.length ? (
							<div className="hero-card__passives">
								{passives.map((a) => (
									<button
										key={a.id}
										type="button"
										className={`badge hero-card__passive${passive?.id === a.id ? ' is-open' : ''}`}
										aria-expanded={passive?.id === a.id}
										aria-controls="hero-card-passive"
										onClick={() => setPassiveId(passive?.id === a.id ? null : a.id)}
									>
										{a.icon} {a.name} <span aria-hidden="true">{passive?.id === a.id ? '▴' : 'ⓘ'}</span>
									</button>
								))}
							</div>
						) : null}
						{passive ? (
							<p id="hero-card-passive" className="hero-card__passive-text">
								<strong>
									{passive.icon} {passive.name}
								</strong>{' '}
								(passif, toujours actif) : {passive.text}
							</p>
						) : null}
						<div className="hero-card__tools">
							<button type="button" className="btn btn--small btn--ghost" onClick={() => props.onSheet(shown.id)}>
								📜 Fiche
							</button>
							{!mine ? (
								<button type="button" className="btn btn--small" onClick={() => props.onView(null)}>
									{phase === 'hero' ? `← Revenir à ${actor.name}, qui joue` : 'Fermer'}
								</button>
							) : null}
						</div>
						<p className="hero-card__hint">
							{!mine
								? phase === 'hero'
									? `Ce n’est pas son tour : c’est à ${actor.name} de jouer.`
									: `Les monstres jouent.`
								: ability
								? ability.target === 'ally'
									? `Touche le compagnon à aider (il brille).`
									: `Touche la créature à viser (elle brille).`
								: !combat.moved
									? `Tu peux d’abord te déplacer : touche une case lumineuse. Puis choisis ton action.`
									: `Choisis ton action.`}
						</p>
					</div>

					{ability && mine ? (
						<div className="hero-card__actions">
							<button type="button" className="btn btn--ghost" onClick={() => setSelected(null)}>
								← Choisir une autre action
							</button>
						</div>
					) : (
						<div className="choices hero-card__actions">
							{abilities.map((a) => {
								const ok = mine && canUse(combat, party, actor, a);
								const stat = a.stat ? shown.stats[a.stat] : 0;
								return (
									<button
										key={a.id}
										type="button"
										className={`choice${a.perCombat ? ' choice--power' : ''}${!a.damage ? ' choice--alt' : ''}`}
										disabled={busy || !ok}
										onClick={() => pickAbility(a)}
									>
										<span className="choice__label">
											{a.icon} {a.name}
										</span>
										<span className="choice__desc">{a.text}</span>
										<span className="choice__tag">
											{mine && !ok
												? a.range === 1
													? 'Personne au contact : approche-toi'
													: 'Personne à portée : approche-toi'
												: a.stat
													? `${STAT_LABEL[a.stat]} ${stat}${a.harder ? ` (+${a.harder} de difficulté)` : ''} : ${need(stat, difficulty + (a.harder ?? 0))}`
													: 'Sans dé'}
											{a.range ? ` · portée ${a.range === 1 ? 'au contact' : `${a.range} cases`}` : ''}
											{a.perCombat ? ' · une fois par combat' : ''}
										</span>
									</button>
								);
							})}
							{mine && def.talk ? (
								<button type="button" className="choice choice--alt" disabled={busy} onClick={props.onTalk}>
									<span className="choice__label">💬 {def.talk.label}</span>
									<span className="choice__tag">
										{STAT_LABEL[def.talk.stat]} {actor.stats[def.talk.stat]} : {need(actor.stats[def.talk.stat], DIFFICULTY[def.talk.difficulty].target)}
									</span>
								</button>
							) : null}
							{mine && def.flee ? (
								<button type="button" className="choice choice--alt" disabled={busy} onClick={props.onFlee}>
									<span className="choice__label">🏃 {def.flee.label}</span>
									<span className="choice__tag">
										{STAT_LABEL[def.flee.stat]} {actor.stats[def.flee.stat]} : {need(actor.stats[def.flee.stat], DIFFICULTY[def.flee.difficulty].target)}
									</span>
								</button>
							) : null}
							{mine ? (
								<button type="button" className="choice choice--alt" disabled={busy} onClick={props.onWait}>
									<span className="choice__label">⏳ Finir mon tour</span>
									<span className="choice__tag">Sans rien faire de plus</span>
								</button>
							) : null}
						</div>
					)}
				</section>
			) : null}
		</>
	);

	return (
		<section className={`fight${(say?.tone === 'foe' && say.heroId) || shake ? ' is-shaking' : ''}`} aria-labelledby="fight-title" aria-busy={busy}>
			<h2 id="fight-title" className="visually-hidden">
				Combat contre {def.enemy.name}
			</h2>

			<ol className="fight__order" aria-label="Ordre de jeu (initiative)">
				{order.map((id, i) => {
					const down = id !== 'enemy' && (heroById(id)?.pv ?? 0) === 0;
					return (
						<li
							key={id}
							className={`order-chip${id === 'enemy' ? ' order-chip--foe' : ''}${i === combat.turn && !busy ? ' is-current' : ''}${down ? ' is-out' : ''}`}
							aria-current={i === combat.turn ? 'step' : undefined}
						>
							<span className="order-chip__name">{nameOf(id)}</span>
							<span className="order-chip__score">{combat.initiative[id]?.total ?? ''}</span>
						</li>
					);
				})}
			</ol>

			{/* ---------- Le plateau ---------- */}
			{/* Le texte d'action est posé hors du plateau penché : en 3D, les jetons et les effets passeraient devant lui. */}
			<div className="board-wrap">
				<div className="board" style={{ aspectRatio: `${BOARD_W} / ${BOARD_H}` }}>
					{/* La table, légèrement penchée (les jetons restent debout) ; les effets animés sont posés dessus. */}
					<div className="board__table">
						<svg className="board__grid" viewBox={`0 0 ${BOARD_W} ${BOARD_H}`} aria-hidden={moves.length ? undefined : true}>
							<defs>
								<marker id="arrow-foe" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
									<path d="M0,0 L10,5 L0,10 z" fill="#ff7a5c" />
								</marker>
								<marker id="arrow-aggro" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
									<path d="M0,0 L10,5 L0,10 z" fill="#f6c27f" />
								</marker>
							</defs>
							{Array.from({ length: BOARD.rows }, (_, r) =>
								Array.from({ length: BOARD.cols }, (_, c) => {
									const h = { c, r };
									const k = hexKey(h);
									const canMove = moveSet.has(k);
									const zone = r <= 1 ? ' is-foe-zone' : r >= BOARD.rows - 2 ? ' is-hero-zone' : '';
									return (
										<polygon
											key={k}
											points={hexPoints(h)}
											className={`hex${zone}${canMove ? ' is-move' : ''}${rangeSet.has(k) ? ' is-range' : ''}`}
											onClick={canMove ? () => props.onMove(h) : undefined}
											onKeyDown={canMove ? (e) => (e.key === 'Enter' || e.key === ' ') && props.onMove(h) : undefined}
											tabIndex={canMove ? 0 : undefined}
											role={canMove ? 'button' : undefined}
											aria-label={canMove ? `Aller sur cette case (${distance(combat.pos[actor.id], h)} case${distance(combat.pos[actor.id], h) > 1 ? 's' : ''})` : undefined}
										/>
									);
								}),
							)}
							{intents.map((i) => {
								const a = posOf(i.foeId);
								const b = combat.pos[i.heroId];
								if (!a || !b) return null;
								const p = center(a);
								const q = center(b);
								// On s'arrête au bord du jeton visé.
								const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
								const end = { x: q.x - ((q.x - p.x) / len) * 42, y: q.y - ((q.y - p.y) / len) * 42 };
								const aggro = i.why !== 'near';
								return (
									<line
										key={i.foeId}
										className={`intent${aggro ? ' intent--aggro' : ''}`}
										x1={p.x}
										y1={p.y}
										x2={end.x}
										y2={end.y}
										markerEnd={`url(#${aggro ? 'arrow-aggro' : 'arrow-foe'})`}
									/>
								);
							})}
						</svg>

						{combat.foes.map((f) => {
							const hit = landed ? hits.get(f.id) : undefined;
							const status = landed ? statuses.find((s) => s.foeId === f.id) : undefined;
							const targetable = targets.foes.some((t) => t.id === f.id);
							const acting = say?.foeId === f.id;
							const hp = f.hp + (dmgLeft[f.id] ?? 0);
							return (
								<button
									key={`${f.id}-${hit ? seq : 0}`}
									type="button"
									className={`token token--foe${hp <= 0 ? ' is-down' : ''}${hit?.crit ? ' is-crit' : ''}${hit ? ' is-hit' : ''}${hit?.spell ? ' is-spell' : ''}${acting ? ' is-acting' : ''}${targetable ? ' is-target' : ''}`}
									style={place(posOf(f.id))}
									disabled={!targetable}
									onClick={() => ability && fire(ability, [f.id])}
									aria-label={`${f.name} : ${heartsText(Math.max(0, hp))}${targetable ? ' — viser' : ''}`}
									title={f.name}
								>
									<MediaView className="token__img" media={media} image={f.image} alt="" placeholder={f.name.replace(/^(le|la|les|l’)\s*/i, '')} />
									<span className="token__icons" aria-hidden="true">
										{f.stunned && f.stunKind ? STUN_ICON[f.stunKind] : ''}
										{f.poison ? '🧪' : ''}
										{f.blind ? '🔆' : ''}
										{f.taunt ? '😜' : ''}
									</span>
									<Hearts foe={f} hp={hp} small />
									{hit ? <HeartPop count={Math.ceil(hit.amount / 2)} /> : null}
									<span className="token__name">{f.name.replace(/^(le|la|les)\s/i, '')}</span>
									{hit ? (
										<span className="token__burst" aria-hidden="true">
											{hit.crit ? 'Critique ! ' : ''}−{heartsText(hit.amount)}
										</span>
									) : status?.failed ? (
										<span className="token__burst token__burst--miss" aria-hidden="true">
											Raté !
										</span>
									) : status ? (
										<span className="token__burst token__burst--status" aria-hidden="true">
											{status.what === 'provoque' ? '😜 Provoquée !' : status.what === 'poison' ? '🧪' : status.what === 'aveugle' ? '🔆 Aveuglée' : `${STUN_ICON[status.what]}`}
										</span>
									) : null}
								</button>
							);
						})}

						{party.map((c) => {
							const st = combat.heroes[c.id];
							const pv = c.pv + (dmgLeft[c.id] ?? 0);
							const targetable = targets.allies.some((a) => a.id === c.id);
							const isTurn = c.id === actor.id && phase === 'hero' && !busy;
							return (
								<button
									key={`${c.id}-${landed && (support?.what === 'heal' || support?.targetId === c.id || missedBy === c.id) ? seq : 0}`}
									type="button"
									className={`token token--hero${isTurn ? ' is-turn' : ''}${!ability && shown.id === c.id && shown.id !== actor.id ? ' is-viewed' : ''}${hurtId === c.id ? ' is-hurt' : ''}${pv <= 0 ? ' is-out' : ''}${targetable ? ' is-target' : ''}${aggroHeroes.has(c.id) ? ' is-aggro' : ''}`}
									style={place(combat.pos[c.id])}
									disabled={ability ? !targetable : false}
									aria-pressed={!ability ? shown.id === c.id : undefined}
									onClick={() => (ability ? fire(ability, [c.id]) : props.onView(c.id === actor.id ? null : c.id))}
									aria-label={`${c.name}, ${className(c)} : ${pv} PV sur ${c.pvMax}${targetable ? ' — choisir' : ' — voir ses compétences'}`}
									title={`${c.name} (${className(c)})`}
								>
									<HeroPortrait className="token__img" character={c} media={media} />
									<span className="token__icons" aria-hidden="true">
										{st?.protectedBy ? '🛡️' : ''}
										{st?.shield ? '🌕' : ''}
										{st?.fury ? '🔥' : ''}
										{st?.afflict ? '🤒' : ''}
									</span>
									<span className="token__pv" aria-hidden="true">
										<span style={{ width: `${(Math.max(0, pv) / c.pvMax) * 100}%` }} />
									</span>
									<span className="token__name">{c.name}</span>
									{hurtId === c.id && say?.amount ? <HeartPop count={Math.min(4, say.amount)} /> : null}
									{hurtId === c.id && say?.amount ? (
										<span className="token__burst token__burst--hurt" aria-hidden="true">
											−{say.amount} PV
										</span>
									) : !landed ? null : missedBy === c.id && !statuses.some((x) => x.failed) ? (
										<span className="token__burst token__burst--miss" aria-hidden="true">
											Raté !
										</span>
									) : support?.what === 'heal' ? (
										<span className="token__burst token__burst--heal" aria-hidden="true">
											+{support.amount} PV
										</span>
									) : support?.targetId === c.id ? (
										<span className="token__burst token__burst--heal" aria-hidden="true">
											{support.what === 'shield' ? '🌕' : '🛡️'}
										</span>
									) : null}
								</button>
							);
						})}

						{props.fx === 'full' ? <canvas ref={fxCanvas} className="board__fx" aria-hidden="true" /> : null}
					</div>
				</div>

				{say ? (
					<p className={`board__say board__say--${say.tone}`} role="status" aria-live="assertive" style={{ '--beat': `${say.ms}ms` } as React.CSSProperties}>
						{say.text}
					</p>
				) : null}
			</div>

			{log.length ? (
				<ol className="fight__log" aria-label="Les derniers coups">
					{log.map((line, i) => (
						<li key={i} className={i === log.length - 1 ? 'is-last' : ''}>
							{line}
						</li>
					))}
				</ol>
			) : null}

			{props.sideEl ? createPortal(side, props.sideEl) : side}

			{beat?.kind === 'intro' ? <CombatIntro from={props.introFrom} to={props.introTo ?? props.introFrom} ms={beat.ms} /> : null}

			{beat?.kind === 'banner' ? (
				<div
					key={`${seq}-${beat.title}`}
					className={`fight-banner fight-banner--${beat.tone}`}
					style={{ '--beat': `${beat.ms}ms` } as React.CSSProperties}
					role="status"
					aria-live="assertive"
				>
					<div className="fight-banner__card">
						<p className="fight-banner__title">{beat.title}</p>
						{beat.subtitle ? <p className="fight-banner__sub">{beat.subtitle}</p> : null}
						{beat.lines ? (
							<ol className="fight-banner__lines">
								{beat.lines.map((l) => (
									<li key={l}>{l}</li>
								))}
							</ol>
						) : null}
					</div>
				</div>
			) : null}
		</section>
	);
}
