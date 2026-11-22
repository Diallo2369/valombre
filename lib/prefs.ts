'use client';

import { DEFAULT_AUDIO, type AudioSettings } from './audio';
import { DEFAULT_VOICE, type VoiceSettings } from './voice';

/** Réglages propres à cet appareil (volume, voix) : simple confort, stocké localement. */
export interface Prefs {
	audio: AudioSettings;
	voice: VoiceSettings;
	/** Dés physiques : on saisit le résultat au lieu de lancer à l'écran. */
	realDice: boolean;
	/** Annoncer à chaque choix qui est le porte-parole du groupe. */
	spokesperson: boolean;
}

export const DEFAULT_PREFS: Prefs = { audio: DEFAULT_AUDIO, voice: DEFAULT_VOICE, realDice: false, spokesperson: true };

const KEY = 'valombre:prefs';

export function loadPrefs(): Prefs {
	try {
		const raw = window.localStorage.getItem(KEY);
		if (!raw) return DEFAULT_PREFS;
		const p = JSON.parse(raw) as Partial<Prefs>;
		return {
			...DEFAULT_PREFS,
			...p,
			audio: { ...DEFAULT_PREFS.audio, ...p.audio },
			voice: { ...DEFAULT_PREFS.voice, ...p.voice },
		};
	} catch {
		return DEFAULT_PREFS;
	}
}

export function savePrefs(p: Prefs) {
	try {
		window.localStorage.setItem(KEY, JSON.stringify(p));
		// Le thème du site (SiteMusic) ajuste son volume en direct.
		window.dispatchEvent(new Event('valombre:prefs'));
	} catch {
		/* stockage indisponible : tant pis, on garde les réglages en mémoire */
	}
}
