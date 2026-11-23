import { notFound } from 'next/navigation';
import { COMMON_MEDIA, getCampaign } from '@/campaigns';
import { GameScreen } from '@/components/GameScreen';
import { repairGame } from '@/engine/engine';
import { requireUser } from '@/lib/auth';
import { scanMedia, voiceStatus } from '@/lib/media';
import { TUTORIAL_FLAG, getAdventure, getCharacters, userFlag } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
	return { title: 'Aventure' };
}

export default function AdventurePage({ params }: { params: { id: string } }) {
	const user = requireUser();
	const adventure = getAdventure(user.id, params.id);
	if (!adventure) notFound();
	const campaign = getCampaign(adventure.campaignId);
	if (!campaign) notFound();
	const party = getCharacters(user.id, adventure.partyIds);
	// Une scène supprimée du scénario après coup : on repart du début plutôt que de planter.
	const state = campaign.scenes[adventure.state.sceneId] ? adventure.state : { ...adventure.state, sceneId: campaign.startScene, combat: null };
	const media = { ...scanMedia('commun', COMMON_MEDIA), ...scanMedia(campaign.id, campaign.media) };

	return <GameScreen adventureId={adventure.id} adventureName={adventure.name} campaign={campaign} initial={repairGame(campaign, { state, party })} media={media} voices={voiceStatus(campaign).usable} tutorial={!userFlag(user.id, TUTORIAL_FLAG)} />;
}
