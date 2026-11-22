'use client';

/**
 * Chef d'orchestre sonore : 3 couches indépendantes.
 * - musique (par moments : attente, un morceau, silence, morceau suivant)
 * - ambiance (boucle, fondu enchaîné)
 * - bruitages (ponctuels)
 * Niveaux constants : rien ne baisse pendant les voix (le va-et-vient s'entendait).
 */

export interface AudioSettings {
	music: number;
	ambience: number;
	sfx: number;
	muted: boolean;
}

export const DEFAULT_AUDIO: AudioSettings = { music: 0.12, ambience: 0.3, sfx: 0.7, muted: false };

const FADE_MS = 1200;

/**
 * Une couche en boucle. Avec plusieurs versions (mus-route, mus-route-2…), elles s'enchaînent
 * avec un fondu croisé quelques secondes avant la fin de chacune, puis on reprend la première.
 */
class Layer {
	private current: HTMLAudioElement | null = null;
	private key: string | null = null;
	private urls: string[] = [];
	private index = 0;
	private volume = 0.5;

	setVolume(v: number) {
		this.volume = v;
		if (this.current) this.current.volume = this.target();
	}

	private target() {
		return Math.max(0, Math.min(1, this.volume));
	}

	play(urls: string[]) {
		const key = urls.join('|') || null;
		if (key === this.key) {
			if (this.current?.paused) void this.current.play().catch(() => {});
			return;
		}
		this.key = key;
		this.urls = urls;
		this.index = 0;
		this.fadeOutCurrent();
		if (urls.length) this.start(urls[0]);
	}

	private fadeOutCurrent() {
		const old = this.current;
		this.current = null;
		if (!old) return;
		old.ontimeupdate = null;
		fade(old, old.volume, 0, FADE_MS, () => old.pause());
	}

	private start(url: string) {
		const next = new Audio(url);
		const single = this.urls.length === 1;
		next.loop = single;
		next.volume = 0;
		if (!single) {
			// Version suivante un peu avant la fin, pour un enchaînement sans trou.
			next.ontimeupdate = () => {
				if (!next.duration || next.duration - next.currentTime > FADE_MS / 1000 + 0.3) return;
				next.ontimeupdate = null;
				if (this.current !== next) return;
				this.index = (this.index + 1) % this.urls.length;
				this.fadeOutCurrent();
				this.start(this.urls[this.index]);
			};
		}
		this.current = next;
		void next.play().catch(() => {
			/* lecture bloquée tant que l'utilisateur n'a pas cliqué : on réessaiera */
		});
		fade(next, 0, this.target(), FADE_MS);
	}

	resume() {
		if (this.current?.paused) void this.current.play().catch(() => {});
	}

	stop() {
		if (this.current) this.current.ontimeupdate = null;
		this.current?.pause();
		this.current = null;
		this.key = null;
		this.urls = [];
	}
}

/**
 * La musique ne tourne pas en continu : elle laisse respirer l'ambiance.
 * En arrivant dans un lieu, elle attend un peu (le temps que le conteur pose la scène),
 * joue un morceau en entier, se tait un moment, puis joue la version suivante.
 * Un moment fort (combat, final) la fait démarrer tout de suite.
 */
const MUSIC_DELAY_MS: [number, number] = [15000, 30000];
const MUSIC_GAP_MS: [number, number] = [40000, 90000];
/** Changement de musique entre deux scènes : fondu enchaîné léger. */
const CROSSFADE_MS = 3000;

const between = ([min, max]: [number, number]) => min + Math.random() * (max - min);

class MusicLayer {
	private current: HTMLAudioElement | null = null;
	private key: string | null = null;
	private urls: string[] = [];
	private index = 0;
	/** Position atteinte dans chaque morceau quitté en cours de route (pour reprendre au même endroit). */
	private positions = new Map<string, number>();
	/** Version en cours de chaque musique. */
	private lastIndex = new Map<string, number>();
	private timer: number | null = null;
	private volume = 0.5;

	setVolume(v: number) {
		this.volume = v;
		if (this.current) this.current.volume = this.target();
	}

	private target() {
		return Math.max(0, Math.min(1, this.volume));
	}

	/** Même musique qu'avant : on ne touche à rien (le cycle morceau / silence continue). */
	play(urls: string[], immediate: boolean) {
		const key = urls.join('|') || null;
		if (key === this.key) {
			if (immediate && !this.current) this.schedule(0);
			return;
		}
		// Une musique joue déjà : la nouvelle arrive tout de suite, en fondu enchaîné.
		const playing = Boolean(this.current && !this.current.paused);
		this.clearTimer();
		this.fadeOutCurrent(CROSSFADE_MS);
		this.key = key;
		this.urls = urls;
		this.index = this.lastIndex.get(key ?? '') ?? 0;
		if (urls.length) this.schedule(immediate || playing ? 0 : between(MUSIC_DELAY_MS));
	}

	private schedule(ms: number) {
		this.clearTimer();
		this.timer = window.setTimeout(() => {
			this.timer = null;
			this.start(this.urls[this.index]);
		}, ms);
	}

	private clearTimer() {
		if (this.timer !== null) window.clearTimeout(this.timer);
		this.timer = null;
	}

	private fadeOutCurrent(ms = FADE_MS) {
		const old = this.current;
		this.current = null;
		if (!old) return;
		// On retient où on en était : en revenant à cette musique, elle reprend là, pas au début.
		if (old.duration && old.duration - old.currentTime > 10) this.positions.set(old.src, old.currentTime);
		else this.positions.delete(old.src);
		if (this.key) this.lastIndex.set(this.key, this.index);
		old.onended = null;
		old.ontimeupdate = null;
		fade(old, old.volume, 0, ms, () => old.pause());
	}

	private start(url: string | undefined) {
		if (!url) return;
		const el = new Audio(url);
		el.volume = 0;
		const resumeAt = this.positions.get(el.src);
		if (resumeAt) el.currentTime = resumeAt;
		// Fondu de sortie un peu avant la fin, puis silence, puis version suivante.
		el.ontimeupdate = () => {
			if (!el.duration || el.duration - el.currentTime > FADE_MS / 1000 + 0.3) return;
			el.ontimeupdate = null;
			if (this.current !== el) return;
			this.positions.delete(el.src);
			this.fadeOutCurrent();
			this.positions.delete(el.src);
			this.index = (this.index + 1) % this.urls.length;
			if (this.key) this.lastIndex.set(this.key, this.index);
			this.schedule(between(MUSIC_GAP_MS));
		};
		this.current = el;
		void el.play().catch(() => {
			/* lecture bloquée tant que l'utilisateur n'a pas cliqué : on réessaiera */
		});
		// Fondu d'entrée de 3 s : en enchaînement, il croise le fondu de sortie de la musique précédente.
		fade(el, 0, this.target(), CROSSFADE_MS);
	}

	resume() {
		if (this.current?.paused) void this.current.play().catch(() => {});
	}

	stop() {
		this.clearTimer();
		if (this.current) {
			this.current.ontimeupdate = null;
			this.current.pause();
		}
		this.current = null;
		this.key = null;
		this.urls = [];
	}
}

function fade(el: HTMLAudioElement, from: number, to: number, ms: number, done?: () => void) {
	const start = performance.now();
	const step = (now: number) => {
		const t = Math.min(1, (now - start) / ms);
		el.volume = Math.max(0, Math.min(1, from + (to - from) * t));
		if (t < 1) requestAnimationFrame(step);
		else done?.();
	};
	requestAnimationFrame(step);
}

export class AudioDirector {
	private music = new MusicLayer();
	private ambience = new Layer();
	private settings: AudioSettings = DEFAULT_AUDIO;

	configure(settings: AudioSettings) {
		this.settings = settings;
		this.music.setVolume(settings.muted ? 0 : settings.music);
		this.ambience.setVolume(settings.muted ? 0 : settings.ambience);
	}

	/**
	 * Musique et ambiance de la scène : une ou plusieurs versions (liste vide = silence, null = on garde ce qui joue).
	 * `immediate` : moment fort, la musique démarre sans attendre.
	 */
	scene(music: string[] | null, ambience: string[] | null, immediate = false) {
		if (music) this.music.play(music, immediate);
		if (ambience) this.ambience.play(ambience);
	}

	sfx(url: string | null) {
		if (!url || this.settings.muted || this.settings.sfx <= 0) return;
		const a = new Audio(url);
		a.volume = this.settings.sfx;
		void a.play().catch(() => {});
	}

	/** À appeler après un clic : débloque la lecture automatique des navigateurs. */
	resume() {
		this.music.resume();
		this.ambience.resume();
	}

	stop() {
		this.music.stop();
		this.ambience.stop();
	}
}
