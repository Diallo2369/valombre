import type { Campaign } from './types';

/**
 * Catalogue des répliques à enregistrer, dérivé du scénario.
 *
 * Chaque texte lu à voix haute reçoit un identifiant stable, qui sert de nom de fichier :
 *   public/medias/<campagne>/voix/<id>.mp3
 *
 *   transition-<zone>-<zone>   trajet d'une zone à l'autre (ex. transition-auberge-village)
 *   lieu-<lieu>-arrivee        arrivée dans un lieu physique ; lieu-<lieu>-sortie[-<destination>] en le quittant
 *   <scène>-<n>                ligne n de la scène (1, 2, 3…)
 *   <scène>-choix<n>-texte     ce qui se passe quand on prend le choix n (sans dé)
 *   <scène>-choix<n>-reussite  phrase lue après un dé réussi sur le choix n
 *   <scène>-choix<n>-echec     … et après un dé raté
 *   <scène>-victoire / -defaite / -parler / -fuite   issues d'un combat
 *   <scène>-fin                texte de fin de campagne
 *
 * Un même texte dit par le même personnage à plusieurs endroits n'est enregistré qu'une fois
 * (le premier identifiant rencontré gagne).
 * Attention : insérer une ligne au milieu d'une scène décale les numéros suivants de cette scène.
 */

export interface VoiceLine {
	id: string;
	who: string;
	text: string;
	sceneId: string;
	sceneTitle: string;
	/** Où la réplique est entendue, pour le comédien (ou l'IA) qui l'enregistre. */
	context: string;
}

const key = (who: string, text: string) => `${who}\u0000${text}`;

export function voiceLines(campaign: Campaign): VoiceLine[] {
	const out: VoiceLine[] = [];
	const seen = new Set<string>();
	for (const [pair, text] of Object.entries(campaign.transitions ?? {})) {
		const [a, b] = pair.split('>');
		const k = key('narrateur', text);
		if (seen.has(k)) continue;
		seen.add(k);
		const zone = (id: string) => campaign.zones[id]?.name ?? id;
		out.push({ id: `transition-${a}-${b}`, who: 'narrateur', text, sceneId: '', sceneTitle: 'Transitions', context: `En passant de « ${zone(a)} » à « ${zone(b)} »` });
	}
	for (const [id, p] of Object.entries(campaign.places ?? {})) {
		const lines: [string, string | undefined, string][] = [
			...Object.entries(p.arrive ?? {}).map(([origin, text]): [string, string, string] => [
				`lieu-${id}-arrivee${origin === '*' ? '' : `-${origin}`}`,
				text,
				`En arrivant : ${p.name}${origin === '*' ? '' : ` (depuis ${campaign.places?.[origin]?.name ?? origin})`}`,
			]),
			...Object.entries(p.leave ?? {}).map(([dest, text]): [string, string, string] => [
				`lieu-${id}-sortie${dest === '*' ? '' : `-${dest}`}`,
				text,
				`En quittant : ${p.name}${dest === '*' ? '' : ` (vers ${campaign.places?.[dest]?.name ?? dest})`}`,
			]),
		];
		for (const [lid, text, context] of lines) {
			if (!text || seen.has(key('narrateur', text))) continue;
			seen.add(key('narrateur', text));
			out.push({ id: lid, who: 'narrateur', text, sceneId: '', sceneTitle: 'Lieux', context });
		}
	}
	for (const s of Object.values(campaign.scenes)) {
		const add = (id: string, who: string, text: string | undefined, context: string) => {
			if (!text) return;
			const k = key(who, text);
			if (seen.has(k)) return;
			seen.add(k);
			out.push({ id, who, text, sceneId: s.id, sceneTitle: s.title, context });
		};
		s.lines.forEach((l, i) => add(`${s.id}-${i + 1}`, l.who, l.text, s.title));
		s.choices?.forEach((c, i) => {
			add(`${s.id}-choix${i + 1}-texte`, c.who ?? 'narrateur', c.text, `${s.title} — après le choix « ${c.label} »`);
			if (!c.check) return;
			add(`${s.id}-choix${i + 1}-reussite`, 'narrateur', c.check.success.text, `${s.title} — après un dé réussi (« ${c.label} »)`);
			add(`${s.id}-choix${i + 1}-echec`, 'narrateur', c.check.failure.text, `${s.title} — après un dé raté (« ${c.label} »)`);
		});
		if (s.combat) {
			const enemy = s.combat.enemy.name;
			add(`${s.id}-attaque`, 'narrateur', s.combat.enemy.attack, `Combat contre ${enemy} — son attaque, à son tour`);
			add(`${s.id}-victoire`, 'narrateur', s.combat.victory.text, `Combat contre ${enemy} — victoire`);
			add(`${s.id}-defaite`, 'narrateur', s.combat.defeat.text, `Combat contre ${enemy} — défaite`);
			add(`${s.id}-parler`, 'narrateur', s.combat.talk?.outcome.text, `Combat contre ${enemy} — on l’apaise`);
			add(`${s.id}-fuite`, 'narrateur', s.combat.flee?.outcome.text, `Combat contre ${enemy} — on s’enfuit`);
		}
		if (s.ending) add(`${s.id}-fin`, 'narrateur', s.ending.text, `${s.title} — texte de fin`);
	}
	return out;
}

/** (qui, texte) → identifiant du fichier, pour retrouver l'enregistrement pendant la partie. */
export function voiceIndex(campaign: Campaign): Map<string, string> {
	return new Map(voiceLines(campaign).map((l) => [key(l.who, l.text), l.id]));
}

export function voiceKey(who: string, text: string) {
	return key(who, text);
}

/**
 * Empreinte (FNV-1a 32 bits) de « qui dit quoi ». Le script de génération l'écrit dans
 * voix/manifest.json : si le texte change ensuite, l'enregistrement est reconnu comme périmé.
 */
export function voiceHash(who: string, text: string): string {
	let h = 0x811c9dc5;
	for (const ch of key(who, text)) {
		h ^= ch.codePointAt(0)!;
		h = Math.imul(h, 0x01000193) >>> 0;
	}
	return h.toString(16).padStart(8, '0');
}

/** Contenu de public/medias/<campagne>/voix/manifest.json, écrit par scripts/voix.cjs. */
export type VoiceManifest = Record<string, { hash: string; voice: string; model: string; at: string }>;
