'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BOARD, BOARD_H, BOARD_W, HEX_W, center, distance, hexKey, hexPoints, type Hex } from '@/engine/board';
import { availableAbilities, canUse, cooldownLeft, interveners, moveOptions, passiveAbilities, targetsFor } from '@/engine/engine';
import { CLASSES, DIFFICULTY, STATS, STAT_LABEL, className, classWithArticle, everyText, type Ability, type AbilityId } from '@/engine/rules';
import type { Character, CombatDef, CombatState, FoeState, GameEvent } from '@/engine/types';
import type { MediaMap } from '@/lib/media-types';
import { CombatTutorial } from './CombatTutorial';
import { CombatIntro } from './fx/CombatIntro';
import { FxEngine } from './fx/fx-engine';
import { BIG_FX, celebrate, playAbility, playFoeAttack, playFoeSpell, playPoison, playRally, playRiposte } from './fx/fx-library';
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
	/** Intervention : le guerrier se jette devant un compagnon visé. */
	onIntervene: (heroId: string, allyId: string) => void;
	/** Le tutoriel du premier combat est à faire (sur le compte) ; il est fini ou passé. */
	tutorial?: boolean;
	onTutorialDone?: () => void;
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
	| { kind: 'banner'; title: string; subtitle?: string; lines?: string[]; tone: 'start' | 'hero' | 'foe' | 'win'; ms: number; voice?: string }
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
			/** Œil pour œil : la créature reçoit ces PV en retour, à ce moment-là, du guerrier `riposteBy`. */
			riposte?: number;
			riposteBy?: string;
			/** Le coup est un sort de la créature (effet magique, pas de griffes). */
			spell?: boolean;
			/** Une créature lance son sort (pour un sort sans cible : le cri de ralliement). */
			cast?: string;
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

/**
 * Barre de vie façon jeu de tactique : un cadre noir gradué, une jauge pleine (verte pour les héros,
 * rouge pour les créatures) et, derrière, une traînée blanche qui montre la vie perdue puis fond.
 * Un bouclier s'ajoute en argent au bout de la jauge.
 */
function HealthBar({ id, memo, value, max, tone, shield = 0 }: { id: string; memo: Record<string, number>; value: number; max: number; tone: 'hero' | 'foe'; shield?: number }) {
	// Le jeton est recréé à chaque coup (pour relancer ses animations) : la dernière valeur est gardée
	// par le plateau (`memo`), pour que la jauge parte de là et que la traînée montre ce qui vient d'être perdu.
	const before = memo[id] ?? value;
	const [fill, setFill] = useState(before);
	const [trail, setTrail] = useState(Math.max(before, value));
	useEffect(() => {
		memo[id] = value;
		const r = requestAnimationFrame(() => setFill(value));
		const t = window.setTimeout(() => setTrail(value), 450);
		return () => {
			cancelAnimationFrame(r);
			window.clearTimeout(t);
		};
	}, [id, memo, value]);
	const pct = (n: number) => `${Math.max(0, Math.min(1, n / max)) * 100}%`;
	// Une graduation tous les 2 points (un cœur), toutes les 4 si la barre est très longue.
	const step = max > 24 ? 4 : 2;
	const ticks = Math.max(0, Math.ceil(max / step) - 1);
	return (
		<span className={`hp-bar hp-bar--${tone}${value / max <= 0.3 ? ' is-low' : ''}`} aria-hidden="true">
			<span className="hp-bar__trail" style={{ width: pct(Math.max(trail, fill)) }} />
			<span className="hp-bar__fill" style={{ width: pct(fill) }} />
			{shield > 0 ? <span className="hp-bar__shield" style={{ left: pct(fill), width: pct(shield) }} /> : null}
			{ticks ? <span className="hp-bar__ticks" style={{ '--ticks': Math.ceil(max / step) } as React.CSSProperties} /> : null}
		</span>
	);
}

/**
 * Les chiffres de combat, façon jeu de cartes : gros, épais, cernés de noir ; ils surgissent en grossissant,
 * rebondissent puis montent en s'effaçant. Rouge pour les dégâts (plus gros et penché sur un critique),
 * vert pour un soin, avec de petites croix qui s'envolent.
 */
function CombatNumber({ value, crit = false }: { value: number; crit?: boolean }) {
	const heal = value > 0;
	return (
		<span className={`combat-num combat-num--${heal ? 'heal' : 'dmg'}${crit ? ' is-crit' : ''}`} aria-hidden="true">
			<span className="combat-num__value">
				{heal ? '+' : '−'}
				{Math.abs(value)}
			</span>
			{crit ? <span className="combat-num__label">Critique !</span> : null}
			{heal
				? [0, 1, 2, 3].map((i) => (
						<span key={i} className="combat-num__cross" style={{ '--i': i } as React.CSSProperties}>
							+
						</span>
					))
				: null}
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
 * et touche sa cible sur le plateau. Au tour des monstres, chacun annonce sa cible (flèche) ou son sort :
 * le guerrier peut se jeter devant un compagnon visé (Intervention) avant qu'ils frappent.
 */
/** Durée de lecture confortable d'un texte (lecture à voix haute en famille). */
const readMs = (text: string) => 1100 + text.length * 40;

/** Durée de l'élan avant un coup (ms) : le jeton grossit, puis le coup part. */
const WINDUP = 420;

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
	/** Le héros qui prend son élan (il grossit avant de frapper, façon jeu de tactique). */
	const [castId, setCastId] = useState<string | null>(null);
	/** Œil pour œil : le guerrier fait un aller-retour vers la créature qui l'a frappé (direction en px). */
	const [lunge, setLunge] = useState<{ id: string; dx: number; dy: number } | null>(null);
	/** Glisser-déposer du héros qui joue : décalage depuis sa case, et case survolée. */
	const [drag, setDrag] = useState<{ dx: number; dy: number; over: string | null } | null>(null);
	const dragStart = useRef<{ x: number; y: number; moved: boolean } | null>(null);
	/** Le jeton qui vient d'être posé (il rebondit). */
	const [landId, setLandId] = useState<string | null>(null);
	/** Dernière valeur de chaque barre de vie (voir HealthBar). */
	const hpMemo = useRef<Record<string, number>>({});
	/** Pendant le tour des monstres : les héros qui ont passé leur tour de provocation. */
	const [passed, setPassed] = useState<string[]>([]);
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
				beats.push({ kind: 'act', ev: e, ms: 2900 });
				acted = true;
			} else if (e.kind === 'hit' || e.kind === 'miss' || e.kind === 'support' || e.kind === 'foe-status') {
				if (e.kind === 'hit') pending[e.foeId] = (pending[e.foeId] ?? 0) + e.amount;
				if (!acted) beats.push({ kind: 'wait', ms: 1800 });
				acted = true;
			} else if (e.kind === 'foe-blocked') {
				beats.push({ kind: 'say', tone: 'hero', foeId: e.foeId, ms: 2000, text: `🎶 ${cap(e.name)} se cogne contre la Ronde enchantée : rien ne passe !` });
			} else if (e.kind === 'intervene') {
				beats.push({ kind: 'say', tone: 'hero', ms: 2200, text: `🛡️ ${nameOf(e.heroId)} se jette devant ${nameOf(e.allyId)} : les coups seront pour lui !` });
			} else if (e.kind === 'foe-charge') {
				beats.push({ kind: 'say', tone: 'foe', foeId: e.foeId, ms: 2600, text: `${e.icon} ${cap(e.name)} ${e.text}` });
			} else if (e.kind === 'foe-cast') {
				beats.push({ kind: 'say', tone: 'foe', foeId: e.foeId, cast: e.spellKind, ms: 1900, text: `${e.icon} ${cap(e.name)} lance ${e.spell} !` });
			} else if (e.kind === 'foe-fizzle') {
				beats.push({ kind: 'say', tone: 'hero', foeId: e.foeId, ms: 2200, text: `${e.why === 'muet' ? '🤐' : '💫'} ${cap(e.name)} ${e.why === 'muet' ? 'est bâillonnée' : 'est sonnée'} : ${e.spell} s’éteint !` });
			} else if (e.kind === 'enemy-turn') {
				// Le bandeau annonce le tour et raconte l'attaque (lue par le Conteur) : une seule chose à lire.
				beats.push({ kind: 'banner', title: turnOf(e.name), subtitle: e.attack ?? 'Attention…', voice: e.attack, tone: 'foe', ms: 2200 });
			} else if (e.kind === 'foe-poison') {
				pending[e.foeId] = (pending[e.foeId] ?? 0) + 1;
				beats.push({ kind: 'say', tone: 'hero', foeId: e.foeId, poison: true, ms: 1900, text: `🧪 Le poison ronge ${e.name} : −1 PV${e.dead ? ', elle s’effondre !' : '.'}` });
			} else if (e.kind === 'foe-skip') {
				beats.push({ kind: 'say', tone: 'hero', foeId: e.foeId, ms: 1900, text: `${STUN_ICON[e.reason]} ${cap(e.name)} ${STUN_TEXT[e.reason]} et passe son tour.` });
			} else if (e.kind === 'foe-move') {
				from[e.foeId] ??= e.from;
				beats.push({ kind: 'say', tone: e.pushed ? 'hero' : 'foe', foeId: e.foeId, move: true, ms: 1100, text: e.pushed ? `💥 ${cap(nameOf(e.foeId))} est repoussée !` : `${cap(nameOf(e.foeId))} s’avance…` });
			} else if (e.kind === 'foe-attack') {
				pending[e.heroId] = (pending[e.heroId] ?? 0) + e.amount;
				const victim = nameOf(e.heroId);
				// Court : le détail se voit sur le plateau (chiffre de dégâts, bulle « CLANG ! » si l'armure encaisse).
				const extra = e.guarded ? ` ${victim} s’interpose !` : !e.amount && !e.stunned ? ' Aucun dégât !' : e.afflict ? ` 🔥 ${cap(e.afflict)} !` : '';
				const stun = e.stunned ? (e.spell ? ` 💤 ${victim} s’endort !` : ` 💫 ${victim} est assommé·e !`) : '';
				const rage = e.rage ? ` 😡 Folle de rage : +${Math.round((e.rage - 1) * 100)} % !` : '';
				const text = e.missed
					? `🌫️ ${cap(e.name)}, aveuglée, frappe à côté de ${victim} !`
					: e.spell
						? `${cap(e.spell)} touche ${victim} !${e.amount ? '' : stun ? '' : ' Aucun dégât !'}${e.afflict ? ` 🔥 ${cap(e.afflict)} !` : ''}${stun}`
						: `${cap(e.name)} ${e.cleave ? 'balaie aussi' : 'frappe'} ${victim} !${rage}${extra}${stun}`;
				beats.push({ kind: 'say', tone: 'foe', foeId: e.foeId, heroId: e.missed ? undefined : e.heroId, amount: e.amount, spell: Boolean(e.spell), ms: 2000, text });
			} else if (e.kind === 'riposte') {
				pending[e.foeId] = (pending[e.foeId] ?? 0) + e.amount;
				const after = e.dead ? ', elle s’effondre !' : e.stunned ? ' 💫 Assommée !' : '';
				beats.push({ kind: 'say', tone: 'hero', foeId: e.foeId, riposte: e.amount, riposteBy: e.heroId, ms: 1900, text: `👁️ Œil pour œil : ${nameOf(e.heroId)} renvoie le coup, ${e.name} −${e.amount} PV${after}` });
			} else if (e.kind === 'hero-skip') {
				beats.push({ kind: 'say', tone: 'foe', ms: 1900, text: `💫 ${nameOf(e.heroId)}, encore sonné·e, passe son tour.` });
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
						// L'élan d'abord (le jeton grossit), puis le coup part.
						setCastId(ev.heroId);
						timers.current.push(
							window.setTimeout(() => {
								const eng = fxEngine.current;
								const hitAt = eng ? playAbility(eng, ev.ability, { from: at(ev.heroId), foes: ev.foeIds.map(at), allies, success: ev.success, crit: Boolean(ev.crit) }) : 350;
								timers.current.push(window.setTimeout(land, hitAt));
							}, WINDUP),
						);
						return;
					}
					setCastId(null);
					const voice = 'voice' in b ? b.voice : undefined;
					if (voice) {
						const url = voiceFor(voice);
						if (url) {
							const a = new Audio(url);
							a.volume = voiceVolume;
							void a.play().catch(() => {});
						}
					}
					if (b.kind !== 'say') return;
					if (b.poison && b.foeId) {
						const id = b.foeId;
						const hurtAt = fxEngine.current ? playPoison(fxEngine.current, center(combat.pos[id])) : 300;
						timers.current.push(window.setTimeout(() => setDmgLeft((d) => ({ ...d, [id]: Math.max(0, (d[id] ?? 0) - 1) })), hurtAt));
					}
					if (b.cast === 'rally' && b.foeId && fxEngine.current) playRally(fxEngine.current, center(combat.pos[b.foeId]));
					if (b.riposte && b.foeId) {
						const id = b.foeId;
						const amount = b.riposte;
						// Le guerrier s'élance vers la créature et revient (sur le plateau, la distance en pourcentage du jeton).
						if (b.riposteBy) {
							const a = center(combat.pos[b.riposteBy]);
							const f = center(combat.pos[id]);
							const len = Math.hypot(f.x - a.x, f.y - a.y) || 1;
							setLunge({ id: b.riposteBy, dx: ((f.x - a.x) / len) * 38, dy: ((f.y - a.y) / len) * 38 });
							timers.current.push(window.setTimeout(() => setLunge(null), 650));
						}
						const hurtAt = fxEngine.current ? playRiposte(fxEngine.current, center(combat.pos[id]), b.riposteBy ? center(combat.pos[b.riposteBy]) : undefined) : 300;
						timers.current.push(window.setTimeout(() => setDmgLeft((d) => ({ ...d, [id]: Math.max(0, (d[id] ?? 0) - amount) })), hurtAt));
					}
					if (b.move && b.foeId) {
						const id = b.foeId;
						setPosFrom((p) => {
							const next = { ...p };
							delete next[id];
							return next;
						});
					}
					if (b.heroId) {
						const id = b.heroId;
						const amount = b.amount ?? 0;
						if (b.foeId) onSfx('sfx-griffe');
						const foe = b.foeId ? foeById(b.foeId) : undefined;
						// Les PV baissent au moment où le coup tombe.
						const hurt = () => {
							setDmgLeft((d) => ({ ...d, [id]: Math.max(0, (d[id] ?? 0) - amount) }));
							setHurtId(id);
							if (amount > 0) onSfx('sfx-blessure');
						};
						const eng = fxEngine.current;
						if (foe && eng) {
							const from = center(combat.pos[foe.id]);
							const to = center(combat.pos[id]);
							// Le monstre prend son élan (voir .token.is-acting), puis frappe.
							timers.current.push(
								window.setTimeout(() => {
									timers.current.push(window.setTimeout(hurt, b.spell ? playFoeSpell(eng, foe.name, from, to, amount > 0) : playFoeAttack(eng, foe.name, from, to, amount > 0)));
								}, 120),
							);
						} else timers.current.push(window.setTimeout(hurt, 300));
					}
				}, t),
			);
			t += b.ms;
		}
		timers.current.push(
			window.setTimeout(() => {
				setBeat(null);
				setHurtId(null);
				setCastId(null);
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
	/** Aller sur une case : le jeton s'y pose en rebondissant. */
	const moveTo = (h: Hex) => {
		setLandId(actor.id);
		// Pas dans `timers` : le déplacement relance la séquence, qui vide cette liste.
		window.setTimeout(() => setLandId(null), 650);
		props.onMove(h);
	};
	/** La case de déplacement sous le pointeur, s'il y en a une. */
	const hexUnder = (x: number, y: number) => {
		const el = document.elementsFromPoint(x, y).find((n) => n instanceof SVGElement && n.dataset.hex && n.classList.contains('is-move'));
		return el instanceof SVGElement ? (el.dataset.hex ?? null) : null;
	};
	const canDrag = moves.length > 0 && !ability;
	const dragHandlers = {
		onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
			if (!canDrag || e.button !== 0) return;
			dragStart.current = { x: e.clientX, y: e.clientY, moved: false };
			e.currentTarget.setPointerCapture(e.pointerId);
		},
		onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => {
			const st = dragStart.current;
			if (!st) return;
			const dx = e.clientX - st.x;
			const dy = e.clientY - st.y;
			if (!st.moved && Math.hypot(dx, dy) < 6) return;
			st.moved = true;
			setDrag({ dx, dy, over: hexUnder(e.clientX, e.clientY) });
		},
		onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
			const st = dragStart.current;
			dragStart.current = null;
			if (!st?.moved) return;
			const key = hexUnder(e.clientX, e.clientY);
			const to = key ? moves.find((h) => hexKey(h) === key) : undefined;
			setDrag(null);
			if (to) moveTo(to);
		},
		onPointerCancel: () => {
			dragStart.current = null;
			setDrag(null);
		},
		// Le portrait est une image : sans ça, le navigateur lance son propre glisser d'image, qui annule le nôtre.
		onDragStart: (e: React.DragEvent<HTMLButtonElement>) => e.preventDefault(),
	};
	const intents = phase === 'intent' && !busy ? combat.intents : [];
	const posOf = (id: string) => posFrom[id] ?? combat.pos[id];

	const fire = (ab: Ability, ids?: string[]) => {
		setSelected(null);
		props.onAbility(ab.id, ids);
	};
	const pickAbility = (ab: Ability) => {
		// Une compétence à une seule cible attend toujours qu'on touche le jeton visé, même s'il n'y en a qu'un :
		// on choisit qui on frappe (ou qui on aide), rien ne part tout seul.
		if (ab.target === 'foe' || ab.target === 'ally') setSelected(ab.id);
		else fire(ab);
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

	/* ---------- Tour des monstres : on voit leurs flèches ; le guerrier peut se jeter devant un compagnon visé ---------- */
	const intentOpen = phase === 'intent' && !busy;
	// Les guerriers qui peuvent s'interposer, dans l'ordre d'initiative : le premier choisit (ou passe), puis le suivant.
	const guards = intentOpen
		? [...new Map(combat.intents.flatMap((i) => interveners(combat, party, i)).map((c) => [c.id, c])).values()]
				.filter((c) => !passed.includes(c.id))
				.sort((a, b) => combat.order.indexOf(a.id) - combat.order.indexOf(b.id))
		: [];
	const guard = guards[0];
	/** Les compagnons visés devant qui il peut se jeter. */
	const protectable = new Set(guard ? combat.intents.filter((i) => interveners(combat, party, i).some((c) => c.id === guard.id)).map((i) => i.heroId) : []);
	// Nouveau tour des monstres : personne n'a encore passé.
	useEffect(() => {
		if (!intentOpen) setPassed([]);
	}, [intentOpen]);
	const intentBar = intentOpen ? (
		<div className="intent-bar card" role="region" aria-label="Tour des monstres" data-tuto="monstres">
			{guard ? (
				<>
					<p className="intent-bar__text">
						🛡️ <strong>{guard.name}</strong> peut se jeter devant un compagnon visé (Intervention) : touche celui qui brille.
						<small> (il prendra ses coups, avec 1 dégât de moins)</small>
					</p>
					{guards.length > 1 ? (
						<button type="button" className="btn btn--ghost" onClick={() => setPassed((p) => [...p, guard.id])}>
							Passer → à {guards[1].name}
						</button>
					) : null}
				</>
			) : (
				<p className="intent-bar__text">Les flèches rouges montrent qui les monstres vont attaquer.</p>
			)}
			<button type="button" className="btn intent-bar__go" onClick={props.onResolve}>
				⚔️ Laisser les monstres attaquer
			</button>
		</div>
	) : null;
	/** Les cases où va tomber un sort de zone préparé (on peut encore s'en écarter). */
	const danger = new Set(combat.foes.filter((f) => f.hp > 0 && f.charging?.zone).flatMap((f) => f.charging!.zone!.map(hexKey)));
	/** Les cases sous une Ronde enchantée. */
	const inRonde = new Set((combat.barriers ?? []).flatMap((b) => b.zone.map(hexKey)));

	const side = (
		<>
			{/* ---------- La carte du héros : celui dont c'est le tour, ou celui qu'on regarde ---------- */}
			{phase === 'hero' || shown.id !== actor.id ? (
				<section className={`hero-card card${busy && mine ? ' is-waiting' : ''}${mine ? '' : ' is-preview'}`} aria-labelledby="hero-card-title" data-tuto="fiche">
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
								{shown.pv}/{shown.pvMax} PV
							</span>
							{cls.armor ? (
								<span>
									🛡️ armure {hs?.armor ?? cls.armor}/{cls.armor}
								</span>
							) : null}
							<span>👣 {mine && combat.moved ? 'déjà déplacé' : `${cls.move} cases`}</span>
							{hs?.shield ? <span>🌕 bouclier {hs.shield}</span> : null}
							{hs?.fury ? <span className="is-hot">🔥 folie vengeresse : prochaine attaque +50 % !</span> : null}
							{hs?.stunned ? <span className="is-bad">💫 assommé·e : passe son prochain tour</span> : null}
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
									? `Touche sur le plateau le compagnon à aider (il brille).`
									: `Touche sur le plateau la créature à viser (elle brille).`
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
						<div className="choices hero-card__actions" data-tuto="actions">
							{abilities.map((a) => {
								const ok = mine && canUse(combat, party, actor, a);
								const wait = cooldownLeft(combat, shown, a);
								const stat = a.stat ? shown.stats[a.stat] : 0;
								return (
									<button
										key={a.id}
										type="button"
										className={`choice${a.every ? ' choice--power' : ''}${!a.damage ? ' choice--alt' : ''}${mine && !ok ? ' is-blocked' : ''}`}
										disabled={busy || !ok}
										onClick={() => pickAbility(a)}
									>
										<span className="choice__label">
											{a.icon} {a.name}
										</span>
										<span className="choice__desc">{a.text}</span>
										<span className="choice__tag">
											{wait
												? `Encore ${wait} tour${wait > 1 ? 's' : ''} avant de pouvoir la relancer`
												: mine && !ok
												? a.range === 1
													? 'Personne au contact : approche-toi'
													: 'Personne à portée : approche-toi'
												: a.stat
													? `${STAT_LABEL[a.stat]} ${stat}${a.harder ? ` (+${a.harder} de difficulté)` : ''} : ${need(stat, difficulty + (a.harder ?? 0))}`
													: 'Sans dé'}
											{a.range ? ` · portée ${a.range === 1 ? 'au contact' : `${a.range} cases`}` : ''}
											{a.every ? ` · ${everyText(a)}` : ''}
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

			<ol className="fight__order" aria-label="Ordre de jeu (initiative)" data-tuto="ordre">
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
				<div data-tuto="plateau" className={`board${(ability && mine) || protectable.size ? ' is-aiming' : ''}${props.tutorial ? ' is-tuto' : ''}`} style={{ aspectRatio: `${BOARD_W} / ${BOARD_H}` }}>
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
											className={`hex${zone}${canMove ? ' is-move' : ''}${drag?.over === k ? ' is-drop' : ''}${danger.has(k) ? ' is-danger' : ''}${inRonde.has(k) ? ' is-ronde' : ''}`}
											data-hex={k}
											onClick={canMove ? () => moveTo(h) : undefined}
											onKeyDown={canMove ? (e) => (e.key === 'Enter' || e.key === ' ') && moveTo(h) : undefined}
											tabIndex={canMove ? 0 : undefined}
											role={canMove ? 'button' : undefined}
											aria-label={canMove ? `Aller sur cette case (${distance(combat.pos[actor.id], h)} case${distance(combat.pos[actor.id], h) > 1 ? 's' : ''})` : undefined}
										/>
									);
								}),
							)}
							{(combat.barriers ?? []).map((b) => {
								// La Ronde enchantée : un anneau de notes dorées qui tourne autour de sa zone.
								const o = center(b.zone[0]);
								const R = HEX_W * 1.55;
								return (
									<g key={b.heroId} className="ronde" style={{ transformOrigin: `${o.x}px ${o.y}px` }}>
										<circle cx={o.x} cy={o.y} r={R} className="ronde__ring" />
										{Array.from({ length: 12 }, (_, i) => (
											<text key={i} x={o.x + Math.cos((i * Math.PI) / 6) * R} y={o.y + Math.sin((i * Math.PI) / 6) * R} className="ronde__note" textAnchor="middle" dominantBaseline="middle">
												{i % 3 ? '♪' : '♫'}
											</text>
										))}
									</g>
								);
							})}
							{intents.map((i) => {
								const a = posOf(i.foeId);
								const b = combat.pos[i.heroId];
								if (!a || !b) return null;
								const p = center(a);
								const q = center(b);
								// On s'arrête au bord du jeton visé.
								const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
								const end = { x: q.x - ((q.x - p.x) / len) * 42, y: q.y - ((q.y - p.y) / len) * 42 };
								const aggro = i.why === 'taunt';
								return (
									<line
										key={i.foeId}
										className={`intent${aggro ? ' intent--aggro' : ''}${i.why === 'spell' ? ' intent--spell' : ''}`}
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
									onClick={() => (ability ? fire(ability, [f.id]) : undefined)}
									aria-label={`${f.name} : ${Math.max(0, hp)} PV sur ${f.maxHp}${f.charging && f.spell ? ` — prépare ${f.spell.name}` : ''}${targetable ? ' — viser' : ''}`}
									title={f.name}
								>
									<MediaView className="token__img" media={media} image={f.image} alt="" placeholder={f.name.replace(/^(le|la|les|l’)\s*/i, '')} />
									<span className="token__icons" aria-hidden="true">
										{f.stunned && f.stunKind ? STUN_ICON[f.stunKind] : ''}
										{f.poison ? '🧪' : ''}
										{f.blind ? '🌫️' : ''}
										{f.silenced ? '🤐' : ''}
										{f.charging && f.spell ? f.spell.icon : ''}
										{f.enraged ? '😡' : f.taunt ? '😜' : ''}
									</span>
									<HealthBar id={f.id} memo={hpMemo.current} value={hp} max={f.maxHp} tone="foe" />
									<span className="token__name">{f.name.replace(/^(le|la|les)\s/i, '')}</span>
									{hit ? (
										<CombatNumber value={-hit.amount} crit={hit.crit} />
									) : status?.failed ? (
										<span className="token__burst token__burst--miss" aria-hidden="true">
											Raté !
										</span>
									) : status ? (
										<span className="token__burst token__burst--status" aria-hidden="true">
											{status.what === 'provoque' ? '😜 Provoquée !' : status.what === 'poison' ? '🧪' : status.what === 'aveugle' ? '🌫️ Aveuglée' : status.what === 'muet' ? '🤐 Bâillonnée' : `${STUN_ICON[status.what]}`}
										</span>
									) : null}
								</button>
							);
						})}

						{party.map((c) => {
							const st = combat.heroes[c.id];
							const pv = c.pv + (dmgLeft[c.id] ?? 0);
							const guardable = !ability && protectable.has(c.id);
							const targetable = targets.allies.some((a) => a.id === c.id) || guardable;
							const isTurn = c.id === actor.id && phase === 'hero' && !busy;
							return (
								<button
									key={`${c.id}-${landed && ((support?.what === 'heal' && !support.targetId) || support?.targetId === c.id || missedBy === c.id) ? seq : 0}`}
									type="button"
									className={`token token--hero${isTurn ? ' is-turn' : ''}${!ability && shown.id === c.id && shown.id !== actor.id ? ' is-viewed' : ''}${hurtId === c.id ? ' is-hurt' : ''}${castId === c.id ? ' is-casting' : ''}${c.id === actor.id && canDrag ? ' is-draggable' : ''}${c.id === actor.id && drag ? ' is-dragging' : ''}${landId === c.id ? ' is-landing' : ''}${pv <= 0 ? ' is-out' : ''}${targetable ? ' is-target' : ''}${guard?.id === c.id ? ' is-aggro' : ''}${lunge?.id === c.id ? ' is-lunging' : ''}`}
									style={
										c.id === actor.id && drag
											? ({ ...place(combat.pos[c.id]), '--dx': `${drag.dx}px`, '--dy': `${drag.dy}px` } as React.CSSProperties)
											: lunge?.id === c.id
												? ({ ...place(combat.pos[c.id]), '--lx': `${lunge.dx}%`, '--ly': `${lunge.dy}%` } as React.CSSProperties)
												: place(combat.pos[c.id])
									}
									{...(c.id === actor.id ? dragHandlers : {})}
									data-tuto={c.id === actor.id ? 'actif' : undefined}
									disabled={ability ? !targetable : false}
									aria-pressed={!ability ? shown.id === c.id : undefined}
									onClick={() => (ability ? fire(ability, [c.id]) : guardable && guard ? props.onIntervene(guard.id, c.id) : props.onView(c.id === actor.id ? null : c.id))}
									aria-label={`${c.name}, ${className(c)} : ${pv} PV sur ${c.pvMax}${guardable && guard ? ` — ${guard.name} se jette devant` : targetable ? ' — choisir' : ' — voir ses compétences'}`}
									title={`${c.name} (${className(c)})`}
								>
									{/* Bouclier de lune : une bulle argentée qui miroite autour du héros ; défendu par le guerrier : un halo doré. */}
									{st?.shield ? <span className="token__aura token__aura--moon" aria-hidden="true" /> : st?.protectedBy ? <span className="token__aura token__aura--guard" aria-hidden="true" /> : null}
									<HeroPortrait className="token__img" character={c} media={media} />
									<span className="token__icons" aria-hidden="true">
										{CLASSES[c.classId].abilities.includes('oeil-pour-oeil') ? <span className="token__passive" title="Œil pour œil : renvoie les coups reçus au contact">👁️</span> : null}
										{st?.protectedBy ? '🛡️' : ''}
										{st?.shield ? '🌕' : ''}
										{st?.fury ? '🔥' : ''}
										{st?.stunned ? '💫' : ''}
										{st?.afflict ? '🤒' : ''}
									</span>
									<HealthBar id={c.id} memo={hpMemo.current} value={pv} max={c.pvMax} tone="hero" shield={st?.shield ?? 0} />
									{guard?.id === c.id ? (
										<span className="token__badge" aria-hidden="true">
											🛡️ Intervention
										</span>
									) : null}
									<span className="token__name">{c.name}</span>
									{hurtId === c.id && say?.amount ? (
										<CombatNumber value={-say.amount} />
									) : !landed ? null : missedBy === c.id && !statuses.some((x) => x.failed) ? (
										<span className="token__burst token__burst--miss" aria-hidden="true">
											Raté !
										</span>
									) : support?.what === 'heal' && (!support.targetId || support.targetId === c.id) ? (
										<CombatNumber value={support.amount ?? 0} />
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
			{intentBar && typeof document !== 'undefined' ? createPortal(intentBar, document.body) : null}
			{props.tutorial && props.onTutorialDone ? (
				<CombatTutorial
					busy={busy}
					phase={phase}
					actorName={actor.name}
					moved={combat.moved}
					canMove={moves.length > 0}
					aiming={Boolean(ability)}
					seq={seq}
					acted={events.some((e) => e.kind === 'ability')}
					hasGuard={party.some((c) => c.classId === 'guerrier' && c.pv > 0)}
					spellComing={combat.foes.some((f) => f.hp > 0 && f.charging)}
					onDone={props.onTutorialDone}
				/>
			) : null}

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
