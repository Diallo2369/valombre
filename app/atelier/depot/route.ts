import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { CAMPAIGNS, COMMON_MEDIA, MEDIA_EXTENSIONS } from '@/campaigns';
import { currentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 200 * 1024 * 1024;

/**
 * Dépôt d'un fichier généré ailleurs (image ChatGPT, vidéo…) depuis l'atelier :
 * il est enregistré sous le nom attendu, public/medias/<collection>/<identifiant>.<ext>,
 * et remplace l'éventuelle version précédente.
 */
export async function POST(req: Request) {
	if (!currentUser()) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 });
	const form = await req.formData();
	const collection = String(form.get('collection') ?? '');
	const id = String(form.get('id') ?? '');
	const file = form.get('file');
	if (!(file instanceof File)) return NextResponse.json({ error: 'Aucun fichier reçu.' }, { status: 400 });

	const assets = collection === 'commun' ? COMMON_MEDIA : CAMPAIGNS.find((c) => c.id === collection)?.media;
	const asset = assets?.find((a) => a.id === id);
	if (!asset) return NextResponse.json({ error: 'Média inconnu.' }, { status: 404 });

	const ext = path.extname(file.name).slice(1).toLowerCase();
	const allowed = MEDIA_EXTENSIONS[asset.type];
	if (!allowed.includes(ext)) return NextResponse.json({ error: `Format refusé : il faut ${allowed.join(', ')}.` }, { status: 400 });
	if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Fichier trop lourd (200 Mo maximum).' }, { status: 400 });

	const dir = path.join(process.cwd(), 'public', 'medias', collection);
	fs.mkdirSync(dir, { recursive: true });
	// Une seule version de base par identifiant : on retire l'ancienne, quelle que soit son extension.
	for (const e of allowed) fs.rmSync(path.join(dir, `${id}.${e}`), { force: true });
	fs.writeFileSync(path.join(dir, `${id}.${ext}`), Buffer.from(await file.arrayBuffer()));
	return NextResponse.json({ ok: true, file: `public/medias/${collection}/${id}.${ext}` });
}
