'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { saveGameAction, saveNotesAction } from '@/app/actions/game';
import {
	activeHeroes,
	combatTurn,
	getScene,
	resolveCheck,
	takeChoice,
	bardSong,
	consumeItem,
	sceneChoices,
	visibleChoices,
	visibleLines,
} from '@/engine/engine';
import { ABILITIES, DIFFICULTY, STAT_LABEL, type AbilityId, type RollResult } from '@/engine/rules';
import type { Campaign, Game, GameEvent, StatKey, StepResult } from '@/engine/types';
import { AudioDirector } from '@/lib/audio';
import { mediaVariants, type MediaMap } from '@/lib/media-types';
import { DEFAULT_PREFS, loadPrefs, savePrefs, type Prefs } from '@/lib/prefs';
import { VoicePlayer, speechSupported, type PlayerState, type VoiceItem } from '@/lib/voice';
import { voiceHash, voiceIndex, voiceKey } from '@/engine/voices';
import { CharacterSheet } from './CharacterSheet';
import { BagContent, Drawer, JournalContent, SettingsContent } from './Drawers';
import { SoundMenu } from './SoundMenu';
import { STORY_START_EVENT } from './SiteMusic';
import { CombatPanel } from './CombatPanel';
import { LightLayer } from './LightLayer';
import { MediaView } from './MediaView';
import { PartyPanel } from './PartyPanel';
import { RollDialog, type RollRequest } from './RollDialog';

interface Props {
	adventureId: string;
	adventureName: string;
	campaign: Campaign;
	initial: Game;
	media: MediaMap;
	/** Répliques enregistrées : id de réplique → URL du fichier. */
	voices: MediaMap;
	/** Mode test (atelier) : rien n'est sauvegardé. */
	sandbox?: boolean;
}

interface Toast {
	id: number;
	text: string;
	tone: 'good' | 'bad' | 'info';
}

type PendingRoll =
	| { kind: 'check'; choiceIndex: number; request: RollRequest }
	| { kind: 'ability'; ability: AbilityId; request: RollRequest }
	| { kind: 'talk'; request: RollRequest }
	| { kind: 'flee'; request: RollRequest };

type Panel = null | 'journal' | 'sac' | 'reglages' | { sheet: string };


let toastSeq = 0;
/** Respiration entre l'arrivée dans une scène et la première réplique. */
const SETTLE_MS = 1200;
/** Temps de lecture d'une réplique sans enregistrement (pour la dévoiler à son tour). */
const readMs = (text: string) => Math.max(2200, text.length * 55);
const NO_LIGHTS: never[] = [];

export function GameScreen({ adventureId, adventureName, campaign, initial, media, voices, sandbox = false }: Props) {
	const [game, setGame] = useState<Game>(initial);
	const [narration, setNarration] = useState<{ who: string; text: string }[]>([]);
	const [toasts, setToasts] = useState<Toast[]>([]);
	const [pending, setPending] = useState<PendingRoll | null>(null);
	const [panel, setPanel] = useState<Panel>(null);
	const [started, setStarted] = useState(false);
	const [speaking, setSpeaking] = useState<number | null>(null);
	/**
	 * Jonctions entre scènes : le texte se dévoile réplique par réplique, au rythme de la voix ;
	 * `revealed` = nombre de répliques visibles. Les choix n'apparaissent qu'une fois tout dévoilé.
	 */
	const [revealed, setRevealed] = useState(Number.MAX_SAFE_INTEGER);
	/** Temps de respiration après l'arrivée dans une scène, avant que le conteur ne commence. */
	const [settling, setSettling] = useState(false);
	const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
	/** Événements de la dernière étape, pour mettre en scène le combat (coups, tour du monstre, tour suivant). */
	const [step, setStep] = useState<{ events: GameEvent[]; seq: number }>({ events: [], seq: 0 });
	const [save, setSave] = useState<'idle' | 'saving' | 'saved' | 'error' | 'stale'>('idle');
	const [playerState, setPlayerState] = useState<PlayerState>('idle');
	/** Répliques jamais entendues dans la scène actuelle ('all' : on vient d'ouvrir la partie, tout est lu). */
	const [fresh, setFresh] = useState<Set<string> | 'all'>('all');
	const audio = useRef<AudioDirector | null>(null);
	const player = useRef<VoicePlayer | null>(null);
	const voiceIds = useMemo(() => voiceIndex(campaign), [campaign]);
	const mainRef = useRef<HTMLElement>(null);

	const { state, party } = game;
	const scene = getScene(campaign, state.sceneId);
	const chapter = campaign.chapters.find((c) => c.n === scene.chapter);
	const combatDef = scene.combat;
	const combat = state.combat;
	const actor = combat ? party[combat.actor] : undefined;
	const spokes = party.length ? party[state.spokes % party.length] : undefined;

	const lines = useMemo(() => {
		const narr = narration.map((n) => ({ ...n, result: true }));
		return [...narr, ...visibleLines(game, scene).map((l) => ({ ...l, result: false }))];
	}, [narration, game, scene]);
	const choices = visibleChoices(campaign, game, scene);
	const ownChoices = choices.filter((c) => !c.around);
	const aroundChoices = choices.filter((c) => c.around);

	/** Ce que le lecteur va dire : les lignes affichées, puis le texte de fin s'il y en a un. */
	const voiceItems = useMemo<VoiceItem[]>(() => {
		const item = (who: string, text: string): VoiceItem => {
			const id = voiceIds.get(voiceKey(who, text));
			return { text, npc: campaign.npcs[who] ?? campaign.npcs.narrateur, url: id ? voices[id] : undefined };
		};
		const list = lines.map((l) => item(l.who, l.text));
		if (scene.ending) list.push(item('narrateur', scene.ending.text));
		return list;
	}, [lines, scene.ending, voiceIds, voices, campaign.npcs]);
	const voiceHashes = useMemo(
		() => [...lines.map((l) => voiceHash(l.who, l.text)), ...(scene.ending ? [voiceHash('narrateur', scene.ending.text)] : [])],
		[lines, scene.ending],
	);
	const isFresh = (i: number) => fresh === 'all' || fresh.has(voiceHashes[i]);

	/* ---------------- Préférences & audio ---------------- */
	useEffect(() => {
		setPrefs(loadPrefs());
		audio.current = new AudioDirector();
		player.current = new VoicePlayer({
			onLine: (i) => {
				setSpeaking(i);
				if (i !== null) setRevealed((r) => Math.max(r, i + 1));
			},
			onState: (s) => {
				setPlayerState(s);
			},
		});
		return () => {
			audio.current?.stop();
			player.current?.stop();
		};
	}, []);

	useEffect(() => {
		audio.current?.configure(prefs.audio);
	}, [prefs.audio]);

	useEffect(() => {
		player.current?.configure(prefs.voice);
	}, [prefs.voice]);

	const updatePrefs = (p: Prefs) => {
		setPrefs(p);
		savePrefs(p);
	};

	const playSfx = useCallback((id: string) => audio.current?.sfx(media[id] ?? null), [media]);

	/* ---------------- Lecture de la scène ---------------- */
	const speakScene = useCallback(
		(from = 0, only?: Set<number>) => {
			player.current?.configure(prefs.voice);
			player.current?.play(voiceItems, from, only);
		},
		[voiceItems, prefs.voice],
	);
	const canSpeak = voiceItems.some(
		(v) => (v.npc.id === 'narrateur' ? prefs.voice.narrator : prefs.voice.npc) && (v.url || (prefs.voice.browserFallback && speechSupported())),
	);

	useEffect(() => {
		if (!started) return;
		// Musique : un épisode sans musique (ou dont le morceau n'existe pas encore) la fait s'éteindre en fondu.
		// Ambiance : toujours présente ; si le fichier manque, on garde celle qui tourne.
		const ambience = mediaVariants(media, scene.media?.ambience);
		audio.current?.scene(
			mediaVariants(media, scene.media?.music),
			ambience.length || !scene.media?.ambience ? ambience : null,
			// Moments forts : la musique démarre tout de suite.
			Boolean(scene.combat || scene.ending || scene.media?.musicNow),
		);
		// Lecture automatique des seules répliques nouvelles : ce qui a déjà été entendu reste affiché,
		// et le bouton « Relire » permet de le réécouter.
		const news = new Set(voiceItems.map((_, i) => i).filter(isFresh));
		// Ce qui a déjà été entendu en tête de scène s'affiche tout de suite ; le reste se dévoilera.
		let firstNew = 0;
		while (firstNew < lines.length && !isFresh(firstNew)) firstNew += 1;
		setRevealed(firstNew);
		mainRef.current?.focus();
		if (!news.size) return;
		// Un temps de respiration : l'image et l'ambiance s'installent avant la première phrase.
		setSettling(true);
		const t = window.setTimeout(() => {
			setSettling(false);
			speakScene(0, fresh === 'all' ? undefined : news);
		}, SETTLE_MS);
		return () => {
			window.clearTimeout(t);
			setSettling(false);
		};
		// On relit uniquement quand on change de scène (ou qu'on y revient).
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [started, state.turn]);

	// Répliques sans voix (ou voix coupée) : on les dévoile une à une, le temps de les lire.
	useEffect(() => {
		if (!started || settling || playerState !== 'idle' || revealed >= lines.length) return;
		const t = window.setTimeout(() => setRevealed((r) => r + 1), revealed === 0 ? 400 : readMs(lines[revealed - 1]?.text ?? ''));
		return () => window.clearTimeout(t);
	}, [started, settling, playerState, revealed, lines]);
	const allRevealed = revealed >= lines.length;
	const showAll = () => {
		player.current?.stop();
		setSettling(false);
		setRevealed(Number.MAX_SAFE_INTEGER);
	};

	/* ---------------- Application d'une étape ---------------- */
	const pushToasts = (events: GameEvent[]) => {
		const fresh: Toast[] = [];
		for (const e of events) if (e.kind === 'toast') fresh.push({ id: ++toastSeq, text: e.text, tone: e.tone });
		if (!fresh.length) return;
		setToasts((t) => [...t, ...fresh].slice(-5));
		for (const t of fresh) window.setTimeout(() => setToasts((all) => all.filter((x) => x.id !== t.id)), 5000);
	};

	const apply = (result: StepResult) => {
		player.current?.stop();
		const changedScene = result.state.turn !== game.state.turn;
		setGame({ state: result.state, party: result.party });
		if (changedScene) {
			setNarration(
				result.events.flatMap((e) => (e.kind === 'narration' ? [{ who: e.who ?? 'narrateur', text: e.text }] : [])),
			);
			setFresh(new Set(result.fresh ?? []));
		}
		pushToasts(result.events);
		setStep((st) => ({ events: result.events, seq: st.seq + 1 }));
		for (const e of result.events) if (e.kind === 'sfx') playSfx(e.id);
		if (sandbox) return;
		setSave('saving');
		saveGameAction(adventureId, result.state, result.party)
			.then((r) => setSave(r.ok ? 'saved' : 'stale' in r && r.stale ? 'stale' : 'error'))
			.catch(() => setSave('error'));
	};

	/* ---------------- Choix ---------------- */
	const choose = (index: number) => {
		const choice = sceneChoices(campaign, scene)[index]?.choice;
		if (!choice) return;
		if (choice.check) {
			setPending({
				kind: 'check',
				choiceIndex: index,
				request: { title: choice.label, stat: choice.check.stat, difficulty: choice.check.difficulty, cancellable: true },
			});
			return;
		}
		apply(takeChoice(campaign, game, index));
	};

	const onResolve = (heroId: string, roll: RollResult, rerollBy?: string) => {
		const p = pending;
		setPending(null);
		if (!p) return;
		if (p.kind === 'check') apply(resolveCheck(campaign, game, p.choiceIndex, heroId, roll, rerollBy));
		else if (p.kind === 'ability') apply(combatTurn(campaign, game, { kind: 'ability', ability: p.ability, roll, rerollBy }));
		else if (p.kind === 'talk') apply(combatTurn(campaign, game, { kind: 'talk', roll, rerollBy }));
		else if (p.kind === 'flee') apply(combatTurn(campaign, game, { kind: 'flee', roll, rerollBy }));
	};

	/* ---------------- Combat ---------------- */
	/** Une action de combat : avec dé (fenêtre de lancer) ou sans (Intervention, Étincelle, Chant). */
	const useAbility = (id: AbilityId) => {
		if (!actor || !combatDef) return;
		const ab = ABILITIES[id];
		if (!ab.stat) {
			apply(combatTurn(campaign, game, { kind: 'ability', ability: id, roll: null }));
			return;
		}
		setPending({
			kind: 'ability',
			ability: id,
			request: { title: `${actor.name} : ${ab.name}`, stat: ab.stat, difficulty: combatDef.enemy.difficulty, heroId: actor.id, cancellable: true },
		});
	};

	/* ---------------- Raccourcis clavier (1 à 9) ---------------- */
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (!started || pending || panel) return;
			const t = e.target;
			if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;
			// Espace : pause / reprise de la lecture (sauf sur un bouton, où Espace sert à cliquer).
			if (e.key === ' ' && !(t instanceof HTMLButtonElement || t instanceof HTMLAnchorElement)) {
				if (playerState === 'idle') return;
				e.preventDefault();
				player.current?.toggle();
				return;
			}
			if (combat || !allRevealed) return;
			const n = Number(e.key);
			if (n >= 1 && n <= choices.length) choose(choices[n - 1].index);
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	const sheetHero = panel && typeof panel === 'object' ? party.find((c) => c.id === panel.sheet) : undefined;
	const stageImage = combat && combatDef?.enemy.image ? combatDef.enemy.image : scene.media?.image;

	/* ---------------- Rendu ---------------- */
	return (
		<div className="game">
			<header className="game__bar">
				<Link href={sandbox ? '/atelier/test' : '/portail'} className="game__back">
					{sandbox ? '← Tests' : '← Portail'}
				</Link>
				{sandbox ? <span className="game__sandbox">🧪 Mode test : rien n’est sauvegardé</span> : null}
				<div className="game__titles">
					<span className="game__campaign">{campaign.title}</span>
					<span className="game__chapter">
						{chapter ? `Chapitre ${chapter.n} · ${chapter.title}` : adventureName}
					</span>
				</div>
				<nav className="game__tools" aria-label="Outils de jeu">
					<button type="button" className="btn btn--small btn--ghost" onClick={() => { playSfx('sfx-page'); setPanel('journal'); }}>
						📜 Journal
					</button>
					<button type="button" className="btn btn--small btn--ghost" onClick={() => setPanel('sac')}>
						🎒 Sac
					</button>
					{sandbox ? null : (
						<Link className="btn btn--small btn--ghost" href={`/aventure/${adventureId}/fiches`} target="_blank">
							🖨 Fiches
						</Link>
					)}
					<SoundMenu prefs={prefs} onChange={updatePrefs} />
					<button type="button" className="btn btn--small btn--ghost" onClick={() => setPanel('reglages')} aria-label="Réglages">
						⚙︎
					</button>
				</nav>
			</header>

			<div className="game__layout">
				<main className="game__main" ref={mainRef} tabIndex={-1} aria-labelledby="scene-title">
					<div className="game__stage">
						<MediaView
							className="game__media"
							media={media}
							image={stageImage}
							video={combat ? undefined : scene.media?.video}
							alt={scene.title}
							placeholder={scene.title}
						/>
						<LightLayer key={stageImage} lights={(stageImage && campaign.lights?.[stageImage]) || NO_LIGHTS} />
						<h1 id="scene-title" className="game__scene-title">
							{scene.title}
						</h1>
					</div>

					<section className="story" aria-live="polite">
						{lines.map((l, i) => {
							const npc = campaign.npcs[l.who];
							const isNarr = l.who === 'narrateur';
							return (
								<div
									key={`${state.turn}-${i}`}
									className={['story__line', isNarr ? 'story__line--narr' : 'story__line--npc', l.result ? 'story__line--result' : '', speaking === i ? 'is-speaking' : '', isFresh(i) ? '' : 'is-heard']
										.filter(Boolean)
										.join(' ')}
									style={npc && !isNarr ? ({ '--npc': npc.color } as React.CSSProperties) : undefined}
								>
									{!isNarr && npc ? (
										<MediaView className="story__portrait" media={media} image={npc.portrait} alt="" />
									) : null}
									<div className="story__body">
										{!isNarr && npc ? <span className="story__who">{npc.name}</span> : null}
										<p className="story__text">{l.text}</p>
									</div>
									{voiceItems[i]?.url || (prefs.voice.browserFallback && speechSupported()) ? (
										<button
											type="button"
											className="story__replay"
											onClick={() => speakScene(i)}
											title="Relire à partir d’ici"
											aria-label={`Relire à partir de la réplique ${i + 1}`}
										>
											▶
										</button>
									) : null}
								</div>
							);
						})}
						<div className="story__tools" role="group" aria-label="Lecture à voix haute">
							{playerState === 'idle' ? (
								<button type="button" className="btn btn--small btn--ghost" onClick={() => speakScene()} disabled={!canSpeak}>
									🔊 {canSpeak ? 'Relire' : 'Pas encore de voix pour cette scène'}
								</button>
							) : (
								<>
									<button type="button" className="btn btn--small" onClick={() => player.current?.toggle()} aria-keyshortcuts="Space">
										{playerState === 'paused' ? '▶ Reprendre' : '⏸ Pause'}
									</button>
									<button type="button" className="btn btn--small btn--ghost" onClick={() => player.current?.next()}>
										⏭ Réplique suivante
									</button>
									<button type="button" className="btn btn--small btn--ghost" onClick={() => player.current?.stop()}>
										⏹ Arrêter
									</button>
									<span className="story__hint">Barre d’espace : pause</span>
								</>
							)}
						</div>
					</section>

					{/* Les choix (ou le combat, ou la fin) n'arrivent qu'une fois le récit dévoilé. */}
					{!allRevealed ? null : scene.ending ? (
						<section className="ending card">
							<h2>{scene.ending.title}</h2>
							<p>{scene.ending.text}</p>
							<Link className="btn" href="/portail">
								Retour au portail
							</Link>
						</section>
					) : combat && combatDef && actor ? (
						<CombatPanel
							def={combatDef}
							combat={combat}
							party={party}
							actor={actor}
							media={media}
							events={step.events}
							seq={step.seq}
							onSfx={playSfx}
							voiceFor={(text) => {
								const id = voiceIds.get(voiceKey('narrateur', text));
								return id ? voices[id] : undefined;
							}}
							voiceVolume={prefs.voice.npc || prefs.voice.narrator ? prefs.voice.volume : 0}
							log={state.log.filter((l) => l.kind === 'combat' && l.turn === state.turn).slice(-3).map((l) => l.text)}
							onAbility={useAbility}
							onTalk={() =>
								setPending({
									kind: 'talk',
									request: { title: combatDef.talk!.label, stat: combatDef.talk!.stat, difficulty: combatDef.talk!.difficulty, heroId: actor.id, cancellable: true },
								})
							}
							onFlee={() =>
								setPending({
									kind: 'flee',
									request: { title: combatDef.flee!.label, stat: combatDef.flee!.stat, difficulty: combatDef.flee!.difficulty, heroId: actor.id, cancellable: true },
								})
							}
						/>
					) : (
						<section className="decide" aria-labelledby="decide-title">
							<h2 id="decide-title" className="decide__title">
								{prefs.spokesperson && spokes && party.length > 1 ? (
									<>
										🗣 <strong>{spokes.player || spokes.name}</strong>, à toi de décider pour le groupe :
									</>
								) : (
									'Que faites-vous ?'
								)}
							</h2>
							{[ownChoices, aroundChoices].map((group, g) =>
								group.length ? (
									<div key={g} className="choices-group">
										{g === 1 && ownChoices.length ? <p className="choices-group__title">Ou bien, ailleurs :</p> : null}
										<div className="choices">
											{group.map(({ choice, index }) => {
												const n = choices.findIndex((c) => c.index === index);
												return (
													<button key={index} type="button" className={`choice${choice.label.startsWith('⭐') ? ' choice--main' : ''}`} onClick={() => choose(index)}>
														<span className="choice__key" aria-hidden="true">
															{n + 1}
														</span>
														<span className="choice__label">{choice.label}</span>
														{choice.check ? (
															<span className="choice__tag">
																🎲 {STAT_LABEL[choice.check.stat]} : il faut {DIFFICULTY[choice.check.difficulty].target} ou plus
															</span>
														) : null}
													</button>
												);
											})}
										</div>
									</div>
								) : null,
							)}
						</section>
					)}
				</main>

				<aside className="game__side" aria-label="Le groupe">
					<PartyPanel
						party={party}
						media={media}
						activeId={actor?.id}
						spokesId={prefs.spokesperson && !combat ? spokes?.id : undefined}
						onOpenSheet={(id) => setPanel({ sheet: id })}
						onBardSong={(id) => apply(bardSong(game, id))}
					/>
					<p className="game__gold">
						🪙 {state.gold} · 🎒 {Object.values(state.bag).reduce((a, b) => a + b, 0)} objet(s)
					</p>
					<p className={`game__save is-${save}`} role="status">
						{save === 'saving' ? 'Sauvegarde…' : save === 'saved' ? '✓ Partie sauvegardée' : save === 'error' ? '⚠ Sauvegarde impossible' : save === 'stale' ? '⚠ Cette aventure a été recommencée : rechargez la page.' : ''}
					</p>
					{activeHeroes(party).length < party.length ? (
						<p className="game__hint">Un héros épuisé ne peut plus agir en combat. Une potion, un chant ou un repos le remettra sur pied.</p>
					) : null}
				</aside>
			</div>

			<div className="toasts" aria-live="polite">
				{toasts.map((t) => (
					<div key={t.id} className={`toast toast--${t.tone}`}>
						{t.text}
					</div>
				))}
			</div>

			{pending ? (
				<RollDialog
					request={pending.request}
					party={party}
					realDice={prefs.realDice}
					onSfx={playSfx}
					onResolve={onResolve}
					onCancel={() => setPending(null)}
				/>
			) : null}

			{panel === 'journal' ? (
				<Drawer title="Journal de l’aventure" onClose={() => setPanel(null)}>
					<JournalContent campaign={campaign} state={state} />
				</Drawer>
			) : null}
			{panel === 'sac' ? (
				<Drawer title="Le sac du groupe" onClose={() => setPanel(null)}>
					<BagContent campaign={campaign} state={state} party={party} onUse={(itemId, target) => apply(consumeItem(campaign, game, itemId, target))} />
				</Drawer>
			) : null}
			{panel === 'reglages' ? (
				<Drawer title="Réglages" onClose={() => setPanel(null)}>
					<SettingsContent prefs={prefs} onChange={updatePrefs} speech={speechSupported()} />
				</Drawer>
			) : null}
			{sheetHero ? (
				<Drawer title={`Fiche de ${sheetHero.name}`} onClose={() => setPanel(null)}>
					<CharacterSheet character={sheetHero} media={media}>
						<NotesField
							key={sheetHero.id}
							initial={sheetHero.notes}
							onSave={(notes) => {
								setGame((g) => ({ ...g, party: g.party.map((c) => (c.id === sheetHero.id ? { ...c, notes } : c)) }));
								if (!sandbox) void saveNotesAction(adventureId, sheetHero.id, notes);
							}}
						/>
					</CharacterSheet>
				</Drawer>
			) : null}

			{!started ? (
				<div className="overlay">
					<div className="start card">
						<p className="start__eyebrow">{campaign.title}</p>
						<h2>{adventureName}</h2>
						<p>
							{chapter ? `Chapitre ${chapter.n} — ${chapter.title}. ` : ''}
							Installez-vous confortablement, montez le son, et que l’aventure commence.
						</p>
						<button
							type="button"
							className="btn"
							onClick={() => {
								audio.current?.resume();
								// Le thème du site s'efface : l'histoire commence.
								window.dispatchEvent(new Event(STORY_START_EVENT));
								setStarted(true);
							}}
						>
							{state.turn > 1 ? 'Reprendre l’aventure' : 'Commencer l’aventure'}
						</button>
					</div>
				</div>
			) : null}
		</div>
	);
}

function NotesField({ initial, onSave }: { initial: string; onSave: (v: string) => void }) {
	const [value, setValue] = useState(initial);
	return (
		<div className="field sheet__notes">
			<label className="field__label" htmlFor="notes">
				Notes du joueur
			</label>
			<textarea
				id="notes"
				className="field__input"
				rows={4}
				value={value}
				onChange={(e) => setValue(e.target.value)}
				onBlur={() => value !== initial && onSave(value)}
				placeholder="Ce que votre héros veut retenir, ses rêves, ses amis…"
			/>
		</div>
	);
}
