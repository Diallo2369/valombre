import { moveNarration, placeOf, sceneChoices } from './engine';
import type { Campaign, Cond, Effect, MediaAsset } from './types';

/**
 * Vérifie la cohérence d'une campagne : scènes cibles, PNJ, objets, quêtes, médias.
 * Affiché dans l'Atelier pour repérer une faute de frappe dans le scénario.
 */
export function validateCampaign(campaign: Campaign, common: MediaAsset[]): string[] {
	const errors: string[] = [];
	const media = new Set([...campaign.media, ...common].map((m) => m.id));
	const sceneIds = new Set(Object.keys(campaign.scenes));
	const need = (cond: boolean, msg: string) => !cond && errors.push(msg);

	const checkConds = (where: string, conds?: Cond[]) => {
		for (const c of conds ?? []) {
			if ('item' in c) need(Boolean(campaign.items[c.item]), `${where} : objet inconnu « ${c.item} »`);
			if ('notItem' in c) need(Boolean(campaign.items[c.notItem]), `${where} : objet inconnu « ${c.notItem} »`);
			if ('quest' in c) need(Boolean(campaign.quests[c.quest]), `${where} : quête inconnue « ${c.quest} »`);
			if ('visited' in c) need(sceneIds.has(c.visited), `${where} : scène inconnue « ${c.visited} »`);
			if ('notVisited' in c) need(sceneIds.has(c.notVisited), `${where} : scène inconnue « ${c.notVisited} »`);
		}
	};
	const checkEffects = (where: string, effects?: Effect[]) => {
		for (const e of effects ?? []) {
			checkConds(where, e.if);
			if ('addItem' in e) need(Boolean(campaign.items[e.addItem]), `${where} : objet inconnu « ${e.addItem} »`);
			if ('removeItem' in e) need(Boolean(campaign.items[e.removeItem]), `${where} : objet inconnu « ${e.removeItem} »`);
			if ('quest' in e) need(Boolean(campaign.quests[e.quest]), `${where} : quête inconnue « ${e.quest} »`);
		}
	};
	const checkTo = (where: string, to?: string) => to && need(sceneIds.has(to), `${where} : mène à une scène inconnue « ${to} »`);

	need(sceneIds.has(campaign.startScene), `Scène de départ inconnue « ${campaign.startScene} »`);
	for (const zone of Object.values(campaign.zones))
		for (const r of zone.recalls ?? []) need(sceneIds.has(r), `Zone ${zone.id} : rappel inconnu « ${r} »`);

	const reached = new Set<string>([campaign.startScene]);
	for (const zone of Object.values(campaign.zones)) for (const r of zone.recalls ?? []) reached.add(r);

	for (const s of Object.values(campaign.scenes)) {
		const w = `Scène « ${s.id} »`;
		need(Boolean(campaign.zones[s.zone]), `${w} : zone inconnue « ${s.zone} »`);
		for (const [k, v] of Object.entries(s.media ?? {})) {
			if (typeof v === 'boolean') continue; // réglage (musicNow), pas un fichier
			const ids = Array.isArray(v) ? v : [v];
			for (const id of ids) need(media.has(id), `${w} : média ${k} inconnu « ${id} »`);
		}
		for (const l of s.lines) {
			need(l.who === 'narrateur' || Boolean(campaign.npcs[l.who]), `${w} : PNJ inconnu « ${l.who} »`);
			checkConds(w, l.if);
		}
		checkEffects(w, s.onEnter);
		for (const r of s.redirects ?? []) {
			checkConds(w, r.if);
			checkTo(w, r.to);
			reached.add(r.to);
		}
		const choices = s.choices ?? [];
		if (s.next) need(sceneIds.has(s.next), `${w} : lieu « autour » inconnu « ${s.next} »`);
		if (!s.combat && !s.ending) {
			const total = sceneChoices(campaign, s).length;
			need(total > 0, `${w} : aucune sortie (ni choix, ni combat, ni fin)`);
			need(total === 0 || total >= 2, `${w} : un seul choix possible (il en faut toujours au moins deux)`);
		}
		choices.forEach((c, i) => {
			const cw = `${w}, choix ${i + 1}`;
			checkConds(cw, c.if);
			checkEffects(cw, c.effects);
			checkTo(cw, c.to);
			if (c.to) reached.add(c.to);
			if (c.check) {
				for (const o of [c.check.success, c.check.failure]) {
					checkTo(cw, o.to);
					checkEffects(cw, o.effects);
					reached.add(o.to);
				}
			}
			if (!c.to && !c.check) errors.push(`${cw} : ni destination, ni test`);
			if (c.who) need(Boolean(campaign.npcs[c.who]), `${cw} : personnage inconnu « ${c.who} »`);
			if (c.effects?.some((e) => 'message' in e))
				errors.push(`${cw} : le résultat d’un choix se raconte (text, lu à voix haute), pas dans une bulle (message)`);
			if (c.check && c.text) errors.push(`${cw} : un choix à dé raconte son résultat dans success/failure, pas dans text`);
		});
		if (s.combat) {
			need(!s.combat.enemy.image || media.has(s.combat.enemy.image), `${w} : image d’ennemi inconnue`);
			for (const o of [s.combat.victory, s.combat.defeat, s.combat.talk?.outcome, s.combat.flee?.outcome]) {
				if (!o) continue;
				checkTo(w, o.to);
				checkEffects(w, o.effects);
				reached.add(o.to);
			}
		}
	}
	for (const npc of Object.values(campaign.npcs))
		if (npc.portrait) need(media.has(npc.portrait), `PNJ ${npc.id} : portrait inconnu « ${npc.portrait} »`);
	need(media.has(campaign.cover), `Couverture inconnue « ${campaign.cover} »`);
	for (const s of Object.values(campaign.scenes))
		if (s.place) need(Boolean(campaign.places?.[s.place]), `Scène « ${s.id} » : lieu inconnu « ${s.place} »`);
	for (const id of Object.keys(campaign.lights ?? {})) need(media.has(id), `Lumières posées sur une image inconnue « ${id} »`);

	for (const id of sceneIds) if (!reached.has(id)) errors.push(`Scène « ${id} » : jamais atteinte`);
	for (const m of untoldMoves(campaign)) errors.push(m);
	for (const f of deadFlags(campaign)) errors.push(`Fil abandonné : le drapeau « ${f} » est posé mais ne change jamais rien (une réplique, un choix…)`);
	return errors;
}

/**
 * Un fil narratif ne doit jamais tomber à plat : tout drapeau posé (indice, rencontre, vision…)
 * doit être relu quelque part, par une condition de réplique, de choix, d'effet ou d'aiguillage.
 */
export function deadFlags(campaign: Campaign): string[] {
	const set = new Set<string>();
	const used = new Set<string>();
	const conds = (cs?: Cond[]) => {
		for (const c of cs ?? []) {
			if ('flag' in c) used.add(c.flag);
			if ('notFlag' in c) used.add(c.notFlag);
			if ('of' in c) c.of.forEach((f) => used.add(f));
		}
	};
	const effects = (es?: Effect[]) => {
		for (const e of es ?? []) {
			conds(e.if);
			if ('setFlag' in e) set.add(e.setFlag);
		}
	};
	for (const z of Object.values(campaign.zones)) if (z.leashUntil) used.add(z.leashUntil);
	for (const s of Object.values(campaign.scenes)) {
		s.lines.forEach((l) => conds(l.if));
		effects(s.onEnter);
		s.redirects?.forEach((r) => conds(r.if));
		for (const c of s.choices ?? []) {
			conds(c.if);
			effects(c.effects);
			effects(c.check?.success.effects);
			effects(c.check?.failure.effects);
		}
		if (s.combat) for (const o of [s.combat.victory, s.combat.defeat, s.combat.talk?.outcome, s.combat.flee?.outcome]) effects(o?.effects);
	}
	return [...set].filter((f) => !used.has(f)).sort();
}

/**
 * On ne change jamais de lieu sans le raconter : chaque déplacement d'une zone à une autre doit avoir
 * soit une phrase de transition (campaign.transitions), soit un texte dans le choix ou l'issue du dé,
 * soit une scène d'arrivée qui raconte elle-même le trajet (transition: false).
 */
export function untoldMoves(campaign: Campaign): string[] {
	const out = new Set<string>();
	const check = (from: string, to: string, told: boolean) => {
		const a = campaign.scenes[from];
		const b = campaign.scenes[to];
		if (!a || !b || told || b.transition === false || placeOf(a) === placeOf(b)) return;
		if (!moveNarration(campaign, a, b, false).length)
			out.add(`Changement de lieu non raconté : de « ${placeOf(a)} » à « ${placeOf(b)} » (${from} → ${to}) : ajouter une sortie, un trajet, une arrivée ou un texte au choix`);
	};
	for (const s of Object.values(campaign.scenes)) {
		for (const { choice: c } of sceneChoices(campaign, s)) {
			if (c.check) {
				check(s.id, c.check.success.to, Boolean(c.check.success.text));
				check(s.id, c.check.failure.to, Boolean(c.check.failure.text));
			} else check(s.id, c.to ?? s.id, Boolean(c.text));
		}
		if (s.combat)
			for (const o of [s.combat.victory, s.combat.defeat, s.combat.talk?.outcome, s.combat.flee?.outcome])
				if (o) check(s.id, o.to, Boolean(o.text));
	}
	return [...out];
}
