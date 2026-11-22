'use client';

import { useState, useTransition } from 'react';
import { createAdventureAction } from '@/app/actions/game';
import { ABILITIES, CLASSES, CLASS_LIST, STATS, classPortrait, className, makeCharacter, statFromDie } from '@/engine/rules';
import type { Character, ClassId, StatKey, Stats, Gender } from '@/engine/types';
import { newId } from '@/lib/ids';
import type { MediaMap } from '@/lib/media-types';
import { CharacterSheet } from './CharacterSheet';
import { Die, rollWithSuspense } from './Die';
import { MediaView } from './MediaView';

interface Props {
	campaignId: string;
	campaignTitle: string;
	existing: Character[];
	media: MediaMap;
}

type Step = 'qui' | 'classe' | 'des' | 'resume';

interface Draft {
	player: string;
	gender: Gender | null;
	name: string;
	classId: ClassId | null;
	rolls: (number | null)[];
	swap: [StatKey, StatKey] | null;
}

const EMPTY: Draft = { player: '', gender: null, name: '', classId: null, rolls: [null, null, null, null], swap: null };
const MAX = 6;

const NAME_IDEAS = ['Arwel', 'Brune', 'Cassian', 'Doria', 'Elouan', 'Fenna', 'Gwen', 'Hugo le Hardi', 'Isaure', 'Jorik', 'Lune', 'Maël', 'Nell', 'Oriane', 'Perrin', 'Sacha', 'Tanaïs', 'Ysolde'];

function baseFromDraft(d: Draft): Stats | null {
	if (d.rolls.some((r) => r === null)) return null;
	const base = Object.fromEntries(STATS.map((s, i) => [s.key, statFromDie(d.rolls[i] as number)])) as Stats;
	if (d.swap) {
		const [a, b] = d.swap;
		[base[a], base[b]] = [base[b], base[a]];
	}
	return base;
}

function draftToCharacter(d: Draft): Character | null {
	const base = baseFromDraft(d);
	if (!base || !d.classId) return null;
	return makeCharacter({ id: newId('tmp'), name: d.name, player: d.player, gender: d.gender ?? undefined, classId: d.classId, base, rolls: d.rolls as number[] });
}

/** Création du groupe : héros existants à reprendre + nouveaux héros tirés aux dés. */
export function PartyCreator({ campaignId, campaignTitle, existing, media }: Props) {
	const [heroes, setHeroes] = useState<Character[]>([]);
	const [reuse, setReuse] = useState<string[]>([]);
	const [draft, setDraft] = useState<Draft | null>(existing.length ? null : { ...EMPTY });
	const [step, setStep] = useState<Step>('qui');
	const [rolling, setRolling] = useState<number | null>(null);
	const [realDice, setRealDice] = useState(false);
	const [swapPick, setSwapPick] = useState<StatKey | null>(null);
	const [name, setName] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	const total = heroes.length + reuse.length;
	const preview = draft ? draftToCharacter(draft) : null;

	const startDraft = () => {
		setDraft({ ...EMPTY });
		setStep('qui');
		setSwapPick(null);
	};

	const rollStat = (i: number) => {
		if (!draft) return;
		setRolling(i);
		rollWithSuspense((v) => {
			setDraft((d) => (d ? { ...d, rolls: d.rolls.map((r, j) => (j === i ? v : r)) } : d));
			setRolling(null);
		}, 800);
	};

	const setRoll = (i: number, v: number) => setDraft((d) => (d ? { ...d, rolls: d.rolls.map((r, j) => (j === i ? v : r)) } : d));

	const pickSwap = (key: StatKey) => {
		if (!draft || draft.swap) return;
		if (!swapPick) setSwapPick(key);
		else if (swapPick === key) setSwapPick(null);
		else {
			setDraft({ ...draft, swap: [swapPick, key] });
			setSwapPick(null);
		}
	};

	const validateHero = () => {
		if (!preview) return;
		setHeroes((h) => [...h, preview]);
		setDraft(null);
	};

	const launch = () => {
		setError(null);
		startTransition(async () => {
			const res = await createAdventureAction({ campaignId, name, newHeroes: heroes, reuseIds: reuse });
			if (res?.error) setError(res.error);
		});
	};

	return (
		<div className="creator">
			{/* ---------- Héros déjà existants ---------- */}
			{existing.length ? (
				<section className="card creator__block">
					<h2>Reprendre des héros</h2>
					<p>Vos héros gardent leur niveau et leur expérience d’une campagne à l’autre.</p>
					<ul className="creator__reuse">
						{existing.map((c) => {
							const on = reuse.includes(c.id);
							return (
								<li key={c.id}>
									<label className={`creator__reuse-item${on ? ' is-on' : ''}`}>
										<input
											type="checkbox"
											checked={on}
											disabled={!on && total >= MAX}
											onChange={() => setReuse((r) => (on ? r.filter((x) => x !== c.id) : [...r, c.id]))}
										/>
										<MediaView className="creator__mini" media={media} image={classPortrait(c)} alt="" />
										<span>
											<strong>{c.name}</strong>
											<small>
												{className(c)} · {c.player || '—'} · {c.xp} XP
											</small>
										</span>
									</label>
								</li>
							);
						})}
					</ul>
				</section>
			) : null}

			{/* ---------- Nouveaux héros validés ---------- */}
			{heroes.length ? (
				<section className="creator__done">
					{heroes.map((h, i) => (
						<div key={h.id} className="creator__done-item">
							<CharacterSheet character={h} media={media} />
							<button type="button" className="btn btn--small btn--danger" onClick={() => setHeroes((all) => all.filter((_, j) => j !== i))}>
								Retirer {h.name}
							</button>
						</div>
					))}
				</section>
			) : null}

			{/* ---------- Assistant de création ---------- */}
			{draft ? (
				<section className="card creator__block creator__wizard" aria-labelledby="wizard-title">
					<ol className="creator__steps" aria-label="Étapes">
						{(['qui', 'classe', 'des', 'resume'] as Step[]).map((s, i) => (
							<li key={s} className={s === step ? 'is-current' : ''}>
								{i + 1}. {{ qui: 'Qui joue ?', classe: 'Classe', des: 'Les dés', resume: 'Résumé' }[s]}
							</li>
						))}
					</ol>

					{step === 'qui' ? (
						<>
							<h2 id="wizard-title">Nouveau héros</h2>
							<div className="field">
								<label className="field__label" htmlFor="player">
									Prénom du joueur ou de la joueuse
								</label>
								<input id="player" className="field__input" value={draft.player} onChange={(e) => setDraft({ ...draft, player: e.target.value })} placeholder="Léo, Maman, Papa…" />
							</div>
							<fieldset className="field creator__gender">
								<legend className="field__label">Une héroïne ou un héros ?</legend>
								<div className="creator__gender-options">
									{(
										[
											['f', 'Une héroïne'],
											['m', 'Un héros'],
										] as [Gender, string][]
									).map(([g, label]) => (
										<label key={g} className={`creator__gender-option${draft.gender === g ? ' is-on' : ''}`}>
											<input type="radio" name="gender" value={g} checked={draft.gender === g} onChange={() => setDraft({ ...draft, gender: g })} />
											{label}
										</label>
									))}
								</div>
							</fieldset>
							<div className="field">
								<label className="field__label" htmlFor="heroname">
									Nom du personnage
								</label>
								<input id="heroname" className="field__input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Comment s’appelle ton personnage ?" />
								<button
									type="button"
									className="btn btn--small btn--ghost creator__idea"
									onClick={() => setDraft({ ...draft, name: NAME_IDEAS[Math.floor(Math.random() * NAME_IDEAS.length)] })}
								>
									💡 Une idée de nom
								</button>
							</div>
							<div className="creator__nav">
								<button type="button" className="btn" disabled={!draft.name.trim() || !draft.gender} onClick={() => setStep('classe')}>
									Choisir la classe →
								</button>
							</div>
						</>
					) : null}

					{step === 'classe' ? (
						<>
							<h2 id="wizard-title">Quel genre d’aventurier est {draft.name} ?</h2>
							<div className="classes">
								{CLASS_LIST.map((c) => (
									<button
										key={c.id}
										type="button"
										className={`class-card${draft.classId === c.id ? ' is-on' : ''}`}
										aria-pressed={draft.classId === c.id}
										onClick={() => setDraft({ ...draft, classId: c.id })}
									>
										<MediaView
											className="class-card__img"
											media={media}
											image={classPortrait({ classId: c.id, gender: draft.gender ?? undefined })}
											alt=""
											placeholder={className({ classId: c.id, gender: draft.gender ?? undefined })}
										/>
										<span className="class-card__name">{className({ classId: c.id, gender: draft.gender ?? undefined })}</span>
										<span className="class-card__tag">{c.tagline}</span>
										<span className="class-card__stat">
											{Object.entries(c.bonus)
												.map(([k, v]) => `+${v} ${STATS.find((s) => s.key === k)?.label}`)
												.join(' · ')}
											{c.pvBonus ? ` · +${c.pvBonus} PV` : ''}
										</span>
										<span className="class-card__power">
											<strong>En combat :</strong> {c.abilities.map((id) => `${ABILITIES[id].icon} ${ABILITIES[id].name}`).join(' · ')}
										</span>
									</button>
								))}
							</div>
							<div className="creator__nav">
								<button type="button" className="btn btn--ghost" onClick={() => setStep('qui')}>
									← Retour
								</button>
								<button type="button" className="btn" disabled={!draft.classId} onClick={() => setStep('des')}>
									Lancer les dés →
								</button>
							</div>
						</>
					) : null}

					{step === 'des' ? (
						<>
							<h2 id="wizard-title">Les dés de {draft.name}</h2>
							<p>
								Lance un dé pour chaque caractéristique. Plus c’est haut, plus ton héros est doué. Un 1 compte comme un 2 : personne n’est nul en rien !
							</p>
							<label className="settings__check">
								<input type="checkbox" checked={realDice} onChange={(e) => setRealDice(e.target.checked)} />
								<span>On lance un vrai dé</span>
							</label>
							<ul className="stat-rolls">
								{STATS.map((s, i) => {
									const v = draft.rolls[i];
									return (
										<li key={s.key} className="stat-rolls__row">
											<div className="stat-rolls__label">
												<strong>{s.label}</strong>
												<small>{s.hint}</small>
											</div>
											<Die value={v} rolling={rolling === i} size={56} />
											{v === null ? (
												realDice ? (
													<div className="stat-rolls__faces">
														{[1, 2, 3, 4, 5, 6].map((n) => (
															<button key={n} type="button" className="btn btn--small btn--ghost" onClick={() => setRoll(i, n)}>
																{n}
															</button>
														))}
													</div>
												) : (
													<button type="button" className="btn btn--small" disabled={rolling !== null} onClick={() => rollStat(i)}>
														🎲 Lancer
													</button>
												)
											) : (
												<span className="stat-rolls__value">= {statFromDie(v)}</span>
											)}
										</li>
									);
								})}
							</ul>
							<div className="creator__nav">
								<button type="button" className="btn btn--ghost" onClick={() => setStep('classe')}>
									← Retour
								</button>
								<button type="button" className="btn" disabled={draft.rolls.some((r) => r === null)} onClick={() => setStep('resume')}>
									Voir la fiche →
								</button>
							</div>
						</>
					) : null}

					{step === 'resume' && preview ? (
						<>
							<h2 id="wizard-title">Voici {preview.name} !</h2>
							{!draft.swap ? (
								<div className="swap">
									<p>
										Tu peux <strong>échanger deux caractéristiques</strong>, une seule fois. Touche la première, puis la seconde.
									</p>
									<div className="swap__stats">
										{STATS.map((s) => (
											<button key={s.key} type="button" className={`swap__stat${swapPick === s.key ? ' is-on' : ''}`} onClick={() => pickSwap(s.key)}>
												{s.label} <strong>{baseFromDraft(draft)?.[s.key]}</strong>
												{s.key === CLASSES[preview.classId].stat ? <small> (+1 de classe)</small> : null}
											</button>
										))}
									</div>
								</div>
							) : (
								<p className="form-success">
									Échange fait : {STATS.find((s) => s.key === draft.swap?.[0])?.label} ⇄ {STATS.find((s) => s.key === draft.swap?.[1])?.label}.{' '}
									<button type="button" className="btn btn--small btn--ghost" onClick={() => setDraft({ ...draft, swap: null })}>
										Annuler l’échange
									</button>
								</p>
							)}
							<CharacterSheet character={preview} media={media} />
							<div className="creator__nav">
								<button type="button" className="btn btn--ghost" onClick={() => setStep('des')}>
									← Retour
								</button>
								<button type="button" className="btn" onClick={validateHero}>
									✔ Valider {preview.name}
								</button>
							</div>
						</>
					) : null}

					{heroes.length || existing.length ? (
						<button type="button" className="roll__cancel" onClick={() => setDraft(null)}>
							Annuler ce héros
						</button>
					) : null}
				</section>
			) : total < MAX ? (
				<button type="button" className="btn btn--ghost creator__add" onClick={startDraft}>
					＋ Créer un nouveau héros
				</button>
			) : null}

			{/* ---------- Départ ---------- */}
			{!draft && total > 0 ? (
				<section className="card creator__block">
					<h2>Prêts à partir ?</h2>
					<p>
						{total} héros dans le groupe. Donnez un nom à cette aventure pour la retrouver sur le portail.
					</p>
					<div className="field">
						<label className="field__label" htmlFor="advname">
							Nom de l’aventure
						</label>
						<input id="advname" className="field__input" value={name} onChange={(e) => setName(e.target.value)} placeholder={`${campaignTitle} — la famille au complet`} />
					</div>
					{error ? <p className="form-error">{error}</p> : null}
					<button type="button" className="btn" disabled={isPending} onClick={launch}>
						{isPending ? 'Préparation…' : '⚔ Partir à l’aventure'}
					</button>
				</section>
			) : null}
		</div>
	);
}
