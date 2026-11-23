import { currentUser } from '@/lib/auth';
import { readPortrait } from '@/lib/portraits';
import { listCharacters } from '@/lib/repo';

export const dynamic = 'force-dynamic';

/** Portrait personnalisé d'un héros : visible seulement par le compte à qui appartient le héros. */
export function GET(_req: Request, { params }: { params: { id: string } }) {
	const user = currentUser();
	if (!user || !listCharacters(user.id).some((c) => c.id === params.id)) return new Response('Introuvable', { status: 404 });
	const file = readPortrait(params.id);
	if (!file) return new Response('Introuvable', { status: 404 });
	return new Response(new Uint8Array(file.bytes), {
		headers: { 'Content-Type': file.type, 'Cache-Control': 'private, max-age=31536000, immutable' },
	});
}
