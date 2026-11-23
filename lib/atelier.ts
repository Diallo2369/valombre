import 'server-only';
import { CAMPAIGNS, COMMON_MEDIA, COMMON_STYLE, MEDIA_EXTENSIONS, VOICE_DIRECTION } from '@/campaigns';
import type { Campaign, MediaAsset, MediaType, Npc, StyleGuide } from '@/engine/types';
import { voiceLines, type VoiceLine } from '@/engine/voices';
import { scanMedia, voiceStatus } from './media';

export const TYPE_LABEL: Record<MediaType, string> = {
	image: 'Images',
	video: 'Vidéos',
	music: 'Musiques',
	ambience: 'Ambiances sonores',
	sfx: 'Bruitages',
};

export const TYPE_ORDER: MediaType[] = ['image', 'video', 'music', 'ambience', 'sfx'];

export interface AtelierEntry extends MediaAsset {
	file: string;
	present: boolean;
	/** URL du fichier présent (aperçu dans l'atelier). */
	url?: string;
	fullPrompt: string;
	usedIn: string[];
}

export interface AtelierCollection {
	id: string;
	title: string;
	style: StyleGuide;
	entries: AtelierEntry[];
}

/** Prompt complet = description spécifique + guide de style commun. */
export function fullPrompt(asset: MediaAsset, style: StyleGuide) {
	// Les images commencent par le nom du fichier attendu (règle donnée à ChatGPT en ouverture).
	const parts = asset.type === 'image' ? [`Fichier : ${asset.id}.webp`, asset.prompt] : [asset.prompt];
	if (asset.composition) parts.push(`Composition : ${asset.composition}`);
	if (asset.id === 'img-couverture' || asset.id === 'img-portail' || asset.id === 'img-carte') parts.push('Format paysage 16:9. Aucun texte dans l’image.');
	else if (asset.type === 'image' && asset.id.startsWith('img-'))
		parts.push('Format paysage 16:9. Garder le bas de l’image (le cinquième inférieur) assez sombre et calme : le titre de la scène s’y affiche. Aucun texte dans l’image.');
	parts.push(`Style : ${style[asset.type]}`);
	return parts.join('\n\n');
}

export function atelierCollections(): AtelierCollection[] {
	const usage = new Map<string, Set<string>>();
	const use = (id: string | undefined, where: string) => {
		if (!id) return;
		if (!usage.has(id)) usage.set(id, new Set());
		usage.get(id)!.add(where);
	};
	for (const c of CAMPAIGNS) {
		use(c.cover, `${c.title} (couverture)`);
		use(c.map?.image, `${c.title} (écran de chargement : carte du monde)`);
		for (const s of Object.values(c.scenes)) {
			const m = s.media ?? {};
			[m.image, m.video, m.music, m.ambience, ...(m.sfx ?? []), s.combat?.enemy.image, ...(s.combat?.foes ?? []).map((f) => f.image)].forEach((id) => use(id, s.title));
		}
		for (const n of Object.values(c.npcs)) use(n.portrait, `PNJ : ${n.name}`);
	}

	const build = (id: string, title: string, assets: MediaAsset[], style: StyleGuide): AtelierCollection => {
		const present = scanMedia(id, assets);
		return {
			id,
			title,
			style,
			entries: assets.map((a) => ({
				...a,
				file: `public/medias/${id}/${a.id}.${MEDIA_EXTENSIONS[a.type][0]}`,
				present: Boolean(present[a.id]),
				url: present[a.id],
				fullPrompt: fullPrompt(a, style),
				usedIn: [...(usage.get(a.id) ?? [])],
			})),
		};
	};

	return [
		build('commun', 'Commun à toutes les campagnes', COMMON_MEDIA, COMMON_STYLE),
		...CAMPAIGNS.map((c) => build(c.id, c.title, c.media, c.style)),
	];
}

export function toMarkdown(col: AtelierCollection): string {
	const out: string[] = [`# Médias — ${col.title}`, ''];
	out.push(`Dossier : \`public/medias/${col.id}/\` — nommer chaque fichier avec son identifiant (ex. \`img-salle-commune.webp\`).`, '');
	out.push('## Guide de style', '');
	for (const t of TYPE_ORDER) out.push(`- **${TYPE_LABEL[t]}** : ${col.style[t]}`);
	out.push('');
	for (const t of TYPE_ORDER) {
		const list = col.entries.filter((e) => e.type === t);
		if (!list.length) continue;
		out.push(`## ${TYPE_LABEL[t]} (${list.filter((e) => e.present).length}/${list.length} faits)`, '');
		for (const e of list) {
			out.push(`### ${e.present ? '✅' : '⬜'} ${e.title} — \`${e.id}\``, '');
			out.push(`Fichier : \`${e.file}\` (extensions acceptées : ${MEDIA_EXTENSIONS[e.type].join(', ')})`);
			if (e.usedIn.length) out.push(`Utilisé dans : ${e.usedIn.join(' · ')}`);
			if (e.notes) out.push(`Note : ${e.notes}`);
			out.push('', '```', e.fullPrompt, '```', '');
		}
	}
	return out.join('\n');
}

/* ------------------------------------------------------------------ */
/* Voix enregistrées                                                   */
/* ------------------------------------------------------------------ */

export interface VoiceEntry extends VoiceLine {
	file: string;
	present: boolean;
	/** Enregistré, mais le texte a changé depuis : à régénérer. */
	stale: boolean;
}

export interface VoiceCast {
	npc: Npc;
	/** Fiche de casting + direction commune, prête à coller dans l'outil de voix. */
	brief: string;
	lines: VoiceEntry[];
}

export interface VoiceCollection {
	campaign: Campaign;
	folder: string;
	cast: VoiceCast[];
	total: number;
	done: number;
	stale: number;
}

/** Texte tel qu'il doit être prononcé (sans guillemets typographiques). */
export const spoken = (text: string) => text.replace(/[«»]/g, '').replace(/\s+/g, ' ').trim();

export function voiceCollection(campaign: Campaign): VoiceCollection {
	const { status } = voiceStatus(campaign);
	const folder = `public/medias/${campaign.id}/voix`;
	const entries: VoiceEntry[] = voiceLines(campaign).map((l) => ({
		...l,
		file: `${folder}/${l.id}.mp3`,
		present: status[l.id] === 'ok',
		stale: status[l.id] === 'perime',
	}));
	const cast = Object.values(campaign.npcs)
		.map((npc) => ({
			npc,
			brief: `${npc.name} — ${npc.role}.\n${npc.casting ?? ''}\n\nDirection commune : ${VOICE_DIRECTION}`,
			lines: entries.filter((e) => e.who === npc.id),
		}))
		.filter((c) => c.lines.length);
	return { campaign, folder, cast, total: entries.length, done: entries.filter((e) => e.present).length, stale: entries.filter((e) => e.stale).length };
}

export function voicesToMarkdown(col: VoiceCollection): string {
	const out: string[] = [`# Voix — ${col.campaign.title}`, ''];
	out.push(`Dossier : \`${col.folder}/\` — un fichier par réplique, nommé avec son identifiant (ex. \`intro-1.mp3\`). Extensions acceptées : mp3, ogg, m4a, wav.`, '');
	out.push(`**Direction commune** : ${VOICE_DIRECTION}`, '');
	out.push(`Avancement : ${col.done}/${col.total} répliques enregistrées.`, '');
	for (const c of col.cast) {
		out.push(`## ${c.npc.name} — ${c.npc.role} (${c.lines.filter((l) => l.present).length}/${c.lines.length})`, '');
		if (c.npc.casting) out.push(`**Casting** : ${c.npc.casting}`, '');
		for (const l of c.lines) out.push(`### ${l.present ? '✅' : l.stale ? '🔁' : '⬜'} \`${l.id}\``, '', `_${l.context}_`, '', '```', spoken(l.text), '```', '');
	}
	return out.join('\n');
}

/** Tableau id ; personnage ; texte, pour les outils qui génèrent des voix par lot (s'ouvre dans un tableur). */
export function voicesToCsv(col: VoiceCollection): string {
	const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
	const rows = ['id;personnage;texte;contexte;fait'];
	for (const c of col.cast)
		for (const l of c.lines) rows.push([l.id, c.npc.name, spoken(l.text), l.context, l.present ? 'oui' : l.stale ? 'à refaire' : 'non'].map(esc).join(';'));
	return '﻿' + rows.join('\n');
}
