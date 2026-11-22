'use client';

import { useEffect, useRef, useState } from 'react';
import { DIFFICULTY, STAT_LABEL, className, evaluateRoll, type RollResult } from '@/engine/rules';
import type { Character, Difficulty, StatKey } from '@/engine/types';
import { Die, rollWithSuspense } from './Die';

export interface RollRequest {
	title: string;
	stat: StatKey;
	difficulty: Difficulty;
	/** Héros imposé (combat) ; sinon on demande « Qui tente ? ». */
	heroId?: string;
	/** Le mage peut réussir sans lancer (Étincelle d'aube) : géré par l'appelant. */
	cancellable: boolean;
}

interface Props {
	request: RollRequest;
	party: Character[];
	realDice: boolean;
	onSfx: (id: string) => void;
	onResolve: (heroId: string, roll: RollResult, rerollBy?: string) => void;
	onCancel: () => void;
}

type Phase = 'who' | 'roll' | 'rolling' | 'result';

/** Ce qu'un héros doit faire au dé pour réussir (un 6 réussit toujours). */
function needOnDie(stat: number, target: number): { min: number; text: string } {
	const min = target - stat;
	if (min <= 1) return { min: 1, text: 'réussite assurée, quel que soit le dé' };
	if (min > 6) return { min: 6, text: 'seul un 6 peut réussir' };
	if (min === 6) return { min: 6, text: 'il faut faire 6' };
	return { min, text: `il faut faire ${min} ou plus au dé` };
}

/** Fenêtre de test : qui tente → lancer → résultat (avec seconde chance du rôdeur). */
export function RollDialog({ request, party, realDice, onSfx, onResolve, onCancel }: Props) {
	const [heroId, setHeroId] = useState<string | null>(request.heroId ?? null);
	const [phase, setPhase] = useState<Phase>(request.heroId ? 'roll' : 'who');
	const [roll, setRoll] = useState<RollResult | null>(null);
	const [rerollBy, setRerollBy] = useState<string | undefined>();
	const dialogRef = useRef<HTMLDivElement>(null);

	const hero = party.find((c) => c.id === heroId) ?? null;
	const target = DIFFICULTY[request.difficulty];
	const candidates = party.filter((c) => c.pv > 0);
	const rangers = party.filter((c) => c.classId === 'rodeur' && c.powerReady && c.id !== rerollBy);

	useEffect(() => {
		dialogRef.current?.querySelector<HTMLElement>('button')?.focus();
	}, [phase]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && request.cancellable && (phase === 'who' || phase === 'roll')) onCancel();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [phase, request.cancellable, onCancel]);

	const apply = (die: number) => {
		if (!hero) return;
		setRoll(evaluateRoll(die, hero.stats[request.stat], request.difficulty));
		setPhase('result');
	};

	const launch = () => {
		onSfx('sfx-de');
		setPhase('rolling');
		rollWithSuspense(apply);
	};

	const secondChance = (rangerId: string) => {
		setRerollBy(rangerId);
		setRoll(null);
		setPhase('roll');
	};

	return (
		<div className="overlay" role="presentation">
			<div className="roll" role="dialog" aria-modal="true" aria-labelledby="roll-title" ref={dialogRef}>
				<p className="roll__eyebrow">
					Test de {STAT_LABEL[request.stat]} · {target.label}
				</p>
				<h2 id="roll-title" className="roll__title">
					{request.title}
				</h2>
				<p className="roll__rule">
					On lance un dé et on ajoute le score de <strong>{STAT_LABEL[request.stat]}</strong> du héros. Pour réussir, il faut un total de{' '}
					<strong>{target.target} ou plus</strong>. Un 6 au dé réussit toujours !
				</p>

				{phase === 'who' ? (
					<>
						<p className="roll__help">Qui tente sa chance ? Choisissez le héros le plus doué en {STAT_LABEL[request.stat]} !</p>
						<ul className="roll__heroes">
							{candidates.map((c) => (
								<li key={c.id}>
									<button
										type="button"
										className={`roll__hero${c.stats[request.stat] === Math.max(...candidates.map((x) => x.stats[request.stat])) ? ' roll__hero--best' : ''}`}
										onClick={() => {
											setHeroId(c.id);
											setPhase('roll');
										}}
									>
										<span className="roll__hero-name">{c.name}</span>
										<span className="roll__hero-player">{c.player || className(c)}</span>
										<span className="roll__hero-stat">
											{STAT_LABEL[request.stat]} <strong>{c.stats[request.stat]}</strong>
										</span>
										<span className="roll__hero-need">{needOnDie(c.stats[request.stat], target.target).text}</span>
									</button>
								</li>
							))}
						</ul>
					</>
				) : null}

				{hero && phase !== 'who' ? (
					<div className="roll__stage">
						<p className="roll__who">
							{rerollBy ? 'Seconde chance pour ' : ''}
							<strong>{hero.name}</strong>
							{hero.player ? ` (${hero.player})` : ''} lance le dé
						</p>
						{phase !== 'result' ? (
							<p className="roll__need">
								{STAT_LABEL[request.stat]} {hero.stats[request.stat]} : {needOnDie(hero.stats[request.stat], target.target).text}.
							</p>
						) : null}
						<div className="roll__math">
							<Die
								value={roll?.die ?? null}
								rolling={phase === 'rolling'}
								tone={roll ? (roll.success ? 'good' : 'bad') : 'neutral'}
							/>
							<span className="roll__op">+</span>
							<span className="roll__num" title={STAT_LABEL[request.stat]}>
								{hero.stats[request.stat]}
								<small>{STAT_LABEL[request.stat]}</small>
							</span>
							<span className="roll__op">=</span>
							<span className={`roll__num roll__num--total${roll ? (roll.success ? ' is-good' : ' is-bad') : ''}`}>
								{roll ? roll.total : '?'}
								<small>il faut {target.target}</small>
							</span>
						</div>

						{phase === 'roll' && !realDice ? (
							<button type="button" className="btn roll__cta" onClick={launch}>
								🎲 Lancer le dé
							</button>
						) : null}

						{phase === 'roll' && realDice ? (
							<div className="roll__real">
								<p>Lancez votre vrai dé, puis touchez le résultat :</p>
								<div className="roll__faces">
									{[1, 2, 3, 4, 5, 6].map((n) => (
										<button key={n} type="button" className="roll__face" onClick={() => apply(n)} aria-label={`J’ai fait ${n}`}>
											<Die value={n} size={52} />
										</button>
									))}
								</div>
							</div>
						) : null}

						{phase === 'result' && roll ? (
							<div className={`roll__verdict${roll.success ? ' is-good' : ' is-bad'}`} role="status">
								<strong>
									{roll.lucky ? 'Coup de chance ! Un 6 réussit toujours !' : roll.success ? 'Réussite !' : 'Raté…'}
								</strong>
								{!roll.lucky ? (
									<span>
										{roll.die} + {roll.stat} = {roll.total}, {roll.success ? 'c’est au moins' : 'c’est moins que'} {roll.target}.
									</span>
								) : null}
							</div>
						) : null}

						{phase === 'result' && roll ? (
							<div className="roll__actions">
								{!roll.success && rangers.length
									? rangers.map((r) => (
											<button key={r.id} type="button" className="btn btn--ghost" onClick={() => secondChance(r.id)}>
												🏹 Seconde chance ({r.name})
											</button>
										))
									: null}
								<button type="button" className="btn" onClick={() => hero && onResolve(hero.id, roll, rerollBy)}>
									Continuer
								</button>
							</div>
						) : null}
					</div>
				) : null}

				{request.cancellable && (phase === 'who' || phase === 'roll') ? (
					<button type="button" className="roll__cancel" onClick={onCancel}>
						Finalement, on fait autre chose
					</button>
				) : null}
			</div>
		</div>
	);
}
