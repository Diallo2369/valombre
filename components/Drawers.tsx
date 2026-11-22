'use client';

import { useEffect, useRef, useState } from 'react';
import type { Campaign, Character, GameState } from '@/engine/types';
import type { Prefs } from '@/lib/prefs';

/* ------------------------------------------------------------------ */
/* Tiroir générique (dialogue latéral)                                 */
/* ------------------------------------------------------------------ */

export function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const previous = document.activeElement as HTMLElement | null;
		ref.current?.querySelector<HTMLElement>('button, [href], input, textarea, select')?.focus();
		const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
		window.addEventListener('keydown', onKey);
		return () => {
			window.removeEventListener('keydown', onKey);
			previous?.focus();
		};
	}, [onClose]);
	return (
		<div className="overlay overlay--side" onClick={(e) => e.target === e.currentTarget && onClose()} role="presentation">
			<div className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" ref={ref}>
				<header className="drawer__head">
					<h2 id="drawer-title">{title}</h2>
					<button type="button" className="btn btn--small btn--ghost" onClick={onClose}>
						Fermer
					</button>
				</header>
				<div className="drawer__body">{children}</div>
			</div>
		</div>
	);
}

/* ------------------------------------------------------------------ */
/* Journal : quêtes + chronique                                        */
/* ------------------------------------------------------------------ */

export function JournalContent({ campaign, state }: { campaign: Campaign; state: GameState }) {
	const quests = Object.entries(state.quests)
		.map(([id, status]) => ({ quest: campaign.quests[id], status }))
		.filter((q) => q.quest);
	const order = { active: 0, done: 1, failed: 2 } as const;
	quests.sort((a, b) => order[a.status] - order[b.status] || (a.quest.kind === 'principale' ? -1 : 1));
	const chapter = campaign.chapters.find((c) => c.n === campaign.scenes[state.sceneId]?.chapter);

	return (
		<>
			{chapter ? (
				<p className="journal__chapter">
					Chapitre {chapter.n} — {chapter.title}
				</p>
			) : null}
			<h3 className="journal__h">Quêtes</h3>
			{quests.length ? (
				<ul className="journal__quests">
					{quests.map(({ quest, status }) => (
						<li key={quest.id} className={`journal__quest is-${status}`}>
							<span className="journal__quest-title">
								{status === 'done' ? '✔ ' : status === 'failed' ? '✖ ' : '◆ '}
								{quest.title}
							</span>
							<span className={`badge${quest.kind === 'principale' ? ' badge--ember' : ' badge--wisp'}`}>{quest.kind}</span>
							<p>{quest.description}</p>
						</li>
					))}
				</ul>
			) : (
				<p>Aucune quête pour l’instant.</p>
			)}

			<h3 className="journal__h">Chronique</h3>
			<ol className="journal__log" reversed>
				{[...state.log]
					.reverse()
					.slice(0, 60)
					.map((e, i) => (
						<li key={i} className={`journal__entry is-${e.kind}`}>
							{e.text}
						</li>
					))}
			</ol>
		</>
	);
}

/* ------------------------------------------------------------------ */
/* Sac commun                                                          */
/* ------------------------------------------------------------------ */

export function BagContent({
	campaign,
	state,
	party,
	onUse,
}: {
	campaign: Campaign;
	state: GameState;
	party: Character[];
	onUse: (itemId: string, targetId?: string) => void;
}) {
	const [targeting, setTargeting] = useState<string | null>(null);
	const items = Object.entries(state.bag).filter(([, n]) => n > 0);
	return (
		<>
			<p className="bag__gold">🪙 {state.gold} pièces d’argent</p>
			{items.length ? (
				<ul className="bag">
					{items.map(([id, qty]) => {
						const item = campaign.items[id];
						if (!item) return null;
						return (
							<li key={id} className="bag__item">
								<div>
									<strong>
										{item.name}
										{qty > 1 ? ` ×${qty}` : ''}
									</strong>
									<p>{item.description}</p>
								</div>
								{item.use ? (
									targeting === id ? (
										<div className="bag__targets">
											<span>Pour qui ?</span>
											{party.map((c) => (
												<button
													key={c.id}
													type="button"
													className="btn btn--small"
													onClick={() => {
														onUse(id, c.id);
														setTargeting(null);
													}}
												>
													{c.name} ({c.pv}/{c.pvMax})
												</button>
											))}
											<button type="button" className="btn btn--small btn--ghost" onClick={() => setTargeting(null)}>
												Annuler
											</button>
										</div>
									) : (
										<button
											type="button"
											className="btn btn--small"
											onClick={() => (item.use?.target === 'all' ? onUse(id) : setTargeting(id))}
										>
											{item.use.label}
										</button>
									)
								) : null}
							</li>
						);
					})}
				</ul>
			) : (
				<p>Le sac est vide.</p>
			)}
		</>
	);
}

/* ------------------------------------------------------------------ */
/* Volumes : panneau « 🔊 Son » de la barre de jeu et tiroir Réglages   */
/* ------------------------------------------------------------------ */

export function VolumeControls({ prefs, onChange }: { prefs: Prefs; onChange: (p: Prefs) => void }) {
	const range = (id: string, label: string, value: number, set: (v: number) => void) => (
		<div className="volume__row">
			<label htmlFor={id}>{label}</label>
			<input
				id={id}
				type="range"
				min={0}
				max={1}
				step={0.05}
				value={value}
				disabled={prefs.audio.muted}
				aria-valuetext={`${Math.round(value * 100)} %`}
				onChange={(e) => set(Number(e.target.value))}
			/>
			<output htmlFor={id} className="volume__value">
				{Math.round(value * 100)} %
			</output>
		</div>
	);
	const audio = (patch: Partial<Prefs['audio']>) => onChange({ ...prefs, audio: { ...prefs.audio, ...patch } });
	return (
		<div className="volume">
			{range('vol-voix', 'Voix', prefs.voice.volume, (volume) => onChange({ ...prefs, voice: { ...prefs.voice, volume } }))}
			{range('vol-musique', 'Musique', prefs.audio.music, (music) => audio({ music }))}
			{range('vol-ambiance', 'Ambiance', prefs.audio.ambience, (ambience) => audio({ ambience }))}
			{range('vol-bruitages', 'Bruitages', prefs.audio.sfx, (sfx) => audio({ sfx }))}
			<label className="settings__check">
				<input type="checkbox" checked={prefs.audio.muted} onChange={(e) => audio({ muted: e.target.checked })} />
				<span>Couper la musique, l’ambiance et les bruitages</span>
			</label>
		</div>
	);
}

/* ------------------------------------------------------------------ */
/* Réglages (propres à cet appareil)                                   */
/* ------------------------------------------------------------------ */

export function SettingsContent({ prefs, onChange, speech }: { prefs: Prefs; onChange: (p: Prefs) => void; speech: boolean }) {
	const check = (label: string, value: boolean, set: (v: boolean) => void, hint?: string) => (
		<label className="settings__check">
			<input type="checkbox" checked={value} onChange={(e) => set(e.target.checked)} />
			<span>
				{label}
				{hint ? <small>{hint}</small> : null}
			</span>
		</label>
	);
	return (
		<div className="settings">
			<h3>Volumes</h3>
			<VolumeControls prefs={prefs} onChange={onChange} />

			<h3>Voix</h3>
			{check('Les personnages parlent', prefs.voice.npc, (npc) => onChange({ ...prefs, voice: { ...prefs.voice, npc } }))}
			{check('Le conteur lit la narration', prefs.voice.narrator, (narrator) => onChange({ ...prefs, voice: { ...prefs.voice, narrator } }))}
			<label className="settings__range">
				<span>Vitesse de lecture</span>
				<input
					type="range"
					min={0.7}
					max={1.3}
					step={0.05}
					value={prefs.voice.speed}
					onChange={(e) => onChange({ ...prefs, voice: { ...prefs.voice, speed: Number(e.target.value) } })}
				/>
			</label>
			{check(
				'Voix du navigateur pour ce qui n’est pas enregistré',
				prefs.voice.browserFallback && speech,
				(browserFallback) => onChange({ ...prefs, voice: { ...prefs.voice, browserFallback } }),
				speech
					? 'Voix de synthèse robotique, en dépannage. Sinon, les répliques pas encore enregistrées restent seulement écrites : un adulte peut les lire.'
					: 'Ce navigateur ne propose pas de synthèse vocale.',
			)}

			<h3>Table</h3>
			{check('On lance de vrais dés', prefs.realDice, (realDice) => onChange({ ...prefs, realDice }), 'Vous saisissez le résultat au lieu de lancer à l’écran.')}
			{check(
				'Faire tourner le porte-parole',
				prefs.spokesperson,
				(spokesperson) => onChange({ ...prefs, spokesperson }),
				'À chaque choix, un joueur différent décide pour le groupe.',
			)}
		</div>
	);
}
