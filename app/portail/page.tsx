import Link from 'next/link';
import { CAMPAIGNS, COMMON_MEDIA, getCampaign } from '@/campaigns';
import { deleteAdventureAction, deleteCharacterAction, restartAdventureAction, setGenderAction } from '@/app/actions/game';
import { ConfirmSubmit } from '@/components/ConfirmSubmit';
import { MediaView } from '@/components/MediaView';
import { SiteHeader } from '@/components/SiteHeader';
import { UnlockForm } from '@/components/UnlockForm';
import { className, classPortrait, levelFromXp } from '@/engine/rules';
import { requireUser } from '@/lib/auth';
import { scanMedia } from '@/lib/media';
import { listAdventures, listCharacters, unlockedIds } from '@/lib/repo';

export const metadata = { title: 'Portail' };
export const dynamic = 'force-dynamic';

const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

export default function PortalPage() {
	const user = requireUser();
	const unlocked = unlockedIds(user.id);
	const adventures = listAdventures(user.id);
	const heroes = listCharacters(user.id);
	const common = scanMedia('commun', COMMON_MEDIA);

	return (
		<>
			<SiteHeader user={user} />
			<main className="container portal">
				<h1 className="portal__title">Bienvenue, {user.displayName}</h1>

				{adventures.length ? (
					<section className="portal__section" aria-labelledby="adv-title">
						<h2 id="adv-title">Vos aventures</h2>
						<ul className="adventures">
							{adventures.map((a) => {
								const campaign = getCampaign(a.campaignId);
								const scene = campaign?.scenes[a.state.sceneId];
								const chapter = campaign?.chapters.find((c) => c.n === scene?.chapter);
								return (
									<li key={a.id} className="adventure card">
										<div className="adventure__text">
											<h3>{a.name}</h3>
											<p className="adventure__meta">
												{campaign?.title ?? 'Campagne inconnue'}
												{chapter ? ` · Chapitre ${chapter.n}` : ''}
												{scene ? ` · ${scene.title}` : ''}
											</p>
											<p className="adventure__date">
												{a.state.ended ? '🏆 Terminée · ' : ''}Dernière partie le {dateFmt.format(a.updatedAt)}
											</p>
										</div>
										<div className="adventure__actions">
											<Link className="btn" href={`/aventure/${a.id}`}>
												{a.state.ended ? 'Revoir la fin' : 'Reprendre'}
											</Link>
											<Link className="btn btn--ghost btn--small" href={`/aventure/${a.id}/fiches`}>
												Fiches
											</Link>
											<form action={restartAdventureAction}>
												<input type="hidden" name="id" value={a.id} />
												<ConfirmSubmit
													className="btn btn--small btn--ghost"
													message={`Recommencer « ${a.name} » depuis le début ? Les héros gardent leurs caractéristiques, leur niveau et leurs notes. La progression de l’histoire est perdue.`}
												>
													↺ Recommencer
												</ConfirmSubmit>
											</form>
											<form action={deleteAdventureAction}>
												<input type="hidden" name="id" value={a.id} />
												<button type="submit" className="btn btn--small btn--danger">
													Supprimer
												</button>
											</form>
										</div>
									</li>
								);
							})}
						</ul>
					</section>
				) : null}

				<section className="portal__section" aria-labelledby="camp-title">
					<h2 id="camp-title">Campagnes</h2>
					<ul className="campaigns">
						{CAMPAIGNS.map((c) => {
							const open = unlocked.has(c.id);
							const media = scanMedia(c.id, c.media);
							return (
								<li key={c.id} className={`campaign card${open ? '' : ' is-locked'}`}>
									<MediaView className="campaign__cover" media={media} image={c.cover} alt="" placeholder={c.title} />
									<div className="campaign__body">
										<p className="campaign__sub">{c.subtitle}</p>
										<h3>{c.title}</h3>
										<p>{c.pitch}</p>
										<p className="campaign__meta">
											<span className="badge">{c.age}</span> <span className="badge">{c.duration}</span>
										</p>
										{open && c.playable ? (
											<Link className="btn" href={`/aventure/nouvelle/${c.id}`}>
												Nouvelle aventure
											</Link>
										) : open ? (
											<p className="badge badge--wisp">Débloquée · en cours d’écriture</p>
										) : (
											<p className="campaign__lock">
												🔒 {c.unlock.type === 'after' ? `Se débloque en terminant « ${getCampaign(c.unlock.campaign)?.title} »` : 'Se débloque avec un code'}
											</p>
										)}
									</div>
								</li>
							);
						})}
					</ul>
					<UnlockForm />
				</section>

				{heroes.length ? (
					<section className="portal__section" aria-labelledby="heroes-title">
						<h2 id="heroes-title">Les héros de la table</h2>
						<ul className="heroes">
							{heroes.map((h) => (
								<li key={h.id} className="hero-chip card">
									<MediaView className="hero-chip__img" media={common} image={classPortrait(h)} alt="" />
									<div>
										<strong>{h.name}</strong>
										<small>
											{className(h)} niv. {levelFromXp(h.xp)} · {h.player || '—'}
										</small>
										{!h.gender ? (
											<form action={setGenderAction} className="hero-chip__gender">
												<input type="hidden" name="id" value={h.id} />
												<span>Héroïne ou héros ?</span>
												<button type="submit" name="gender" value="f" className="btn btn--small btn--ghost">
													Héroïne
												</button>
												<button type="submit" name="gender" value="m" className="btn btn--small btn--ghost">
													Héros
												</button>
											</form>
										) : null}
									</div>
									<form action={deleteCharacterAction}>
										<input type="hidden" name="id" value={h.id} />
										<button type="submit" className="btn btn--small btn--danger" aria-label={`Supprimer ${h.name}`}>
											✕
										</button>
									</form>
								</li>
							))}
						</ul>
					</section>
				) : null}
			</main>
		</>
	);
}
