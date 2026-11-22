'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { loadPrefs } from '@/lib/prefs';

/** Événement envoyé par l'écran de jeu quand l'histoire commence : le thème s'efface. */
export const STORY_START_EVENT = 'valombre:histoire';
/** Événement envoyé quand les réglages changent (volume de la musique). */
export const PREFS_EVENT = 'valombre:prefs';

const FADE_IN_MS = 2500;
const PAUSE_KEY = 'valombre:musique-coupee';
const FADE_OUT_MS = 3500;

/**
 * Thème musical du site : il démarre dès l'arrivée (au premier clic ou à la première touche,
 * les navigateurs interdisant le son avant un geste), continue d'une page à l'autre,
 * et s'efface en fondu quand on clique sur « Commencer l'aventure ».
 */
export function SiteMusic({ urls }: { urls: string[] }) {
	const pathname = usePathname();
	const audio = useRef<HTMLAudioElement | null>(null);
	const index = useRef(0);
	const silenced = useRef(false);
	const raf = useRef<number | null>(null);
	/** Coupé à la main (bouton « Musique ») : on ne relance pas, même en changeant de page. */
	const paused = useRef(false);
	const [off, setOff] = useState(false);
	// Écran de partie (vraie ou de test) : la partie a son propre réglage du son.
	const inGame = /^\/aventure\/(?!nouvelle)[^/]+$/.test(pathname) || /^\/atelier\/test\/[^/]+$/.test(pathname);

	const volume = () => {
		const p = loadPrefs();
		return p.audio.muted ? 0 : p.audio.music;
	};

	const fadeTo = (to: number, ms: number, done?: () => void) => {
		const el = audio.current;
		if (!el) return;
		if (raf.current) cancelAnimationFrame(raf.current);
		const from = el.volume;
		const start = performance.now();
		const step = (now: number) => {
			const t = Math.min(1, (now - start) / ms);
			el.volume = Math.max(0, Math.min(1, from + (to - from) * t));
			if (t < 1) raf.current = requestAnimationFrame(step);
			else done?.();
		};
		raf.current = requestAnimationFrame(step);
	};

	const start = () => {
		if (!urls.length || silenced.current || paused.current || volume() === 0) return;
		if (audio.current && !audio.current.paused) return;
		if (!audio.current) {
			const el = new Audio(urls[index.current % urls.length]);
			el.loop = urls.length === 1;
			el.volume = 0;
			// Plusieurs versions : on passe à la suivante à la fin de chacune.
			el.onended = () => {
				index.current += 1;
				el.src = urls[index.current % urls.length];
				void el.play().catch(() => {});
			};
			audio.current = el;
		}
		void audio.current
			.play()
			// Le clic sur « Commencer l'aventure » peut arriver pendant le démarrage : on ne remonte pas le son.
			.then(() => {
				if (!silenced.current && !paused.current) fadeTo(volume(), FADE_IN_MS);
			})
			.catch(() => {
				/* pas encore de geste de l'utilisateur : on réessaiera au premier clic */
			});
	};

	const silence = () => {
		silenced.current = true;
		fadeTo(0, FADE_OUT_MS, () => audio.current?.pause());
	};

	// Démarrage : tout de suite si le navigateur l'autorise, sinon au premier geste.
	useEffect(() => {
		try {
			paused.current = window.localStorage.getItem(PAUSE_KEY) === '1';
		} catch {
			/* stockage indisponible : la musique joue */
		}
		setOff(paused.current);
		start();
		const onGesture = () => start();
		window.addEventListener('pointerdown', onGesture);
		window.addEventListener('keydown', onGesture);
		const onStory = () => silence();
		const onPrefs = () => {
			if (!audio.current || silenced.current) return start();
			fadeTo(volume(), 300);
		};
		window.addEventListener(STORY_START_EVENT, onStory);
		window.addEventListener(PREFS_EVENT, onPrefs);
		return () => {
			window.removeEventListener('pointerdown', onGesture);
			window.removeEventListener('keydown', onGesture);
			window.removeEventListener(STORY_START_EVENT, onStory);
			window.removeEventListener(PREFS_EVENT, onPrefs);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// De retour hors d'une partie (portail…), le thème revient.
	useEffect(() => {
		if (!inGame && silenced.current) {
			silenced.current = false;
			start();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [pathname]);

	const toggle = () => {
		paused.current = !paused.current;
		setOff(paused.current);
		try {
			window.localStorage.setItem(PAUSE_KEY, paused.current ? '1' : '0');
		} catch {
			/* tant pis : le choix vaut pour cette visite */
		}
		if (paused.current) fadeTo(0, 800, () => audio.current?.pause());
		else start();
	};

	// Sur l'écran de jeu, c'est le bouton « Son » de la partie qui règle tout.
	if (!urls.length || inGame) return null;
	return (
		<button type="button" className="site-music" onClick={toggle} aria-pressed={!off} title={off ? 'Remettre la musique' : 'Couper la musique'}>
			<span aria-hidden="true">{off ? '▶' : '⏸'}</span> {off ? 'Remettre la musique' : 'Musique'}
		</button>
	);
}
