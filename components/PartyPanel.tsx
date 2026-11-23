'use client';

import { CLASSES, levelFromXp } from '@/engine/rules';
import type { Character } from '@/engine/types';
import type { MediaMap } from '@/lib/media-types';
import { HeroPortrait } from './HeroPortrait';

interface Props {
	party: Character[];
	media: MediaMap;
	/** En combat : le héros qui joue. */
	activeId?: string;
	/** Le héros dont la fiche est ouverte à côté. */
	openId?: string;
	onOpenSheet: (id: string) => void;
	onBardSong: (id: string) => void;
}

/** Le groupe (dans le volet « Le groupe ») : PV, pouvoir ; toucher un héros ouvre sa fiche à côté. */
export function PartyPanel({ party, media, activeId, openId, onOpenSheet, onBardSong }: Props) {
	return (
		<ul className="party" aria-label="Le groupe">
			{party.map((c) => {
				const cls = CLASSES[c.classId];
				const ratio = c.pvMax ? c.pv / c.pvMax : 0;
				return (
					<li
						key={c.id}
						className={[
							'party__hero',
							c.pv === 0 ? 'is-down' : '',
							c.id === activeId ? 'is-active' : '',
							c.id === openId ? 'is-open' : '',
						]
							.filter(Boolean)
							.join(' ')}
					>
						<button
							type="button"
							className="party__main"
							onClick={() => onOpenSheet(c.id)}
							aria-expanded={c.id === openId}
							aria-label={`${c.id === openId ? 'Fermer la fiche de' : 'Ouvrir la fiche de'} ${c.name}`}
						>
							<HeroPortrait className="party__portrait" character={c} media={media} />
							<span className="party__text">
								<span className="party__name">{c.name}</span>
								<span className="party__sub">
									{c.player ? `${c.player} · ` : ''}
									{cls.name} niv. {levelFromXp(c.xp)}
								</span>
							</span>
							<span className="party__open" aria-hidden="true">
								Fiche <span className="party__chevron">›</span>
							</span>
						</button>
						<div className="party__pv" aria-label={`${c.pv} points de vie sur ${c.pvMax}`}>
							<span className="party__pv-bar" style={{ width: `${Math.round(ratio * 100)}%` }} />
							<span className="party__pv-text">
								{c.pv}/{c.pvMax} PV
								{c.pv === 0 ? ` · ${c.gender === 'm' ? 'épuisé' : c.gender === 'f' ? 'épuisée' : 'épuisé·e'}` : ''}
							</span>
						</div>
						<div className="party__power">
							<span className={`badge${c.powerReady ? ' badge--moss' : ''}`} title={cls.power.text}>
								{c.powerReady ? '✦' : '○'} {cls.power.name}
							</span>
							{c.classId === 'barde' && c.powerReady ? (
								<button type="button" className="btn btn--small btn--ghost" onClick={() => onBardSong(c.id)}>
									Chanter
								</button>
							) : null}
						</div>
					</li>
				);
			})}
		</ul>
	);
}
