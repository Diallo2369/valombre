import 'server-only';
import { moveNarration, placeOf, sceneChoices } from '@/engine/engine';
import type { Campaign } from '@/engine/types';

export interface Raccord {
	from: string;
	to: string;
	fromPlace: string;
	toPlace: string;
	choice: string;
	/** Texte du choix ou de l'issue du dé, s'il raconte déjà le trajet. */
	told?: string;
	lines: string[];
	/** Première réplique de la scène d'arrivée (ce qui suit le raccord). */
	next: string;
}

/** Tous les déplacements d'un lieu à un autre, avec ce que le Conteur dit, pour les relire. */
export function raccords(campaign: Campaign): Raccord[] {
	const out: Raccord[] = [];
	const seen = new Set<string>();
	for (const s of Object.values(campaign.scenes)) {
		for (const { choice: c } of sceneChoices(campaign, s)) {
			const outs: [string, string | undefined][] = c.check
				? [
						[c.check.success.to, c.check.success.text],
						[c.check.failure.to, c.check.failure.text],
					]
				: [[c.to ?? s.id, c.text]];
			for (const [to, told] of outs) {
				const b = campaign.scenes[to];
				if (!b || b.transition === false || placeOf(s) === placeOf(b)) continue;
				const lines = moveNarration(campaign, s, b, Boolean(told));
				const next = (b.lines.find((l) => !l.if) ?? b.lines[0])?.text ?? '';
				const key = [placeOf(s), b.id, told ?? '', ...lines].join('|');
				if (seen.has(key)) continue;
				seen.add(key);
				out.push({ from: s.id, to: b.id, fromPlace: placeOf(s), toPlace: placeOf(b), choice: c.label, told, lines, next });
			}
		}
	}
	return out;
}
