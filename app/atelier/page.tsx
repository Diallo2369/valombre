import { CAMPAIGNS, COMMON_MEDIA } from '@/campaigns';
import { CopyButton } from '@/components/CopyButton';
import { DropFile } from '@/components/DropFile';
import { SiteHeader } from '@/components/SiteHeader';
import { validateCampaign } from '@/engine/validate';
import { TYPE_LABEL, TYPE_ORDER, atelierCollections } from '@/lib/atelier';
import { requireUser } from '@/lib/auth';

export const metadata = { title: 'Atelier des médias' };
export const dynamic = 'force-dynamic';

export default function AtelierPage({ searchParams }: { searchParams: { c?: string; filtre?: string } }) {
	const user = requireUser();
	const collections = atelierCollections();
	const current = collections.find((c) => c.id === searchParams.c) ?? collections[1] ?? collections[0];
	const onlyMissing = searchParams.filtre === 'manquants';
	const done = current.entries.filter((e) => e.present).length;
	const campaign = CAMPAIGNS.find((c) => c.id === current.id);
	const errors = campaign ? validateCampaign(campaign, COMMON_MEDIA) : [];

	return (
		<>
			<SiteHeader user={user} />
			<main className="container atelier">
				<h1>Atelier des médias</h1>
				<p className="atelier__lead">
					Chaque écran du jeu attend une image, une musique, une ambiance ou des bruitages. Copiez le prompt, générez le fichier avec l’IA de
					votre choix, puis déposez-le dans le dossier indiqué <strong>en le nommant avec son identifiant</strong>. Il apparaîtra
					automatiquement dans le jeu. Tant qu’un fichier manque, le jeu affiche un fond de brume et reste silencieux.
				</p>

				<nav className="atelier__tabs" aria-label="Collections">
					{collections.map((c) => (
						<a key={c.id} href={`/atelier?c=${c.id}`} className={`atelier__tab${c.id === current.id ? ' is-on' : ''}`} aria-current={c.id === current.id ? 'page' : undefined}>
							{c.title}
							<span className="badge">
								{c.entries.filter((e) => e.present).length}/{c.entries.length}
							</span>
						</a>
					))}
				</nav>

				<div className="atelier__bar">
					<p>
						<strong>
							{done}/{current.entries.length}
						</strong>{' '}
						fichiers prêts · dossier <code>public/medias/{current.id}/</code>
					</p>
					<div className="atelier__bar-actions">
						<a className="btn btn--small btn--ghost" href="/atelier/voix">
							🎙 Voix des personnages
						</a>
						<a className="btn btn--small btn--ghost" href="/atelier/test">
							🧪 Tests
						</a>
						<a className="btn btn--small btn--ghost" href="/atelier/raccords">
							🔗 Raccords
						</a>
						<a className="btn btn--small btn--ghost" href={`/atelier?c=${current.id}${onlyMissing ? '' : '&filtre=manquants'}`}>
							{onlyMissing ? 'Tout afficher' : 'Seulement ce qui manque'}
						</a>
						<a className="btn btn--small" href={`/atelier/export/${current.id}`}>
							⬇ Exporter tous les prompts (.md)
						</a>
					</div>
				</div>

				{campaign ? (
					<details className={`atelier__check card${errors.length ? ' has-errors' : ''}`}>
						<summary>
							{errors.length ? `⚠ ${errors.length} incohérence(s) dans le scénario` : '✓ Scénario cohérent'} ·{' '}
							{Object.keys(campaign.scenes).length} scènes
						</summary>
						{errors.length ? (
							<ul>
								{errors.map((e) => (
									<li key={e}>{e}</li>
								))}
							</ul>
						) : (
							<p>Toutes les scènes, les PNJ, les objets, les quêtes et les médias référencés existent, et chaque scène est atteignable.</p>
						)}
					</details>
				) : null}

				<details className="atelier__style card">
					<summary>Guide de style (ajouté automatiquement à chaque prompt copié)</summary>
					<dl>
						{TYPE_ORDER.map((t) => (
							<div key={t}>
								<dt>{TYPE_LABEL[t]}</dt>
								<dd>{current.style[t]}</dd>
							</div>
						))}
					</dl>
				</details>

				{TYPE_ORDER.map((t) => {
					const list = current.entries.filter((e) => e.type === t && (!onlyMissing || !e.present));
					if (!list.length) return null;
					return (
						<section key={t} className="atelier__group" aria-labelledby={`g-${t}`}>
							<h2 id={`g-${t}`}>
								{TYPE_LABEL[t]}{' '}
								<span className="badge">
									{current.entries.filter((e) => e.type === t && e.present).length}/{current.entries.filter((e) => e.type === t).length}
								</span>
							</h2>
							<ul className="assets">
								{list.map((e) => (
									<li key={e.id} className={`asset card${e.present ? ' is-done' : ''}`}>
										<div className="asset__head">
											<h3>
												{e.present ? '✅' : '⬜'} {e.title}
											</h3>
											<code className="asset__file">{e.file}</code>
										</div>
										{e.usedIn.length ? <p className="asset__used">Utilisé dans : {e.usedIn.join(' · ')}</p> : null}
										{e.notes ? <p className="asset__notes">📌 {e.notes}</p> : null}
										{e.url && e.type === 'image' ? (
											// eslint-disable-next-line @next/next/no-img-element
											<img className="asset__thumb" src={e.url} alt={`Aperçu : ${e.title}`} loading="lazy" />
										) : null}
										{e.url && e.type === 'video' ? <video className="asset__thumb" src={e.url} muted controls preload="metadata" /> : null}
										{e.url && (e.type === 'music' || e.type === 'ambience' || e.type === 'sfx') ? (
											<audio className="asset__audio" src={e.url} controls preload="none" aria-label={`Écouter : ${e.title}`} />
										) : null}
										<p className="asset__prompt">{e.prompt}</p>
										{e.composition ? <p className="asset__notes">📐 {e.composition}</p> : null}
										<CopyButton text={e.fullPrompt} />
										<DropFile collection={current.id} id={e.id} type={e.type} present={e.present} />
									</li>
								))}
							</ul>
						</section>
					);
				})}
			</main>
		</>
	);
}
