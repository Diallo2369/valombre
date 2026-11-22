import Link from 'next/link';
import { notFound } from 'next/navigation';
import { COMMON_MEDIA, getCampaign } from '@/campaigns';
import { CharacterSheet } from '@/components/CharacterSheet';
import { PrintButton } from '@/components/PrintButton';
import { requireUser } from '@/lib/auth';
import { scanMedia } from '@/lib/media';
import { getAdventure, getCharacters } from '@/lib/repo';

export const metadata = { title: 'Fiches de personnage' };
export const dynamic = 'force-dynamic';

export default function SheetsPage({ params }: { params: { id: string } }) {
	const user = requireUser();
	const adventure = getAdventure(user.id, params.id);
	if (!adventure) notFound();
	const campaign = getCampaign(adventure.campaignId);
	const party = getCharacters(user.id, adventure.partyIds);
	const media = scanMedia('commun', COMMON_MEDIA);

	return (
		<main className="container sheets-page">
			<div className="sheets-page__bar no-print">
				<Link href={`/aventure/${adventure.id}`}>← Retour à l’aventure</Link>
				<PrintButton />
			</div>
			<h1>{adventure.name}</h1>
			<p className="no-print">{campaign?.title}</p>
			<div className="sheets-page__grid">
				{party.map((c) => (
					<CharacterSheet key={c.id} character={c} media={media} print>
						{c.notes ? (
							<div className="sheet__box">
								<h4>Notes</h4>
								<p>{c.notes}</p>
							</div>
						) : null}
					</CharacterSheet>
				))}
			</div>
		</main>
	);
}
