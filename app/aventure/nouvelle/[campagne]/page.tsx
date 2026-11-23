import { notFound, redirect } from 'next/navigation';
import { COMMON_MEDIA, getCampaign } from '@/campaigns';
import { PartyCreator } from '@/components/PartyCreator';
import { SiteHeader } from '@/components/SiteHeader';
import { requireUser } from '@/lib/auth';
import { scanMedia } from '@/lib/media';
import { isUnlocked, listCharacters } from '@/lib/repo';

export const metadata = { title: 'Nouvelle aventure' };
export const dynamic = 'force-dynamic';

export default function NewAdventurePage({ params }: { params: { campagne: string } }) {
	const user = requireUser();
	const campaign = getCampaign(params.campagne);
	if (!campaign || !campaign.playable) notFound();
	if (!isUnlocked(user.id, campaign)) redirect('/portail');

	return (
		<>
			<SiteHeader user={user} />
			<main className="container new-adventure">
				<p className="new-adventure__eyebrow">{campaign.subtitle}</p>
				<h1>{campaign.title}</h1>
				<p className="new-adventure__lead">
					Chaque joueur crée son héros. Un adulte peut lire les explications à voix haute, et les enfants lancent les dés !
				</p>
				<PartyCreator
					campaignId={campaign.id}
					campaignTitle={campaign.title}
					existing={listCharacters(user.id)}
					media={scanMedia('commun', COMMON_MEDIA)}
					mapUrl={campaign.map ? scanMedia(campaign.id, campaign.media)[campaign.map.image] : undefined}
				/>
			</main>
		</>
	);
}
