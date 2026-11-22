import { CLASSES, STATS, levelFromXp, classPortrait, className } from '@/engine/rules';
import type { Character } from '@/engine/types';
import type { MediaMap } from '@/lib/media-types';
import { MediaView } from './MediaView';

interface Props {
	character: Character;
	media: MediaMap;
	/** Version imprimable (fond clair). */
	print?: boolean;
	children?: React.ReactNode;
}

/** Fiche de personnage complète, à l'écran ou à imprimer. */
export function CharacterSheet({ character: c, media, print = false, children }: Props) {
	const cls = CLASSES[c.classId];
	const level = levelFromXp(c.xp);
	const nextLevelXp = level * 10;
	return (
		<article className={`sheet${print ? ' sheet--print' : ''}`}>
			<header className="sheet__head">
				<MediaView className="sheet__portrait" media={media} image={classPortrait(c)} alt={`Portrait : ${className(c)}`} />
				<div>
					<h3 className="sheet__name">{c.name}</h3>
					<p className="sheet__meta">
						{className(c)} · niveau {level}
						{c.player ? <> · joué par <strong>{c.player}</strong></> : null}
					</p>
					<p className="sheet__tagline">{cls.tagline}</p>
				</div>
			</header>

			<dl className="sheet__stats">
				{STATS.map((s) => (
					<div key={s.key} className={`sheet__stat${s.key === cls.stat ? ' sheet__stat--fav' : ''}`}>
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
					<h4>Expérience</h4>
					<p className="sheet__big">
						{c.xp} <span>/ {nextLevelXp} pour le niveau {level + 1}</span>
					</p>
				</div>
			</div>

			<div className="sheet__box">
				<h4>
					Pouvoir : {cls.power.name} {c.powerReady ? <span className="badge badge--moss">prêt</span> : <span className="badge">utilisé</span>}
				</h4>
				<p>{cls.power.text}</p>
				<p className="sheet__small">Le pouvoir se recharge à chaque repos.</p>
			</div>

			<div className="sheet__box">
				<h4>Équipement</h4>
				<p>{c.kit.join(' · ')}</p>
			</div>

			{c.rolls.length ? (
				<p className="sheet__small">
					Dés de création : {c.rolls.join(', ')} (un 1 compte comme 2, +1 en {STATS.find((s) => s.key === cls.stat)?.label})
				</p>
			) : null}

			{children}
		</article>
	);
}
