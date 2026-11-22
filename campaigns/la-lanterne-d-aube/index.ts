import type { Campaign } from '@/engine/types';
import { COMMON_STYLE } from '../commun/media';

/**
 * CAMPAGNE 2 — La Lanterne d'Aube (annoncée, pas encore écrite).
 * Débloquée en finissant « Les Brumes de Valombre », ou avec le code ci-dessous.
 *
 * Pistes d'écriture :
 * - Le voyage vers le Nord gelé : la caravane de sel, le col des Hurlevents.
 * - La Citadelle de Sel et le Prince de Sel, qui a volé la flamme pour ne plus jamais avoir froid.
 * - Les héros de la campagne 1 peuvent être repris (fiches conservées, niveau et XP compris).
 * - Retour possible de Pff, du louveteau de braise, de Gaspard repenti.
 * Pour l'écrire : même structure que brumes-de-valombre (bible, scènes par chapitre, médias),
 * puis passer `playable` à true.
 */
export const LANTERNE_D_AUBE: Campaign = {
	id: 'la-lanterne-d-aube',
	title: 'La Lanterne d’Aube',
	subtitle: 'Campagne 2 — Le Nord gelé',
	pitch:
		'La flamme de l’Aube a été volée il y a des siècles par le Prince de Sel. Traversez les cols gelés jusqu’à sa citadelle blanche pour la rapporter à Valombre.',
	age: 'Dès 8 ans, avec un adulte',
	duration: '3 à 4 soirées',
	playable: false,
	unlock: { type: 'after', campaign: 'brumes-de-valombre', codes: ['AUBE-DE-SEL'] },
	cover: 'img-couverture',
	startScene: 'bientot',
	startGold: 10,
	chapters: [{ n: 1, title: 'Bientôt…' }],
	zones: { nord: { id: 'nord', name: 'Le Nord gelé' } },
	npcs: {},
	items: {},
	quests: {},
	scenes: {
		bientot: {
			id: 'bientot',
			title: 'Bientôt',
			chapter: 1,
			zone: 'nord',
			lines: [{ who: 'narrateur', text: 'Cette campagne est encore en cours d’écriture…' }],
			ending: { title: 'À suivre', text: 'Revenez bientôt !' },
		},
	},
	media: [
		{
			id: 'img-couverture',
			type: 'image',
			title: 'Couverture de la campagne 2',
			prompt:
				'Une citadelle de sel blanc cristallin au sommet d’une montagne enneigée, la nuit, sous une aurore boréale bleue et verte. Tout en haut de la plus haute tour, une flamme dorée prisonnière d’une cage de cristal. Au premier plan, une caravane de traîneaux et quatre jeunes aventuriers emmitouflés qui lèvent les yeux.',
			notes: 'Garder le haut de l’image dégagé pour le titre.',
		},
		{
			id: 'mus-theme-nord',
			type: 'music',
			title: 'Thème du Nord',
			prompt:
				'Variation du thème de Valombre dans une ambiance glacée : cristallophone, cordes aiguës en harmoniques, cor lointain, chœur d’hommes grave sans paroles. Majestueux et froid. 70 BPM, 2 min, boucle.',
		},
	],
	style: COMMON_STYLE,
};
