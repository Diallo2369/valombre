import { CAMPAIGNS } from '@/campaigns';
import { CopyButton } from '@/components/CopyButton';
import { SiteHeader } from '@/components/SiteHeader';
import { spoken, voiceCollection } from '@/lib/atelier';
import { requireUser } from '@/lib/auth';

export const metadata = { title: 'Atelier des voix' };
export const dynamic = 'force-dynamic';

export default function VoixPage({ searchParams }: { searchParams: { c?: string; filtre?: string } }) {
	const user = requireUser();
	const campaigns = CAMPAIGNS.filter((c) => c.playable);
	const campaign = campaigns.find((c) => c.id === searchParams.c) ?? campaigns[0];
	const col = voiceCollection(campaign);
	const onlyMissing = searchParams.filtre === 'manquants';
	const base = `/atelier/voix?c=${campaign.id}`;

	return (
		<>
			<SiteHeader user={user} />
			<main className="container atelier">
				<p>
					<a href="/atelier">← Images, musiques et bruitages</a>
				</p>
				<h1>Atelier des voix</h1>
				<p className="atelier__lead">
					Chaque réplique du scénario peut être enregistrée dans un fichier, avec l’outil de voix de votre choix (ElevenLabs, par exemple).
					Créez d’abord une voix par personnage à partir de sa <strong>fiche de casting</strong>, puis générez ses répliques une par une
					et déposez chaque fichier dans <code>{col.folder}/</code> <strong>en le nommant avec son identifiant</strong>. Le jeu l’utilise
					aussitôt. Une réplique pas encore enregistrée reste écrite à l’écran (ou lue par la voix du navigateur, si vous l’activez dans
					les réglages).
				</p>

				{campaigns.length > 1 ? (
					<nav className="atelier__tabs" aria-label="Campagnes">
						{campaigns.map((c) => (
							<a key={c.id} href={`/atelier/voix?c=${c.id}`} className={`atelier__tab${c.id === campaign.id ? ' is-on' : ''}`} aria-current={c.id === campaign.id ? 'page' : undefined}>
								{c.title}
							</a>
						))}
					</nav>
				) : null}

				<div className="atelier__bar">
					<p>
						<strong>
							{col.done}/{col.total}
						</strong>{' '}
						répliques enregistrées · {col.cast.length} voix
						{col.stale ? <> · <strong>🔁 {col.stale} à refaire</strong> (texte modifié depuis l’enregistrement)</> : null}
					</p>
					<div className="atelier__bar-actions">
						<a className="btn btn--small btn--ghost" href={onlyMissing ? base : `${base}&filtre=manquants`}>
							{onlyMissing ? 'Tout afficher' : 'Seulement ce qui manque'}
						</a>
						<a className="btn btn--small btn--ghost" href={`/atelier/voix/export/${campaign.id}?format=csv`}>
							⬇ Tableau (.csv)
						</a>
						<a className="btn btn--small" href={`/atelier/voix/export/${campaign.id}`}>
							⬇ Script complet (.md)
						</a>
					</div>
				</div>

				{col.cast.map(({ npc, brief, lines }) => {
					const done = lines.filter((l) => l.present).length;
					const shown = onlyMissing ? lines.filter((l) => !l.present) : lines;
					if (!shown.length) return null;
					return (
						<details key={npc.id} className="voices card" style={{ '--npc': npc.color } as React.CSSProperties}>
							<summary className="voices__summary">
								<span className="voices__name">{npc.name}</span>
								<span className="voices__role">{npc.role}</span>
								<span className="badge">
									{done}/{lines.length}
								</span>
							</summary>

							<div className="voices__casting">
								<h3>Fiche de casting</h3>
								<p>{npc.casting ?? 'À écrire.'}</p>
								<CopyButton text={brief} label="Copier la fiche de casting" />
							</div>

							<ol className="voices__lines">
								{shown.map((l) => (
									<li key={l.id} className={`voice-line${l.present ? ' is-done' : ''}`}>
										<div className="voice-line__head">
											<span aria-hidden="true">{l.present ? '✅' : l.stale ? '🔁' : '⬜'}</span>
											<code>{l.id}</code>
											<span className="voice-line__context">
												{l.stale ? 'À refaire : le texte a changé · ' : ''}
												{l.context}
											</span>
										</div>
										<p className="voice-line__text">{spoken(l.text)}</p>
										<CopyButton text={spoken(l.text)} label="Copier le texte" />
									</li>
								))}
							</ol>
						</details>
					);
				})}
			</main>
		</>
	);
}
