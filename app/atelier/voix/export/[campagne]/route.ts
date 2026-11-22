import { NextResponse } from 'next/server';
import { getCampaign } from '@/campaigns';
import { voiceCollection, voicesToCsv, voicesToMarkdown } from '@/lib/atelier';
import { currentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Script des voix d'une campagne : Markdown (par défaut) ou tableau CSV (?format=csv). */
export function GET(req: Request, { params }: { params: { campagne: string } }) {
	if (!currentUser()) return new NextResponse('Connexion requise', { status: 401 });
	const campaign = getCampaign(params.campagne);
	if (!campaign) return new NextResponse('Campagne inconnue', { status: 404 });
	const col = voiceCollection(campaign);
	const csv = new URL(req.url).searchParams.get('format') === 'csv';
	return new NextResponse(csv ? voicesToCsv(col) : voicesToMarkdown(col), {
		headers: {
			'Content-Type': csv ? 'text/csv; charset=utf-8' : 'text/markdown; charset=utf-8',
			'Content-Disposition': `attachment; filename="voix-${campaign.id}.${csv ? 'csv' : 'md'}"`,
		},
	});
}
