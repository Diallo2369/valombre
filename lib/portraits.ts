import 'server-only';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Portraits personnalisés des héros : une image choisie par la famille (photo, dessin…),
 * recadrée et compressée dans le navigateur, rangée dans data/portraits/<id>.<ext>
 * (hors du dépôt git, à côté de la base) et servie par /heros/portrait/<id>.
 */

const DIR = path.join(process.cwd(), 'data', 'portraits');
const MAX_BYTES = 2 * 1024 * 1024;
const TYPES: Record<string, string> = { webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png' };
const MIME_TO_EXT: Record<string, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };

const safeId = (id: string) => /^[\w-]{1,40}$/.test(id);

/** Adresse affichée par le site (le numéro de version évite de garder l'ancienne image en cache). */
export const portraitUrl = (id: string, version: number) => `/heros/portrait/${id}?v=${version}`;

export function removePortrait(id: string) {
	if (!safeId(id)) return;
	for (const ext of Object.keys(TYPES)) fs.rmSync(path.join(DIR, `${id}.${ext}`), { force: true });
}

/** Enregistre une image reçue en data URL ; renvoie son adresse, ou null si le fichier est refusé. */
export function savePortrait(id: string, dataUrl: string): string | null {
	if (!safeId(id)) return null;
	const m = /^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
	if (!m) return null;
	const bytes = Buffer.from(m[2], 'base64');
	if (!bytes.length || bytes.length > MAX_BYTES) return null;
	fs.mkdirSync(DIR, { recursive: true });
	removePortrait(id);
	fs.writeFileSync(path.join(DIR, `${id}.${MIME_TO_EXT[m[1]]}`), bytes);
	return portraitUrl(id, Date.now());
}

export function readPortrait(id: string): { bytes: Buffer; type: string } | null {
	if (!safeId(id)) return null;
	for (const [ext, type] of Object.entries(TYPES)) {
		const file = path.join(DIR, `${id}.${ext}`);
		if (fs.existsSync(file)) return { bytes: fs.readFileSync(file), type };
	}
	return null;
}
