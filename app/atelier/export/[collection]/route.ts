import { NextResponse } from 'next/server';
import { atelierCollections, toMarkdown } from '@/lib/atelier';
import { currentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Export Markdown de tous les prompts d'une collection, à donner aux IA génératives. */
export function GET(_req: Request, { params }: { params: { collection: string } }) {
	if (!currentUser()) return new NextResponse('Connexion requise', { status: 401 });
	const col = atelierCollections().find((c) => c.id === params.collection);
	if (!col) return new NextResponse('Collection inconnue', { status: 404 });
	return new NextResponse(toMarkdown(col), {
		headers: {
			'Content-Type': 'text/markdown; charset=utf-8',
			'Content-Disposition': `attachment; filename="prompts-${col.id}.md"`,
		},
	});
}
