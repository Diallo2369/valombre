import 'server-only';
import { enterScene, startGame } from '@/engine/engine';
import { makeCharacter } from '@/engine/rules';
import type { Campaign, Character, Game } from '@/engine/types';
import { listCharacters } from './repo';

export type TestTeam = 'test' | 'miens';

/**
 * Équipe de test : un héros de chaque classe aux caractéristiques moyennes (comme un vrai tirage), pour voir des coups réussis ET ratés.
 * (Avec des héros à 6 partout, on touche à tous les coups et on ne voit jamais de riposte.)
 */
function testTeam(): Character[] {
	// Des valeurs de dés moyennes (3 ou 4, comme un vrai tirage), avant les bonus de classe.
	return [
		makeCharacter({ id: 'test-1', name: 'Brunehaut', player: 'Test', gender: 'f', classId: 'guerrier', base: { force: 4, agilite: 3, endurance: 4, esprit: 3, charme: 3, initiative: 3 }, rolls: [4, 3, 4, 3, 3, 3] }),
		makeCharacter({ id: 'test-5', name: 'Saïan', player: 'Test', gender: 'm', classId: 'danseur', base: { force: 3, agilite: 4, endurance: 4, esprit: 3, charme: 3, initiative: 3 }, rolls: [3, 4, 4, 3, 3, 3] }),
		makeCharacter({ id: 'test-2', name: 'Faucon', player: 'Test', gender: 'm', classId: 'rodeur', base: { force: 3, agilite: 4, endurance: 4, esprit: 3, charme: 3, initiative: 3 }, rolls: [3, 4, 4, 3, 3, 3] }),
		makeCharacter({ id: 'test-3', name: 'Lumen', player: 'Test', gender: 'm', classId: 'mage', base: { force: 3, agilite: 3, endurance: 4, esprit: 4, charme: 3, initiative: 3 }, rolls: [3, 3, 4, 4, 3, 3] }),
		makeCharacter({ id: 'test-4', name: 'Mélodie', player: 'Test', gender: 'f', classId: 'barde', base: { force: 3, agilite: 3, endurance: 4, esprit: 3, charme: 4, initiative: 3 }, rolls: [3, 3, 4, 3, 4, 3] }),
	];
}

/** Partie de test qui commence directement dans une scène (rien n'est sauvegardé). */
export function sandboxGame(campaign: Campaign, sceneId: string, team: TestTeam, userId: string): Game {
	const mine = listCharacters(userId)
		.slice(0, 6)
		.map((c) => ({ ...c, pv: c.pvMax, powerReady: true }));
	const party = team === 'miens' && mine.length ? mine : testTeam();
	const start = startGame(campaign, party);
	if (sceneId === campaign.startScene) return { state: start.state, party: start.party };
	const game = enterScene(campaign, { state: start.state, party: start.party }, sceneId, []);
	// La partie de test démarre « dans » la scène : on oublie l'intro déjà entendue.
	game.state.heard = [];
	return { state: game.state, party: game.party };
}
