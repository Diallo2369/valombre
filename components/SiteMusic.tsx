'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { loadPrefs } from '@/lib/prefs';

/** Événement envoyé par l'écran de jeu quand l'histoire commence : le thème s'efface. */
export const STORY_START_EVENT = 'valombre:histoire';
/** Événement envoyé quand les réglages changent (volume de la musique). */
export const PREFS_EVENT = 'valombre:prefs';

const FADE_IN_MS = 700;
const PAUSE_KEY = 'valombre:musique-coupee';
const FADE_OUT_MS = 3500;

/**
 * Thème musical du site : il démarre dès l'arrivée, continue d'une page à l'autre,
 * et s'efface en fondu quand on clique sur « Commencer l'aventure ».
 * Les navigateurs interdisent le son avant un geste : si la musique est bloquée, un écran d'entrée
 * (« Entrer dans Valombre ») propose ce premier clic, qui la lance.
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
	/** Le navigateur a bloqué le son : on affiche l'écran d'entrée. */
	const [blocked, setBlocked] = useState(false);
	const gate = useRef<HTMLDivElement>(null);
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

	/** Crée le lecteur et lance le téléchargement tout de suite : au premier clic, la musique est déjà prête. */
	const prepare = () => {
		if (audio.current || !urls.length) return;
		const el = new Audio(urls[index.current % urls.length]);
		el.preload = 'auto';
		el.loop = urls.length === 1;
		el.volume = 0;
		// Plusieurs versions : on passe à la suivante à la fin de chacune.
		el.onended = () => {
			index.current += 1;
			el.src = urls[index.current % urls.length];
			void el.play().catch(() => {});
		};
		el.load();
		audio.current = el;
	};

	const start = () => {
		if (!urls.length || silenced.current || paused.current || volume() === 0) return;
		if (audio.current && !audio.current.paused) return;
		prepare();
		const el = audio.current;
		if (!el) return;
		void el
			.play()
			// Le clic sur « Commencer l'aventure » peut arriver pendant le démarrage : on ne remonte pas le son.
			.then(() => {
				setBlocked(false);
				if (!silenced.current && !paused.current) fadeTo(volume(), FADE_IN_MS);
			})
			.catch(() => {
				// Pas encore de geste de l'utilisateur : l'écran d'entrée le propose (on réessaiera aussi au premier clic).
				setBlocked(true);
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
		// Un clic dans l'écran d'entrée est traité par ses boutons (« sans le son » ne doit rien lancer).
		const onGesture = (e: Event) => {
			if (e.target instanceof Element && e.target.closest('.intro-gate')) return;
			start();
		};
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

	useEffect(() => {
		const gated = blocked && !inGame;
		if (gated) gate.current?.querySelector<HTMLElement>('button')?.focus();
		// Tant que l'écran d'entrée est là, les animations de la page attendent (le titre s'écrira une fois entré).
		document.documentElement.classList.toggle('is-gated', gated);
	}, [blocked, inGame]);

	const enter = (withSound: boolean) => {
		setBlocked(false);
		if (withSound) start();
		else {
			// Sans le son pour cette visite seulement : le bouton « Remettre la musique » reste là.
			paused.current = true;
			setOff(true);
		}
	};

	const trapFocus = (e: React.KeyboardEvent) => {
		if (e.key === 'Escape') return enter(false);
		if (e.key !== 'Tab' || !gate.current) return;
		const items = [...gate.current.querySelectorAll<HTMLElement>('button')];
		const edge = e.shiftKey ? items[0] : items[items.length - 1];
		if (document.activeElement === edge) {
			e.preventDefault();
			(e.shiftKey ? items[items.length - 1] : items[0]).focus();
		}
	};

	// Sur l'écran de jeu, c'est le bouton « Son » de la partie qui règle tout.
	if (!urls.length || inGame) return null;
	return (
		<>
			{blocked ? (
				<div className="intro-gate" role="dialog" aria-modal="true" aria-labelledby="intro-gate-title" ref={gate} onKeyDown={trapFocus}>
					<div className="intro-gate__card">
						<h2 id="intro-gate-title" className="visually-hidden">
							Valombre
						</h2>
						<button type="button" className="intro-gate__enter" onClick={() => enter(true)}>
							Entrer dans Valombre
						</button>
						<button type="button" className="intro-gate__quiet" onClick={() => enter(false)}>
							Entrer sans le son
						</button>
					</div>
				</div>
			) : null}
			<button type="button" className="site-music" onClick={toggle} aria-pressed={!off} title={off ? 'Remettre la musique' : 'Couper la musique'}>
				<span aria-hidden="true">{off ? '▶' : '⏸'}</span> {off ? 'Remettre la musique' : 'Musique'}
			</button>
		</>
	);
}
