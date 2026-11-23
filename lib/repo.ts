import 'server-only';
import { CAMPAIGNS, getCampaign } from '@/campaigns';
import { withStats } from '@/engine/rules';
import type { Campaign, Character, GameState } from '@/engine/types';
import { db, ensureSchema } from './db';

/* ------------------------------------------------------------------ */
/* Campagnes débloquées                                                */
/* ------------------------------------------------------------------ */

export function unlockedIds(userId: string): Set<string> {
	const rows = db().prepare('SELECT campaign_id FROM unlocks WHERE user_id = ?').all(userId) as { campaign_id: string }[];
	const ids = new Set(rows.map((r) => r.campaign_id));
	for (const c of CAMPAIGNS) if (c.unlock.type === 'default') ids.add(c.id);
	return ids;
}

export function isUnlocked(userId: string, campaign: Campaign) {
	return unlockedIds(userId).has(campaign.id);
}

export function unlock(userId: string, campaignId: string) {
	db()
		.prepare('INSERT OR IGNORE INTO unlocks (user_id, campaign_id, unlocked_at) VALUES (?, ?, ?)')
		.run(userId, campaignId, Date.now());
}

/** Code saisi sur le portail : renvoie la campagne débloquée, ou null. */
/** Le tutoriel du premier combat est fait (ou passé) : il ne revient plus. */
export const TUTORIAL_FLAG = 'tutoriel-combat';

/** Ce que le compte a déjà fait (ex. « tutoriel-combat »). */
export function userFlag(userId: string, flag: string): boolean {
	ensureSchema();
	return Boolean(db().prepare('SELECT 1 FROM user_flags WHERE user_id = ? AND flag = ?').get(userId, flag));
}

export function setUserFlag(userId: string, flag: string, on: boolean) {
	ensureSchema();
	if (on) db().prepare('INSERT OR IGNORE INTO user_flags (user_id, flag, set_at) VALUES (?, ?, ?)').run(userId, flag, Date.now());
	else db().prepare('DELETE FROM user_flags WHERE user_id = ? AND flag = ?').run(userId, flag);
}

export function unlockWithCode(userId: string, rawCode: string): Campaign | null {
	const code = rawCode.trim().toUpperCase();
	if (!code) return null;
	for (const c of CAMPAIGNS) {
		const codes = c.unlock.type === 'code' ? c.unlock.codes : c.unlock.type === 'after' ? c.unlock.codes ?? [] : [];
		if (codes.map((x) => x.toUpperCase()).includes(code)) {
			unlock(userId, c.id);
			return c;
		}
	}
	return null;
}

/* ------------------------------------------------------------------ */
/* Personnages                                                         */
/* ------------------------------------------------------------------ */

export function listCharacters(userId: string): Character[] {
	const rows = db()
		.prepare('SELECT data FROM characters WHERE user_id = ? ORDER BY updated_at DESC')
		.all(userId) as { data: string }[];
	return rows.map((r) => withStats(JSON.parse(r.data) as Character));
}

export function getCharacters(userId: string, ids: string[]): Character[] {
	const all = new Map(listCharacters(userId).map((c) => [c.id, c]));
	return ids.map((id) => all.get(id)).filter((c): c is Character => Boolean(c));
}

export function saveCharacter(userId: string, c: Character) {
	const now = Date.now();
	db()
		.prepare(
			`INSERT INTO characters (id, user_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
			 ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
			 WHERE characters.user_id = excluded.user_id`,
		)
		.run(c.id, userId, JSON.stringify(c), now, now);
}

export function deleteCharacter(userId: string, id: string) {
	db().prepare('DELETE FROM characters WHERE id = ? AND user_id = ?').run(id, userId);
}

/* ------------------------------------------------------------------ */
/* Aventures (parties sauvegardées)                                    */
/* ------------------------------------------------------------------ */

export interface AdventureRow {
	id: string;
	campaignId: string;
	name: string;
	partyIds: string[];
	state: GameState;
	createdAt: number;
	updatedAt: number;
}

function toAdventure(r: Record<string, unknown>): AdventureRow {
	return {
		id: r.id as string,
		campaignId: r.campaign_id as string,
		name: r.name as string,
		partyIds: JSON.parse(r.party as string),
		state: JSON.parse(r.state as string),
		createdAt: r.created_at as number,
		updatedAt: r.updated_at as number,
	};
}

export function listAdventures(userId: string): AdventureRow[] {
	const rows = db()
		.prepare('SELECT * FROM adventures WHERE user_id = ? ORDER BY updated_at DESC')
		.all(userId) as Record<string, unknown>[];
	return rows.map(toAdventure);
}

export function getAdventure(userId: string, id: string): AdventureRow | null {
	const row = db().prepare('SELECT * FROM adventures WHERE id = ? AND user_id = ?').get(id, userId) as
		| Record<string, unknown>
		| undefined;
	return row ? toAdventure(row) : null;
}

export function createAdventure(userId: string, a: Omit<AdventureRow, 'createdAt' | 'updatedAt'>) {
	const now = Date.now();
	db()
		.prepare(
			'INSERT INTO adventures (id, user_id, campaign_id, name, party, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
		)
		.run(a.id, userId, a.campaignId, a.name, JSON.stringify(a.partyIds), JSON.stringify(a.state), now, now);
}

export function updateAdventureState(userId: string, id: string, state: GameState) {
	db()
		.prepare('UPDATE adventures SET state = ?, updated_at = ? WHERE id = ? AND user_id = ?')
		.run(JSON.stringify(state), Date.now(), id, userId);
}

export function deleteAdventure(userId: string, id: string) {
	db().prepare('DELETE FROM adventures WHERE id = ? AND user_id = ?').run(id, userId);
}

export { getCampaign };
