import { notFound } from 'next/navigation';
import { COMMON_MEDIA, getCampaign } from '@/campaigns';
import { GameScreen } from '@/components/GameScreen';
import { requireUser } from '@/lib/auth';
import { scanMedia, voiceStatus } from '@/lib/media';
import { sandboxGame } from '@/lib/sandbox';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Test de scène' };

/** Lance une scène directement, en mode test (rien n'est sauvegardé). */
export default function TestScenePage({ params, searchParams }: { params: { scene: string }; searchParams: { c?: string; equipe?: string } }) {
	const user = requireUser();
	const campaign = getCampaign(searchParams.c ?? 'brumes-de-valombre');
	if (!campaign || !campaign.scenes[params.scene]) notFound();
	const game = sandboxGame(campaign, params.scene, searchParams.equipe === 'miens' ? 'miens' : 'test', user.id);
	const media = { ...scanMedia('commun', COMMON_MEDIA), ...scanMedia(campaign.id, campaign.media) };
	return (
		<GameScreen
			key={`${params.scene}-${searchParams.equipe ?? 'test'}`}
			adventureId="test"
			adventureName={`Test : ${campaign.scenes[params.scene].title}`}
			campaign={campaign}
			initial={game}
			media={media}
			voices={voiceStatus(campaign).usable}
			sandbox
		/>
	);
}
