import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { MEDIA_EXTENSIONS, mediaFolder } from '@/campaigns';
import type { Campaign, MediaAsset } from '@/engine/types';
import { voiceHash, voiceLines, type VoiceManifest } from '@/engine/voices';

import type { MediaMap } from './media-types';

export type { MediaMap };

/**
 * Inventaire des fichiers réellement présents dans public/medias/<collection>/.
 * Renvoie { id → url publique }. Un média absent est simplement ignoré par le jeu.
 */
export function scanMedia(collection: string, assets: MediaAsset[]): MediaMap {
	const dir = path.join(process.cwd(), 'public', 'medias', collection);
	let files: string[] = [];
	try {
		files = fs.readdirSync(dir);
	} catch {
		return {};
	}
	const map: MediaMap = {};
	for (const asset of assets) {
		for (const ext of MEDIA_EXTENSIONS[asset.type]) {
			const name = `${asset.id}.${ext}`;
			if (files.includes(name)) {
				map[asset.id] = `${mediaFolder(collection)}/${name}`;
				break;
			}
		}
		// Musiques et ambiances : versions supplémentaires <id>-2.mp3, <id>-3.mp3… jouées à la suite.
		if (map[asset.id] && (asset.type === 'music' || asset.type === 'ambience')) {
			for (let n = 2; n < 10; n++) {
				const ext = MEDIA_EXTENSIONS[asset.type].find((e) => files.includes(`${asset.id}-${n}.${e}`));
				if (!ext) break;
				map[`${asset.id}~${n}`] = `${mediaFolder(collection)}/${asset.id}-${n}.${ext}`;
			}
		}
	}
	return map;
}

export const VOICE_EXTENSIONS = ['mp3', 'ogg', 'm4a', 'wav'];

/** Fichiers de voix présents dans public/medias/<campagne>/voix/ : { id de réplique → URL }. */
export function scanVoices(campaignId: string): MediaMap {
	const dir = path.join(process.cwd(), 'public', 'medias', campaignId, 'voix');
	let files: string[] = [];
	try {
		files = fs.readdirSync(dir);
	} catch {
		return {};
	}
	const map: MediaMap = {};
	for (const f of files) {
		const dot = f.lastIndexOf('.');
		if (dot < 1 || !VOICE_EXTENSIONS.includes(f.slice(dot + 1).toLowerCase())) continue;
		const id = f.slice(0, dot);
		if (!map[id]) map[id] = `${mediaFolder(campaignId)}/voix/${encodeURIComponent(f)}`;
	}
	return map;
}

export type VoiceStatus = 'ok' | 'perime';

/**
 * État des enregistrements d'une campagne.
 * Un fichier généré par le script dont le texte a changé depuis est « périmé » : le jeu ne le joue
 * plus (il risquerait de dire autre chose que ce qui est écrit). Un fichier déposé à la main,
 * absent du manifeste, est considéré comme bon.
 */
export function voiceStatus(campaign: Campaign): { usable: MediaMap; status: Record<string, VoiceStatus> } {
	const files = scanVoices(campaign.id);
	let manifest: VoiceManifest = {};
	try {
		manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public', 'medias', campaign.id, 'voix', 'manifest.json'), 'utf8'));
	} catch {
		/* pas encore de manifeste */
	}
	const usable: MediaMap = {};
	const status: Record<string, VoiceStatus> = {};
	for (const l of voiceLines(campaign)) {
		if (!files[l.id]) continue;
		const m = manifest[l.id];
		const fresh = !m || m.hash === voiceHash(l.who, l.text);
		status[l.id] = fresh ? 'ok' : 'perime';
		if (fresh) usable[l.id] = files[l.id];
	}
	return { usable, status };
}
