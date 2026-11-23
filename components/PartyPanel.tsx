'use client';

import { CLASSES, levelFromXp } from '@/engine/rules';
import type { Character } from '@/engine/types';
import type { MediaMap } from '@/lib/media-types';
import { HeroPortrait } from './HeroPortrait';

interface Props {
	party: Character[];
	media: MediaMap;
	activeId?: string;
	spokesId?: string;
	onOpenSheet: (id: string) => void;
	onBardSong: (id: string) => void;
}

/** Colonne du groupe : PV, pouvoir, porte-parole, accès à la fiche. */
export function PartyPanel({ party, media, activeId, spokesId, onOpenSheet, onBardSong }: Props) {
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
							c.id === spokesId ? 'is-spokes' : '',
						]
							.filter(Boolean)
							.join(' ')}
					>
						<button type="button" className="party__main" onClick={() => onOpenSheet(c.id)} aria-label={`Fiche de ${c.name}`}>
							<HeroPortrait className="party__portrait" character={c} media={media} />
							<span className="party__text">
								<span className="party__name">{c.name}</span>
								<span className="party__sub">
									{c.player ? `${c.player} · ` : ''}
									{cls.name} niv. {levelFromXp(c.xp)}
								</span>
							</span>
						</button>
						<div className="party__pv" aria-label={`${c.pv} points de vie sur ${c.pvMax}`}>
							<span className="party__pv-bar" style={{ width: `${Math.round(ratio * 100)}%` }} />
							<span className="party__pv-text">
								♥ {c.pv}/{c.pvMax}
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
