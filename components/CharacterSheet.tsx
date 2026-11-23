'use client';

import { useId, useRef, useState } from 'react';
import { ABILITIES, CLASSES, STATS, STAT_LABEL, className, everyText, initiativeOf, levelFromXp } from '@/engine/rules';
import type { Character } from '@/engine/types';
import type { MediaMap } from '@/lib/media-types';
import { HeroPortrait } from './HeroPortrait';

interface Props {
	character: Character;
	media: MediaMap;
	/** Version imprimable (fond clair). */
	print?: boolean;
	/** À l'écran, dans le volet du jeu : en onglets. */
	tabs?: boolean;
	initialTab?: SheetTab;
	/** Les notes du joueur (dernier onglet). */
	children?: React.ReactNode;
}

export type SheetTab = 'carac' | 'competences' | 'equipement' | 'notes';

const TABS: { id: SheetTab; label: string }[] = [
	{ id: 'carac', label: 'Caractéristiques' },
	{ id: 'competences', label: 'Compétences' },
	{ id: 'equipement', label: 'Équipement' },
	{ id: 'notes', label: 'Notes' },
];

/**
 * Fiche de personnage, à l'écran ou à imprimer.
 * Avec `tabs` (le volet du jeu) : l'en-tête, puis des onglets (caractéristiques, compétences, équipement, notes).
 * Sans (impression, création) : tout à la suite ; les notes (`children`) en dernier.
 */
export function CharacterSheet({ character: c, media, print = false, tabs = false, initialTab = 'carac', children }: Props) {
	const cls = CLASSES[c.classId];
	const level = levelFromXp(c.xp);
	const nextLevelXp = level * 10;
	const [tab, setTab] = useState<SheetTab>(initialTab);
	const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
	const uid = useId();

	const head = (
		<header className="sheet__head">
			<HeroPortrait className="sheet__portrait" character={c} media={media} alt={`Portrait de ${c.name}`} />
			<div>
				<h3 className="sheet__name">{c.name}</h3>
				<p className="sheet__meta">
					{className(c)} · niveau {level}
					{c.player ? <> · joué par <strong>{c.player}</strong></> : null}
				</p>
				<p className="sheet__tagline">{cls.tagline}</p>
			</div>
		</header>
	);

	const carac = (
		<>
			<dl className="sheet__stats">
				{STATS.map((s) => (
					<div key={s.key} className={`sheet__stat${s.key === cls.stat ? ' sheet__stat--fav' : ''}`} title={s.hint}>
						<dt>{s.label}</dt>
						<dd>{c.stats[s.key]}</dd>
					</div>
				))}
			</dl>

			<div className="sheet__row">
				<div className="sheet__box">
					<h4>Points de vie</h4>
					<p className="sheet__big">
						{c.pv} <span>/ {c.pvMax}</span>
					</p>
				</div>
				<div className="sheet__box">
					<h4>Armure</h4>
					<p className="sheet__big">
						{cls.armor ? `🛡️ ${cls.armor}` : '—'} <span>{cls.armor ? 'prend les coups avant les PV' : 'aucune : il faut esquiver !'}</span>
					</p>
				</div>
				<div className="sheet__box">
					<h4>Initiative</h4>
					<p className="sheet__big">
						⚡ {initiativeOf(c)} <span>+ un dé · 👣 {cls.move} cases par tour</span>
					</p>
				</div>
				<div className="sheet__box">
					<h4>Expérience</h4>
					<p className="sheet__big">
						{c.xp} <span>/ {nextLevelXp} pour le niveau {level + 1}</span>
					</p>
				</div>
			</div>

			{c.rolls.length ? (
				<p className="sheet__small">
					Dés de création : {c.rolls.join(', ')} (un 1 compte comme 2, puis bonus de classe :{' '}
					{Object.entries(cls.bonus)
						.map(([k, v]) => `+${v} ${STAT_LABEL[k as keyof typeof STAT_LABEL]}`)
						.join(', ')}
					)
				</p>
			) : null}
		</>
	);

	const competences = (
		<>
			<div className="sheet__box">
				<h4>En combat</h4>
				<ul className="sheet__abilities">
					{cls.abilities.map((id) => {
						const a = ABILITIES[id];
						return (
							<li key={id}>
								<strong>
									{a.icon} {a.name}
								</strong>{' '}
								<span className="sheet__small">
									{a.passive ? (a.reaction ? '(réaction, pendant le tour des monstres)' : '(passif, toujours actif)') : a.stat ? `(${STAT_LABEL[a.stat]})` : '(sans dé)'}{' '}
									{a.every ? `· ${everyText(a)}` : ''}
								</span>
								<br />
								{a.text}
							</li>
						);
					})}
				</ul>
			</div>

			<div className="sheet__box">
				<h4>
					{cls.power.name}{' '}
					{c.classId === 'rodeur' || c.classId === 'barde' ? c.powerReady ? <span className="badge badge--moss">prêt</span> : <span className="badge">utilisé</span> : null}
				</h4>
				<p>{cls.power.text}</p>
			</div>
		</>
	);

	const equipement = (
		<div className="sheet__box">
			<h4>Équipement</h4>
			<ul className="sheet__kit">
				{c.kit.map((k) => (
					<li key={k}>{k}</li>
				))}
			</ul>
		</div>
	);

	if (!tabs)
		return (
			<article className={`sheet${print ? ' sheet--print' : ''}`}>
				{head}
				{carac}
				{competences}
				{equipement}
				{children}
			</article>
		);

	const shown = TABS.filter((t) => t.id !== 'notes' || children);
	// Onglets au clavier : flèches gauche/droite, Début, Fin (le motif « tabs » de l'ARIA).
	const onKey = (e: React.KeyboardEvent, i: number) => {
		const go = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? shown.length - 1 : null;
		if (go === null) return;
		e.preventDefault();
		const t = shown[(go + shown.length) % shown.length];
		setTab(t.id);
		tabRefs.current[t.id]?.focus();
	};
	return (
		<article className="sheet sheet--tabs">
			{head}
			<div className="sheet__tabs" role="tablist" aria-label={`Fiche de ${c.name}`}>
				{shown.map((t, i) => (
					<button
						key={t.id}
						ref={(el) => {
							tabRefs.current[t.id] = el;
						}}
						type="button"
						role="tab"
						id={`${uid}-tab-${t.id}`}
						aria-selected={tab === t.id}
						aria-controls={`${uid}-panel`}
						tabIndex={tab === t.id ? 0 : -1}
						className={`sheet__tab${tab === t.id ? ' is-active' : ''}`}
						onClick={() => setTab(t.id)}
						onKeyDown={(e) => onKey(e, i)}
					>
						{t.label}
					</button>
				))}
			</div>
			<div className="sheet__panel" role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-tab-${tab}`} tabIndex={0}>
				{tab === 'carac' ? carac : tab === 'competences' ? competences : tab === 'equipement' ? equipement : children}
			</div>
		</article>
	);
}
