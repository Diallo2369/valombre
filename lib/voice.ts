'use client';

import type { Npc } from '@/engine/types';

/**
 * Lecteur des répliques d'une scène.
 *
 * Pour chaque réplique : on joue l'enregistrement s'il existe
 * (public/medias/<campagne>/voix/<id>.mp3). Sinon, si le réglage est activé,
 * on se rabat sur la synthèse vocale du navigateur ; sinon la réplique reste écrite à l'écran.
 * Le lecteur sait se mettre en pause, reprendre, passer à la réplique suivante et s'arrêter.
 */

export interface VoiceSettings {
	/** Lire les répliques des PNJ. */
	npc: boolean;
	/** Lire aussi la narration. */
	narrator: boolean;
	/** Vitesse globale. */
	speed: number;
	/** Volume des voix enregistrées. */
	volume: number;
	/** Voix du navigateur pour les répliques pas encore enregistrées. */
	browserFallback: boolean;
}

export const DEFAULT_VOICE: VoiceSettings = { npc: true, narrator: true, speed: 1, volume: 1, browserFallback: false };

export type PlayerState = 'idle' | 'playing' | 'paused';

/** Silence entre deux répliques, le temps d'un souffle. */
const BREATH_MS = 700;

export interface VoiceItem {
	text: string;
	npc: Npc;
	/** URL de l'enregistrement, s'il existe. */
	url?: string;
}

interface Hooks {
	/** Index (dans la liste d'origine) de la réplique en cours, ou null. */
	onLine: (index: number | null) => void;
	onState: (state: PlayerState) => void;
}

/* ---------------- Synthèse du navigateur (secours) ---------------- */

const FEMALE_HINTS = ['amélie', 'amelie', 'audrey', 'aurélie', 'aurelie', 'marie', 'julie', 'hortense', 'denise', 'céline', 'celine', 'léa', 'lea', 'virginie', 'female', 'femme', 'google français'];
const MALE_HINTS = ['thomas', 'daniel', 'nicolas', 'paul', 'henri', 'jacques', 'claude', 'mathieu', 'male', 'homme'];

export function speechSupported() {
	return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function pickVoice(gender: 'f' | 'm', seed: string): SpeechSynthesisVoice | undefined {
	if (!speechSupported()) return undefined;
	const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('fr'));
	if (!voices.length) return undefined;
	const hints = gender === 'f' ? FEMALE_HINTS : MALE_HINTS;
	const matching = voices.filter((v) => hints.some((h) => v.name.toLowerCase().includes(h)));
	const pool = matching.length ? matching : voices;
	let hash = 0;
	for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
	return pool[hash % pool.length];
}

/* ---------------- Lecteur ---------------- */

export class VoicePlayer {
	private queue: { item: VoiceItem; index: number }[] = [];
	private pos = 0;
	private state: PlayerState = 'idle';
	private audio: HTMLAudioElement | null = null;
	private utterance: SpeechSynthesisUtterance | null = null;
	/** Incrémenté à chaque arrêt : les rappels d'une lecture abandonnée sont ignorés. */
	private run = 0;
	/** Le « souffle » entre deux répliques. */
	private breath: number | null = null;
	private settings: VoiceSettings = DEFAULT_VOICE;

	constructor(private hooks: Hooks) {}

	configure(settings: VoiceSettings) {
		this.settings = settings;
		if (this.audio) {
			this.audio.volume = settings.volume;
			this.audio.playbackRate = settings.speed;
		}
	}

	/** Répliques qui seront réellement entendues avec les réglages actuels. */
	audible(items: VoiceItem[]) {
		return items
			.map((item, index) => ({ item, index }))
			.filter(({ item }) => (item.npc.id === 'narrateur' ? this.settings.narrator : this.settings.npc))
			.filter(({ item }) => item.url || (this.settings.browserFallback && speechSupported()));
	}

	/** Lit les répliques à partir de `from` ; `only` restreint la lecture à certaines (les nouvelles). */
	play(items: VoiceItem[], from = 0, only?: Set<number>) {
		this.stop();
		this.queue = this.audible(items).filter(({ index }) => index >= from && (!only || only.has(index)));
		this.pos = 0;
		if (!this.queue.length) return;
		this.setState('playing');
		this.playCurrent();
	}

	pause() {
		if (this.state !== 'playing') return;
		// En pause pendant un souffle : la réplique suivante attendra la reprise.
		this.clearBreath();
		this.audio?.pause();
		if (this.utterance) window.speechSynthesis.pause();
		this.setState('paused');
	}

	resume() {
		if (this.state !== 'paused') return;
		this.setState('playing');
		if (this.audio) void this.audio.play().catch(() => this.advance(this.run));
		else if (this.utterance) window.speechSynthesis.resume();
		else this.playCurrent();
	}

	toggle() {
		if (this.state === 'playing') this.pause();
		else if (this.state === 'paused') this.resume();
	}

	/** Passe à la réplique suivante (même en pause : la lecture reprend). */
	next() {
		if (this.state === 'idle') return;
		this.release();
		this.pos += 1;
		this.setState('playing');
		this.playCurrent();
	}

	stop() {
		this.run += 1;
		this.release();
		this.queue = [];
		this.pos = 0;
		if (this.state !== 'idle') this.setState('idle');
		this.hooks.onLine(null);
	}

	private clearBreath() {
		if (this.breath !== null) window.clearTimeout(this.breath);
		this.breath = null;
	}

	private release() {
		this.run += 1;
		this.clearBreath();
		if (this.audio) {
			this.audio.onended = null;
			this.audio.onerror = null;
			this.audio.pause();
			this.audio = null;
		}
		if (this.utterance) {
			this.utterance.onend = null;
			this.utterance.onerror = null;
			this.utterance = null;
		}
		if (speechSupported()) window.speechSynthesis.cancel();
	}

	private setState(s: PlayerState) {
		this.state = s;
		this.hooks.onState(s);
	}

	/** Réplique suivante, après un petit temps de respiration (BREATH_MS). */
	private advance(run: number) {
		if (run !== this.run) return;
		this.release();
		this.pos += 1;
		if (!this.queue[this.pos]) return this.playCurrent();
		const token = this.run;
		this.breath = window.setTimeout(() => {
			this.breath = null;
			if (token === this.run && this.state === 'playing') this.playCurrent();
		}, BREATH_MS);
	}

	private playCurrent() {
		const entry = this.queue[this.pos];
		if (!entry) {
			this.stop();
			return;
		}
		const run = this.run;
		this.hooks.onLine(entry.index);
		const { item } = entry;

		if (item.url) {
			const a = new Audio(item.url);
			a.volume = this.settings.volume;
			a.playbackRate = this.settings.speed;
			a.onended = () => this.advance(run);
			// Fichier illisible : on n'insiste pas, la réplique reste écrite.
			a.onerror = () => this.advance(run);
			this.audio = a;
			void a.play().catch(() => this.advance(run));
			return;
		}

		const u = new SpeechSynthesisUtterance(item.text.replace(/[«»]/g, ''));
		u.lang = 'fr-FR';
		const voice = pickVoice(item.npc.voice.gender, item.npc.id);
		if (voice) u.voice = voice;
		u.pitch = item.npc.voice.pitch;
		u.rate = Math.max(0.5, Math.min(2, item.npc.voice.rate * this.settings.speed));
		u.onend = () => this.advance(run);
		u.onerror = () => this.advance(run);
		this.utterance = u;
		window.speechSynthesis.speak(u);
	}
}
