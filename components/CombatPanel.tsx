'use client';

import { useEffect, useRef, useState } from 'react';
import { DIFFICULTY, STAT_LABEL, className, classWithArticle } from '@/engine/rules';
import type { Character, CombatDef, CombatState, GameEvent, StatKey } from '@/engine/types';
import type { MediaMap } from '@/lib/media-types';
import { MediaView } from './MediaView';

type Hit = Extract<GameEvent, { kind: 'hit' }>;
type EnemyTurn = Extract<GameEvent, { kind: 'enemy-turn' }>;

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
	/** URL de l'enregistrement d'une phrase du conteur (l'attaque du monstre), s'il existe. */
	voiceFor: (text: string) => string | undefined;
	voiceVolume: number;
	onAttack: (stat: StatKey, usePower?: boolean) => void;
	onMageSpark: () => void;
	onTalk: () => void;
	onFlee: () => void;
}

type Beat =
	| { kind: 'wait'; ms: number }
	| { kind: 'banner'; title: string; subtitle?: string; tone: 'start' | 'hero' | 'foe'; ms: number }
	| { kind: 'claw'; turn: EnemyTurn; ms: number };

const ATTACKS: { stat: StatKey; label: string; icon: string }[] = [
	{ stat: 'force', label: 'Frapper', icon: '⚔️' },
	{ stat: 'agilite', label: 'Tirer ou esquiver', icon: '🏹' },
	{ stat: 'esprit', label: 'Lancer un sort', icon: '✨' },
];

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
	return `il faut ${min} ou plus au dé`;
}

/**
 * Le combat au tour par tour, mis en scène :
 * la carte du monstre en haut (elle tremble quand on la touche, un cœur se barre), les héros en dessous,
 * un bandeau qui surgit au début de chaque tour (« Au tour des brumelins ! », fond flouté),
 * et la griffe du monstre qui traverse l'écran pendant son tour.
 */
export function CombatPanel(props: Props) {
	const { def, combat, party, actor, media, events, seq, log, onSfx, voiceFor, voiceVolume } = props;
	const target = DIFFICULTY[def.enemy.difficulty].target;
	const [beat, setBeat] = useState<Beat | null>(null);
	const [shownParty, setShownParty] = useState(party);
	const [hurtId, setHurtId] = useState<string | null>(null);
	const timers = useRef<number[]>([]);

	const enemyHit = events.find((e): e is Hit => e.kind === 'hit' && e.target === 'enemy');
	const missed = events.some((e) => e.kind === 'miss');

	// À chaque étape : on compose la séquence (coup du héros → tour du monstre → tour suivant) et on la joue.
	useEffect(() => {
		timers.current.forEach(clearTimeout);
		timers.current = [];
		const enemyTurn = events.find((e): e is EnemyTurn => e.kind === 'enemy-turn');
		const nextTurn = events.find((e) => e.kind === 'turn');
		const acted = events.some((e) => e.kind === 'miss' || (e.kind === 'hit' && e.target === 'enemy'));
		const nextHero = party[combat.actor];
		const heroBanner = (): Beat => ({
			kind: 'banner',
			title: `Au tour de ${nextHero.name} !`,
			subtitle: nextHero.player ? `${nextHero.player} joue · ${className(nextHero)}` : className(nextHero),
			tone: 'hero',
			ms: 2200,
		});

		const beats: Beat[] = [];
		if (!acted && !enemyTurn && !nextTurn) {
			// Entrée en combat.
			beats.push({ kind: 'banner', title: 'Combat !', subtitle: def.enemy.name, tone: 'start', ms: 2600 }, heroBanner());
		} else {
			if (acted) beats.push({ kind: 'wait', ms: 1800 });
			if (enemyTurn) {
				beats.push({ kind: 'banner', title: turnOf(enemyTurn.name), subtitle: 'Attention…', tone: 'foe', ms: 2200 });
				beats.push({ kind: 'claw', turn: enemyTurn, ms: 3200 });
			}
			if (nextTurn && nextHero) beats.push(heroBanner());
		}
		if (!enemyTurn) setShownParty(party);

		let t = 0;
		for (const b of beats) {
			timers.current.push(
				window.setTimeout(() => {
					setBeat(b.kind === 'wait' ? null : b);
					if (b.kind === 'claw') {
						onSfx('sfx-griffe');
						const url = voiceFor(b.turn.attack);
						if (url) {
							const a = new Audio(url);
							a.volume = voiceVolume;
							void a.play().catch(() => {});
						}
						// Les PV baissent au moment où la griffe frappe.
						timers.current.push(
							window.setTimeout(() => {
								setShownParty(party);
								setHurtId(b.turn.heroId);
								onSfx('sfx-blessure');
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
				setShownParty(party);
			}, t),
		);
		return () => timers.current.forEach(clearTimeout);
		// On rejoue la séquence à chaque nouvelle étape seulement.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [seq]);

	const busy = beat !== null;
	const justLost = enemyHit ? enemyHit.amount : 0;
	const clawTarget = beat?.kind === 'claw' ? shownParty.find((c) => c.id === beat.turn.heroId) : undefined;

	return (
		<section className={`fight card${beat?.kind === 'claw' ? ' is-shaking' : ''}`} aria-labelledby="fight-title" aria-busy={busy}>
			<h2 id="fight-title" className="fight__title">
				Combat
			</h2>

			<figure key={`foe-${seq}`} className={`foe-card${enemyHit ? ' is-hit' : ''}${enemyHit?.spell ? ' is-spell' : ''}${beat?.kind === 'claw' ? ' is-attacking' : ''}`}>
				<MediaView className="foe-card__img" media={media} image={def.enemy.image} alt={def.enemy.name} placeholder={def.enemy.name} />
				<figcaption className="foe-card__body">
					<span className="foe-card__name">{def.enemy.name}</span>
					<span className="foe-card__hearts" aria-label={`Encore ${combat.hearts} cœur${combat.hearts > 1 ? 's' : ''} sur ${combat.maxHearts}`}>
						{Array.from({ length: combat.maxHearts }, (_, i) => {
							const alive = i < combat.hearts;
							const breaking = !alive && i < combat.hearts + justLost;
							return (
								<span key={i} className={`heart${alive ? '' : ' is-lost'}${breaking ? ' is-breaking' : ''}`} aria-hidden="true">
									♥
								</span>
							);
						})}
					</span>
					<span className="foe-card__rule">
						Pour le toucher : <strong>{target} ou plus</strong> · ses attaques : <strong>−{def.enemy.damage} PV</strong>
					</span>
				</figcaption>
				{enemyHit ? (
					<span className="foe-card__burst" aria-hidden="true">
						{enemyHit.spell ? '✨' : '💥'} −{enemyHit.amount} ♥
					</span>
				) : missed ? (
					<span className="foe-card__burst foe-card__burst--miss" aria-hidden="true">
						Raté !
					</span>
				) : null}
			</figure>

			<ul className="fight__party" aria-label="Le groupe">
				{shownParty.map((c) => (
					<li key={c.id} className={`fighter${c.id === actor.id && !busy ? ' is-turn' : ''}${hurtId === c.id ? ' is-hurt' : ''}${c.pv === 0 ? ' is-out' : ''}`}>
						<span className="fighter__name">{c.name}</span>
						<span className="fighter__meta">
							{c.pv}/{c.pvMax} PV{c.pv === 0 ? ` · ${c.gender === 'm' ? 'épuisé' : c.gender === 'f' ? 'épuisée' : 'épuisé·e'}` : ''}
						</span>
						<span className="fighter__pv" aria-label={`${c.pv} PV sur ${c.pvMax}`}>
							<span className="fighter__bar" style={{ width: `${(c.pv / c.pvMax) * 100}%` }} />
						</span>
						{hurtId === c.id && beat?.kind === 'claw' ? (
							<span className="fighter__dmg" aria-hidden="true">
								−{beat.turn.amount} PV
							</span>
						) : null}
					</li>
				))}
			</ul>

			{log.length ? (
				<ol className="fight__log" aria-label="Les derniers coups">
					{log.map((line, i) => (
						<li key={i} className={i === log.length - 1 ? 'is-last' : ''}>
							{line}
						</li>
					))}
				</ol>
			) : (
				<p className="fight__help">
					Chacun son tour : on choisit une action, on lance le dé et on ajoute la caractéristique. Si on touche, le monstre perd un
					cœur. Quand tout le monde a joué, c’est au tour du monstre d’attaquer. Quand il n’a plus de cœur, c’est gagné !
				</p>
			)}

			<p className="fight__turn" role="status">
				{busy ? '…' : (
					<>
						À <strong>{actor.name}</strong>
						{actor.player ? ` (${actor.player})` : ''}, {classWithArticle(actor)}, de jouer !
					</>
				)}
			</p>

			<div className="choices">
				{ATTACKS.map((a) => (
					<button key={a.stat} type="button" className="choice" disabled={busy} onClick={() => props.onAttack(a.stat)}>
						<span className="choice__label">
							{a.icon} {a.label}
						</span>
						<span className="choice__tag">
							{STAT_LABEL[a.stat]} {actor.stats[a.stat]} : {need(actor.stats[a.stat], target)}
						</span>
					</button>
				))}
				{actor.classId === 'guerrier' && actor.powerReady ? (
					<button type="button" className="choice choice--power" disabled={busy} onClick={() => props.onAttack('force', true)}>
						<span className="choice__label">✦ Coup puissant : 2 cœurs d’un coup si ça touche</span>
						<span className="choice__tag">
							Force {actor.stats.force} : {need(actor.stats.force, target)}
						</span>
					</button>
				) : null}
				{actor.classId === 'mage' && actor.powerReady ? (
					<button type="button" className="choice choice--power" disabled={busy} onClick={props.onMageSpark}>
						<span className="choice__label">✦ Étincelle d’aube : touche à coup sûr{def.enemy.brume ? ', 2 cœurs contre la brume' : ''}</span>
						<span className="choice__tag">Sans dé · une fois par repos</span>
					</button>
				) : null}
				{def.talk ? (
					<button type="button" className="choice choice--alt" disabled={busy} onClick={props.onTalk}>
						<span className="choice__label">💬 {def.talk.label}</span>
						<span className="choice__tag">
							{STAT_LABEL[def.talk.stat]} {actor.stats[def.talk.stat]} : {need(actor.stats[def.talk.stat], DIFFICULTY[def.talk.difficulty].target)}
						</span>
					</button>
				) : null}
				{def.flee ? (
					<button type="button" className="choice choice--alt" disabled={busy} onClick={props.onFlee}>
						<span className="choice__label">🏃 {def.flee.label}</span>
						<span className="choice__tag">
							{STAT_LABEL[def.flee.stat]} {actor.stats[def.flee.stat]} : {need(actor.stats[def.flee.stat], DIFFICULTY[def.flee.difficulty].target)}
						</span>
					</button>
				) : null}
			</div>

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
					</div>
				</div>
			) : null}

			{beat?.kind === 'claw' ? (
				<div className="claw" style={{ '--beat': `${beat.ms}ms` } as React.CSSProperties} role="status" aria-live="assertive">
					<p className="claw__text">
						{beat.turn.attack}
						{clawTarget ? (
							<strong>
								{' '}
								{clawTarget.name} perd {beat.turn.amount} PV !
							</strong>
						) : null}
					</p>
				</div>
			) : null}
		</section>
	);
}
