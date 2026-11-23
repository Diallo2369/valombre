import type { Campaign, Scene } from '@/engine/types';
import { CHAPTERS, ITEMS, NPCS, PLACES, QUESTS, TRANSITIONS, ZONES } from './bible';
import { CH1_AUBERGE } from './ch1-auberge';
import { CH1_DEHORS } from './ch1-dehors';
import { CH2_CH3 } from './ch2-ch3';
import { LIGHTS, MEDIA } from './media';
import { COMMON_STYLE } from '../commun/media';

const scenes: Record<string, Scene> = {};
for (const scene of [...CH1_AUBERGE, ...CH1_DEHORS, ...CH2_CH3]) {
	if (scenes[scene.id]) throw new Error(`Scène en double : ${scene.id}`);
	scenes[scene.id] = scene;
}

export const BRUMES_DE_VALOMBRE: Campaign = {
	id: 'brumes-de-valombre',
	title: 'Les Brumes de Valombre',
	subtitle: 'Campagne 1 — Initiation',
	pitch:
		'Une nuit de brume, une auberge isolée, une petite fille disparue. Explorez Combeloup, interrogez ses habitants et partez dans le Bois-Noir rendre sa lumière à la Dame Grise.',
	age: 'Dès 7 ans, avec un adulte',
	duration: '2 à 3 soirées',
	playable: true,
	unlock: { type: 'default' },
	cover: 'img-couverture',
	startScene: 'intro',
	startGold: 10,
	chapters: CHAPTERS,
	zones: ZONES,
	transitions: TRANSITIONS,
	places: PLACES,
	npcs: NPCS,
	items: ITEMS,
	quests: QUESTS,
	scenes,
	media: MEDIA,
	lights: LIGHTS,
	// La carte de l'écran de chargement, et où se trouve chaque zone dessus (en % de l'image, calé sur l'illustration).
	map: {
		image: 'img-carte',
		zones: {
			route: [11, 83],
			auberge: [17.5, 53],
			abords: [20, 59],
			village: [45, 56],
			lisiere: [58, 39],
			foret: [71, 30],
			sanctuaire: [86, 18.5],
		},
	},
	style: COMMON_STYLE,
};
