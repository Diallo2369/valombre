'use client';

import { useEffect, useRef, useState } from 'react';
import { availableAbilities } from '@/engine/engine';
import { DIFFICULTY, STAT_LABEL, classWithArticle, className, type AbilityId } from '@/engine/rules';
import type { Character, CombatDef, CombatState, GameEvent } from '@/engine/types';
import type { MediaMap } from '@/lib/media-types';
import { MediaView } from './MediaView';

type Hit = Extract<GameEvent, { kind: 'hit' }>;
type EnemyTurn = Extract<GameEvent, { kind: 'enemy-turn' }>;
type Initiative = Extract<GameEvent, { kind: 'initiative' }>;
type Support = Extract<GameEvent, { kind: 'support' }>;

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
	onAbility: (id: AbilityId) => void;
	onTalk: () => void;
	onFlee: () => void;
}

type Beat =
	| { kind: 'wait'; ms: number }
	| { kind: 'banner'; title: string; subtitle?: string; lines?: string[]; tone: 'start' | 'hero' | 'foe'; ms: number }
	| { kind: 'enemy'; turn: EnemyTurn; ms: number };

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
 * Le combat au tour par tour, dans l'ordre de l'initiative :
 * la frise des tours en haut, la carte du monstre, les héros en dessous ;
 * un bandeau surgit à chaque tour (fond flouté), le monstre agit à sa place dans la file.
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
	const support = events.find((e): e is Support => e.kind === 'support');
	const nameOf = (id: string) => (id === 'enemy' ? def.enemy.name : party.find((c) => c.id === id)?.name ?? '');

	// À chaque étape : on compose la séquence (ouverture, coup du héros, tour du monstre, tour suivant) et on la joue.
	useEffect(() => {
		timers.current.forEach(clearTimeout);
		timers.current = [];
		const initiative = events.find((e): e is Initiative => e.kind === 'initiative');
		const enemyTurn = events.find((e): e is EnemyTurn => e.kind === 'enemy-turn');
		const nextTurn = events.find((e) => e.kind === 'turn');
		const acted = events.some((e) => e.kind === 'miss' || e.kind === 'support' || (e.kind === 'hit' && e.target === 'enemy'));
		const nextHero = party[combat.actor];
		const heroBanner = (): Beat => ({
			kind: 'banner',
			title: `Au tour de ${nextHero.name} !`,
			subtitle: `${nextHero.player ? `${nextHero.player} joue · ` : ''}${className(nextHero)}`,
			tone: 'hero',
			ms: 2200,
		});

		const beats: Beat[] = [];
		if (initiative) {
			beats.push({ kind: 'banner', title: 'Combat !', subtitle: def.enemy.name, tone: 'start', ms: 2400 });
			beats.push({
				kind: 'banner',
				title: 'Initiative',
				subtitle: 'Chacun lance un dé et ajoute son Agilité : le plus rapide commence.',
				lines: initiative.order.map((o, i) => `${i + 1}. ${o.name} : ${o.die} + ${o.bonus} = ${o.total}`),
				tone: 'start',
				ms: 4200,
			});
		} else if (acted) beats.push({ kind: 'wait', ms: 1800 });
		if (enemyTurn) {
			beats.push({ kind: 'banner', title: turnOf(enemyTurn.name), subtitle: enemyTurn.asleep ? 'Chut…' : 'Attention…', tone: 'foe', ms: 2200 });
			beats.push({ kind: 'enemy', turn: enemyTurn, ms: 3200 });
		}
		if ((nextTurn || initiative) && nextHero) beats.push(heroBanner());
		if (!enemyTurn) setShownParty(party);

		let t = 0;
		for (const b of beats) {
			timers.current.push(
				window.setTimeout(() => {
					setBeat(b.kind === 'wait' ? null : b);
					if (b.kind === 'enemy' && !b.turn.asleep) {
						onSfx('sfx-griffe');
						const url = voiceFor(b.turn.attack);
						if (url) {
							const a = new Audio(url);
							a.volume = voiceVolume;
							void a.play().catch(() => {});
						}
						// Les PV baissent au moment où l'attaque tombe.
						timers.current.push(
							window.setTimeout(() => {
								setShownParty(party);
								setHurtId(b.turn.heroId);
								if (b.turn.amount > 0) onSfx('sfx-blessure');
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
	const enemyBeat = beat?.kind === 'enemy' ? beat.turn : null;
	const order = combat.order ?? [];
	const abilities = availableAbilities(combat, actor);

	return (
		<section className={`fight card${enemyBeat && !enemyBeat.asleep ? ' is-shaking' : ''}`} aria-labelledby="fight-title" aria-busy={busy}>
			<h2 id="fight-title" className="fight__title">
				Combat
			</h2>

			{order.length ? (
				<ol className="fight__order" aria-label="Ordre de jeu (initiative)">
					{order.map((id, i) => {
						const down = id !== 'enemy' && (party.find((c) => c.id === id)?.pv ?? 0) === 0;
						return (
							<li
								key={id}
								className={`order-chip${id === 'enemy' ? ' order-chip--foe' : ''}${i === combat.turn && !busy ? ' is-current' : ''}${down ? ' is-out' : ''}`}
								aria-current={i === combat.turn ? 'step' : undefined}
							>
								<span className="order-chip__name">{nameOf(id)}</span>
								<span className="order-chip__score">{combat.initiative?.[id]?.total ?? ''}</span>
							</li>
						);
					})}
				</ol>
			) : null}

			<figure
				key={`foe-${seq}`}
				className={`foe-card${enemyHit ? ' is-hit' : ''}${enemyHit?.spell ? ' is-spell' : ''}${enemyBeat && !enemyBeat.asleep ? ' is-attacking' : ''}${combat.asleep ? ' is-asleep' : ''}`}
			>
				<MediaView className="foe-card__img" media={media} image={def.enemy.image} alt={def.enemy.name} placeholder={def.enemy.name} />
				<figcaption className="foe-card__body">
					<span className="foe-card__name">
						{def.enemy.name}
						{combat.asleep ? <span className="foe-card__state"> 💤 endormi</span> : null}
					</span>
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
				) : support?.what === 'sleep' ? (
					<span className="foe-card__burst foe-card__burst--sleep" aria-hidden="true">
						💤 Il s’endort…
					</span>
				) : null}
			</figure>

			<ul className="fight__party" aria-label="Le groupe">
				{shownParty.map((c) => {
					const healed = support?.what === 'heal';
					return (
						<li
							key={`${c.id}-${healed ? seq : 0}`}
							className={`fighter${c.id === actor.id && !busy ? ' is-turn' : ''}${hurtId === c.id ? ' is-hurt' : ''}${c.pv === 0 ? ' is-out' : ''}${healed ? ' is-healed' : ''}`}
						>
							<span className="fighter__name">
								{combat.guard === c.id ? <span title="Protège le groupe">🛡️ </span> : null}
								{c.name}
							</span>
							<span className="fighter__meta">
								{c.pv}/{c.pvMax} PV{c.pv === 0 ? ` · ${c.gender === 'm' ? 'épuisé' : c.gender === 'f' ? 'épuisée' : 'épuisé·e'}` : ''}
							</span>
							<span className="fighter__pv" aria-label={`${c.pv} PV sur ${c.pvMax}`}>
								<span className="fighter__bar" style={{ width: `${(c.pv / c.pvMax) * 100}%` }} />
							</span>
							{hurtId === c.id && enemyBeat && enemyBeat.amount > 0 ? (
								<span className="fighter__dmg" aria-hidden="true">
									−{enemyBeat.amount} PV
								</span>
							) : null}
							{healed ? (
								<span className="fighter__dmg fighter__dmg--heal" aria-hidden="true">
									+2 PV
								</span>
							) : null}
						</li>
					);
				})}
			</ul>

			{log.length ? (
				<ol className="fight__log" aria-label="Les derniers coups">
					{log.map((line, i) => (
						<li key={i} className={i === log.length - 1 ? 'is-last' : ''}>
							{line}
						</li>
					))}
				</ol>
			) : null}

			<p className="fight__turn" role="status">
				{busy ? '…' : (
					<>
						À <strong>{actor.name}</strong>
						{actor.player ? ` (${actor.player})` : ''}, {classWithArticle(actor)}, de jouer !
					</>
				)}
			</p>

			<div className="choices">
				{abilities.map((a) => (
					<button
						key={a.id}
						type="button"
						className={`choice${a.perCombat ? ' choice--power' : ''}${!a.stat && a.effect !== 'sure' ? ' choice--alt' : ''}`}
						disabled={busy}
						onClick={() => props.onAbility(a.id)}
					>
						<span className="choice__label">
							{a.icon} {a.name}
						</span>
						<span className="choice__desc">{a.text}</span>
						<span className="choice__tag">
							{a.stat ? `${STAT_LABEL[a.stat]} ${actor.stats[a.stat]} : ${need(actor.stats[a.stat], target)}` : 'Sans dé'}
							{a.perCombat ? ' · une fois par combat' : ''}
						</span>
					</button>
				))}
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

			{enemyBeat ? (
				<div className="claw" style={{ '--beat': `${beat?.ms ?? 3200}ms` } as React.CSSProperties} role="status" aria-live="assertive">
					<p className="claw__text">
						{enemyBeat.attack}
						{!enemyBeat.asleep ? (
							<strong>
								{' '}
								{enemyBeat.guarded ? `${nameOf(enemyBeat.heroId)} s’interpose : ` : `${nameOf(enemyBeat.heroId)} `}
								{enemyBeat.amount > 0 ? `perd ${enemyBeat.amount} PV !` : 'ne perd rien !'}
							</strong>
						) : null}
					</p>
				</div>
			) : null}
		</section>
	);
}
