'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCampaign } from '@/campaigns';
import { startGame } from '@/engine/engine';
import { computePvMax, withStats } from '@/engine/rules';
import type { Character, GameState } from '@/engine/types';
import { requireUser } from '@/lib/auth';
import { newId } from '@/lib/ids';
import { removePortrait, savePortrait } from '@/lib/portraits';
import {
	createAdventure,
	deleteAdventure,
	deleteCharacter,
	getAdventure,
	getCharacters,
	isUnlocked,
	saveCharacter,
	unlock,
	unlockWithCode,
	updateAdventureState,
} from '@/lib/repo';

const MAX_HEROES = 6;

function sanitizeCharacter(c: Character): Character {
	const clampStat = (n: number) => Math.max(1, Math.min(12, Math.round(Number(n) || 1)));
	const full = withStats(c).stats;
	const stats = {
		force: clampStat(full.force),
		agilite: clampStat(full.agilite),
		endurance: clampStat(full.endurance),
		esprit: clampStat(full.esprit),
		charme: clampStat(full.charme),
		initiative: clampStat(full.initiative),
	};
	const xp = Math.max(0, Math.round(Number(c.xp) || 0));
	const pvMax = computePvMax(stats, xp, c.classId);
	return {
		id: String(c.id).slice(0, 40),
		name: String(c.name ?? '').slice(0, 40) || 'Héros',
		player: String(c.player ?? '').slice(0, 40),
		...(c.gender === 'f' || c.gender === 'm' ? { gender: c.gender } : {}),
		classId: c.classId,
		stats,
		pvMax,
		pv: Math.max(0, Math.min(pvMax, Math.round(Number(c.pv) || 0))),
		xp,
		powerReady: Boolean(c.powerReady),
		kit: (c.kit ?? []).slice(0, 12).map((k) => String(k).slice(0, 60)),
		rolls: (c.rolls ?? []).slice(0, 8).map((r) => Number(r) || 0),
		notes: String(c.notes ?? '').slice(0, 2000),
	};
}

/** Le portrait personnalisé ne vient jamais du navigateur : on reprend celui qui est enregistré. */
function keepPortrait(c: Character, stored?: Character): Character {
	const { portrait: _ignored, ...rest } = c;
	return stored?.portrait ? { ...rest, portrait: stored.portrait } : rest;
}

/** Crée une aventure à partir de nouveaux héros et/ou de héros existants. */
export async function createAdventureAction(input: {
	campaignId: string;
	name: string;
	newHeroes: Character[];
	reuseIds: string[];
}): Promise<{ error?: string }> {
	const user = requireUser();
	const campaign = getCampaign(input.campaignId);
	if (!campaign || !campaign.playable) return { error: 'Campagne introuvable.' };
	if (!isUnlocked(user.id, campaign)) return { error: 'Cette campagne est encore verrouillée.' };

	const reused = getCharacters(user.id, input.reuseIds).map((c) => ({ ...c, pv: c.pvMax, powerReady: true }));
	const created = input.newHeroes.map((h) => {
		const c = sanitizeCharacter({ ...h, id: newId('h') });
		const portrait = h.portrait?.startsWith('data:') ? savePortrait(c.id, h.portrait) : null;
		return portrait ? { ...c, portrait } : c;
	});
	const party = [...reused, ...created].slice(0, MAX_HEROES);
	if (!party.length) return { error: 'Il faut au moins un héros pour partir à l’aventure.' };

	for (const c of party) saveCharacter(user.id, c);
	const start = startGame(campaign, party);
	start.state.run = newId('r');
	const id = newId('a');
	createAdventure(user.id, {
		id,
		campaignId: campaign.id,
		name: input.name.trim().slice(0, 60) || campaign.title,
		partyIds: party.map((c) => c.id),
		state: start.state,
	});
	redirect(`/aventure/${id}`);
}

/** Sauvegarde automatique après chaque action de jeu. */
export async function saveGameAction(adventureId: string, state: GameState, party: Character[]) {
	const user = requireUser();
	const adventure = getAdventure(user.id, adventureId);
	if (!adventure) return { ok: false };
	// Partie recommencée depuis : cet écran est périmé, on ne l'écoute plus.
	if (adventure.state.run && state.run !== adventure.state.run) return { ok: false, stale: true };
	const allowed = new Set(adventure.partyIds);
	// Un écran ouvert avant un réglage fait ailleurs (le genre, au portail) ne doit pas l'effacer.
	const stored = new Map(getCharacters(user.id, adventure.partyIds).map((c) => [c.id, c]));
	for (const c of party)
		if (allowed.has(c.id)) saveCharacter(user.id, keepPortrait(sanitizeCharacter({ ...c, gender: c.gender ?? stored.get(c.id)?.gender }), stored.get(c.id)));
	updateAdventureState(user.id, adventureId, { ...state, campaignId: adventure.campaignId });

	// Fin de campagne : déblocage de la suivante.
	const campaign = getCampaign(adventure.campaignId);
	const scene = campaign?.scenes[state.sceneId];
	if (state.ended && scene?.ending?.unlock) unlock(user.id, scene.ending.unlock);
	return { ok: true };
}

export async function saveNotesAction(adventureId: string, characterId: string, notes: string) {
	const user = requireUser();
	const adventure = getAdventure(user.id, adventureId);
	if (!adventure || !adventure.partyIds.includes(characterId)) return;
	const [c] = getCharacters(user.id, [characterId]);
	if (c) saveCharacter(user.id, { ...c, notes: notes.slice(0, 2000) });
}

/** Recommence une aventure depuis le début, avec les mêmes héros (caractéristiques, niveau et notes conservés). */
export async function restartAdventureAction(form: FormData) {
	const user = requireUser();
	const adventure = getAdventure(user.id, String(form.get('id')));
	const campaign = adventure && getCampaign(adventure.campaignId);
	if (!adventure || !campaign) return;
	const party = getCharacters(user.id, adventure.partyIds).map((c) => ({ ...c, pv: c.pvMax, powerReady: true }));
	for (const c of party) saveCharacter(user.id, c);
	const start = startGame(campaign, party);
	start.state.run = newId('r');
	updateAdventureState(user.id, adventure.id, start.state);
	redirect(`/aventure/${adventure.id}`);
}

export async function deleteAdventureAction(form: FormData) {
	const user = requireUser();
	deleteAdventure(user.id, String(form.get('id')));
	revalidatePath('/portail');
}

/** Héroïne ou héros : pour les personnages créés avant ce choix (portrait et nom de classe accordés). */
export async function setGenderAction(form: FormData) {
	const user = requireUser();
	const gender = String(form.get('gender'));
	if (gender !== 'f' && gender !== 'm') return;
	const [c] = getCharacters(user.id, [String(form.get('id'))]);
	if (c) saveCharacter(user.id, { ...c, gender });
	revalidatePath('/portail');
}

export async function deleteCharacterAction(form: FormData) {
	const user = requireUser();
	const id = String(form.get('id'));
	if (getCharacters(user.id, [id]).length) removePortrait(id);
	deleteCharacter(user.id, id);
	revalidatePath('/portail');
}

/** Change l'image d'un héros (data URL recadrée par le navigateur), ou remet le portrait de classe (null). */
export async function setPortraitAction(id: string, dataUrl: string | null): Promise<{ error?: string }> {
	const user = requireUser();
	const [c] = getCharacters(user.id, [id]);
	if (!c) return { error: 'Héros introuvable.' };
	if (dataUrl === null) {
		removePortrait(id);
		const { portrait: _old, ...rest } = c;
		saveCharacter(user.id, rest);
	} else {
		const portrait = savePortrait(id, dataUrl);
		if (!portrait) return { error: 'Image refusée : il faut une image (JPEG, PNG ou WebP) de moins de 2 Mo.' };
		saveCharacter(user.id, { ...c, portrait });
	}
	revalidatePath('/portail');
	revalidatePath('/aventure', 'layout');
	return {};
}

export async function unlockCodeAction(_prev: { message?: string; ok?: boolean }, form: FormData) {
	const user = requireUser();
	const campaign = unlockWithCode(user.id, String(form.get('code') ?? ''));
	revalidatePath('/portail');
	if (!campaign) return { ok: false, message: 'Ce code ne débloque rien… pour l’instant.' };
	return { ok: true, message: `« ${campaign.title} » est débloquée !` };
}
