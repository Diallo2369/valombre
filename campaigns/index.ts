import type { Campaign, MediaAsset } from '@/engine/types';
import { BRUMES_DE_VALOMBRE } from './brumes-de-valombre';
import { LANTERNE_D_AUBE } from './la-lanterne-d-aube';
import { COMMON_MEDIA, COMMON_STYLE, VOICE_DIRECTION } from './commun/media';

/**
 * Registre des campagnes. Pour en ajouter une : créer son dossier, l'importer ici.
 * L'ordre du tableau est l'ordre d'affichage sur le portail.
 */
export const CAMPAIGNS: Campaign[] = [BRUMES_DE_VALOMBRE, LANTERNE_D_AUBE];

export const CAMPAIGN_BY_ID: Record<string, Campaign> = Object.fromEntries(CAMPAIGNS.map((c) => [c.id, c]));

export function getCampaign(id: string): Campaign | undefined {
	return CAMPAIGN_BY_ID[id];
}

export { COMMON_MEDIA, COMMON_STYLE, VOICE_DIRECTION };

/** Dossier public d'une collection de médias (une campagne ou « commun »). */
export function mediaFolder(collection: string) {
	return `/medias/${collection}`;
}

export const MEDIA_EXTENSIONS: Record<MediaAsset['type'], string[]> = {
	image: ['webp', 'jpg', 'jpeg', 'png'],
	video: ['mp4', 'webm'],
	music: ['mp3', 'ogg', 'm4a'],
	ambience: ['mp3', 'ogg', 'm4a'],
	sfx: ['mp3', 'ogg', 'wav'],
};
