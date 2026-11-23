import Link from 'next/link';
import { CAMPAIGNS } from '@/campaigns';
import { SiteHeader } from '@/components/SiteHeader';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tests' };

/** Bac à sable : lancer n'importe quelle scène (et les combats) sans toucher aux vraies parties. */
export default function TestsPage({ searchParams }: { searchParams: { c?: string; equipe?: string } }) {
	const user = requireUser();
	const campaigns = CAMPAIGNS.filter((c) => c.playable);
	const campaign = campaigns.find((c) => c.id === searchParams.c) ?? campaigns[0];
	const team = searchParams.equipe === 'miens' ? 'miens' : 'test';
	const scenes = Object.values(campaign.scenes);
	const combats = scenes.filter((s) => s.combat);
	const href = (id: string) => `/atelier/test/${id}?c=${campaign.id}&equipe=${team}`;

	return (
		<>
			<SiteHeader user={user} />
			<main className="container atelier">
				<p>
					<a href="/atelier">← Atelier</a>
				</p>
				<h1>Tests</h1>
				<p className="atelier__lead">
					Lancez n’importe quelle scène directement, avec les voix, la musique et les lumières. <strong>Rien n’est sauvegardé</strong> :
					vos vraies aventures ne bougent pas. Pour relire tous les passages d’un lieu à l’autre, voir les{' '}
					<a href="/atelier/raccords">raccords</a>.
				</p>

				<div className="atelier__bar">
					<p>Équipe pour les tests :</p>
					<div className="atelier__bar-actions">
						<a className={`btn btn--small${team === 'test' ? '' : ' btn--ghost'}`} href={`/atelier/test?c=${campaign.id}&equipe=test`} aria-current={team === 'test' ? 'true' : undefined}>
							Équipe de test (4 héros moyens : on voit des coups ratés)
						</a>
						<a className={`btn btn--small${team === 'miens' ? '' : ' btn--ghost'}`} href={`/atelier/test?c=${campaign.id}&equipe=miens`} aria-current={team === 'miens' ? 'true' : undefined}>
							Mes héros
						</a>
					</div>
				</div>

				<section className="atelier__group" aria-labelledby="t-combats">
					<h2 id="t-combats">⚔ Combats</h2>
					<ul className="tests">
						{combats.map((s) => (
							<li key={s.id}>
								<Link className="tests__link tests__link--fight" href={href(s.id)}>
									<strong>{s.combat!.enemy.name}</strong>
									<span>
										{s.title} · {s.combat!.enemy.hearts * 2} PV (pour 4 héros) · {s.combat!.enemy.difficulty}
									</span>
								</Link>
							</li>
						))}
					</ul>
				</section>

				{campaign.chapters.map((ch) => (
					<section key={ch.n} className="atelier__group" aria-labelledby={`t-ch${ch.n}`}>
						<h2 id={`t-ch${ch.n}`}>
							Chapitre {ch.n} · {ch.title}
						</h2>
						<ul className="tests">
							{scenes
								.filter((s) => s.chapter === ch.n)
								.map((s) => (
									<li key={s.id}>
										<Link className="tests__link" href={href(s.id)}>
											<strong>{s.title}</strong>
											<span>
												{s.id}
												{s.place ? ` · ${campaign.places?.[s.place]?.name ?? s.place}` : ''}
											</span>
										</Link>
									</li>
								))}
						</ul>
					</section>
				))}
			</main>
		</>
	);
}
