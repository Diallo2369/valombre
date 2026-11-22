import { CAMPAIGNS } from '@/campaigns';
import { SiteHeader } from '@/components/SiteHeader';
import { requireUser } from '@/lib/auth';
import { raccords } from '@/lib/raccords';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Raccords' };

/** Relecture des passages d'un lieu à l'autre : le raccord, suivi de la première ligne de la scène. */
export default function RaccordsPage({ searchParams }: { searchParams: { c?: string } }) {
	const user = requireUser();
	const campaign = CAMPAIGNS.find((c) => c.id === searchParams.c && c.playable) ?? CAMPAIGNS.find((c) => c.playable)!;
	const list = raccords(campaign);
	const place = (id: string) => campaign.places?.[id]?.name ?? id;
	const groups = [...new Set(list.map((r) => r.fromPlace))];

	return (
		<>
			<SiteHeader user={user} />
			<main className="container atelier">
				<p>
					<a href="/atelier">← Atelier</a> · <a href="/atelier/test">Tests</a>
				</p>
				<h1>Raccords</h1>
				<p className="atelier__lead">
					Chaque passage d’un lieu à un autre, tel que le Conteur le dit : le texte du choix (s’il raconte le trajet), la sortie, le
					trajet et l’arrivée, <strong>puis la première ligne de la scène</strong>. À relire d’une traite pour repérer les
					contradictions et les redites. {list.length} passages.
				</p>
				{groups.map((g) => (
					<section key={g} className="atelier__group" aria-labelledby={`r-${g}`}>
						<h2 id={`r-${g}`}>Depuis : {place(g)}</h2>
						<ul className="raccords">
							{list
								.filter((r) => r.fromPlace === g)
								.map((r, i) => (
									<li key={i} className="raccord card">
										<p className="raccord__head">
											→ <strong>{place(r.toPlace)}</strong> · « {r.choice} » <a href={`/atelier/test/${r.from}?c=${campaign.id}`}>tester</a>
										</p>
										{r.told ? <p className="raccord__told">{r.told}</p> : null}
										{r.lines.map((l, j) => (
											<p key={j} className="raccord__line">
												{l}
											</p>
										))}
										<p className="raccord__next">{r.next}</p>
									</li>
								))}
						</ul>
					</section>
				))}
			</main>
		</>
	);
}
