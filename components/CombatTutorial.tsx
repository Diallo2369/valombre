'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Le tutoriel du premier combat (tant qu'il n'a pas été terminé sur le compte, il revient au combat suivant).
 * Un projecteur éclaire ce dont on parle (le reste s'assombrit), une bulle explique. Il est interactif :
 * aux étapes « se déplacer », « choisir une action » et « viser », il attend que le joueur le fasse.
 * Les bulles n'apparaissent qu'entre deux animations, jamais par-dessus un coup.
 */

type Step = 'ordre' | 'actif' | 'deplacer' | 'action' | 'viser' | 'resultat' | 'monstres' | 'fin';

interface Props {
	/** Une animation se joue : on attend. */
	busy: boolean;
	phase: 'hero' | 'intent';
	actorName: string;
	/** Le héros qui joue s'est déjà déplacé ; il a des cases où aller. */
	moved: boolean;
	canMove: boolean;
	/** Une action est choisie (on vise). */
	aiming: boolean;
	/** Numéro de l'étape de jeu (il change à chaque action jouée), et si le héros vient d'agir. */
	seq: number;
	acted: boolean;
	/** Le groupe a un guerrier (Intervention) ; une créature prépare un sort. */
	hasGuard: boolean;
	spellComing: boolean;
	onDone: () => void;
}

const FOCUS: Record<Step | 'intent', string | null> = {
	ordre: 'ordre',
	actif: 'actif',
	deplacer: 'plateau',
	action: 'actions',
	viser: 'plateau',
	resultat: 'plateau',
	monstres: 'plateau',
	fin: null,
	intent: 'monstres',
};

export function CombatTutorial(props: Props) {
	const { busy, phase, actorName, moved, canMove, aiming, seq, acted, hasGuard, spellComing, onDone } = props;
	const [step, setStep] = useState<Step>('ordre');
	const [rect, setRect] = useState<DOMRect | null>(null);
	/** Hauteur réelle de la bulle (elle dépend du texte et de la largeur) : pour la garder dans l'écran. */
	const [bubbleH, setBubbleH] = useState(240);
	const bubble = useRef<HTMLDivElement>(null);
	/** L'étape de jeu quand on a demandé de choisir une action : on attend une action jouée après. */
	const [mark, setMark] = useState(seq);
	const go = (s: Step) => {
		if (s === 'action') setMark(seq);
		setStep(s);
	};

	// Les étapes qui attendent une action du joueur.
	useEffect(() => {
		if ((step === 'action' || step === 'viser') && acted && seq !== mark) go('resultat');
		else if (step === 'deplacer' && (moved || (!canMove && !busy && phase === 'hero'))) go('action');
		else if (step === 'action' && aiming) go('viser');
		else if (step === 'viser' && !aiming && seq === mark) go('action');
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [step, moved, canMove, aiming, acted, seq, busy, phase, mark]);

	const intent = phase === 'intent';
	const shown: Step | 'intent' = intent && step !== 'fin' ? 'intent' : step;
	const visible = !busy;

	// Le projecteur suit l'élément éclairé (la mise en page bouge : on la relit à chaque image).
	useLayoutEffect(() => {
		if (!visible) return;
		const key = FOCUS[shown];
		let raf = 0;
		const read = () => {
			const el = key ? document.querySelector<HTMLElement>(`[data-tuto="${key}"]`) : null;
			const r = el?.getBoundingClientRect() ?? null;
			setRect((old) => (old && r && old.x === r.x && old.y === r.y && old.width === r.width && old.height === r.height ? old : r));
			const h = bubble.current?.offsetHeight;
			if (h) setBubbleH((old) => (old === h ? old : h));
			raf = requestAnimationFrame(read);
		};
		read();
		return () => cancelAnimationFrame(raf);
	}, [shown, visible]);

	// Une étape avec un bouton : il prend le focus (les étapes interactives laissent le joueur sur le plateau).
	useEffect(() => {
		if (!visible) return;
		bubble.current?.querySelector<HTMLButtonElement>('.tuto__next')?.focus();
	}, [shown, visible]);

	if (!visible) return null;

	const text: Record<Step | 'intent', { title: string; body: string; next?: string; stay?: boolean }> = {
		ordre: {
			title: 'Premier combat !',
			body: 'Je vais vous montrer comment on joue. En haut, la frise montre l’ordre de jeu : chacun a lancé un dé et ajouté son Initiative. Le plus rapide commence, et les monstres jouent à leur place dans la file.',
			next: 'Suivant',
		},
		actif: {
			title: `C’est au tour de ${actorName}`,
			body: 'Le héros qui joue a un jeton qui brille, et sa fiche est ouverte avec ses actions. Pendant son tour, il peut se déplacer, puis faire une action.',
			next: 'Suivant',
		},
		deplacer: {
			title: 'Se déplacer',
			body: 'Les cases vertes sont celles où tu peux aller. Touche une case verte, ou fais glisser ton jeton dessus. Ceux qui se battent au contact doivent être collés à leur cible ; ceux qui tirent ou lancent des sorts peuvent rester loin.',
			stay: true,
		},
		action: {
			title: 'Choisir une action',
			body: 'Voici les actions du héros. Le score à atteindre avec le dé est écrit sous chacune. Certaines, très puissantes, ne reviennent qu’« 1 tour sur 3 ». Une action en rouge ne peut pas servir maintenant (personne à portée : approche-toi). Choisis-en une !',
		},
		viser: {
			title: 'Viser',
			body: 'Les cibles possibles brillent sur le plateau, les autres s’effacent. Touche celle que tu veux. (Tu peux aussi revenir en arrière avec « Choisir une autre action ».)',
		},
		resultat: {
			title: 'Et voilà !',
			body: 'Chaque coup qui touche fait baisser la barre de vie, avec un gros chiffre : rouge pour les dégâts, vert pour les soins. Un coup raté, ça arrive : le dé décide ! Quand une barre est vide, la créature est vaincue… ou le héros épuisé (personne ne meurt à Valombre).',
			next: 'Suivant',
		},
		monstres: {
			title: 'Le tour des monstres',
			body: `Les monstres attaquent celui qui les énerve le plus : celui qui leur fait mal (surtout avec un coup critique), qui soigne ou qui les entrave. Pendant leur tour, une flèche montre qui ils visent.${hasGuard ? ' Le guerrier peut alors se jeter devant un ami visé pour prendre les coups à sa place.' : ''} Certains préparent un sort : on le voit venir un tour à l’avance${spellComing ? ' (comme maintenant !)' : ''}, et on peut le couper ou s’écarter de la zone rouge.`,
			next: 'Suivant',
		},
		fin: {
			title: 'À vous de jouer !',
			body: 'Vous savez tout. Bonne chance, et soyez malins : le guerrier encaisse, le barde soigne, et on vise ensemble la même créature !',
			next: 'C’est parti !',
		},
		intent: {
			title: 'Les monstres vont attaquer',
			body: `Les flèches montrent qui chaque monstre va attaquer.${hasGuard ? ' Le guerrier peut se jeter devant un ami visé : touche le héros qui brille. Sinon, laisse les monstres attaquer.' : ' Touche « Laisser les monstres attaquer » quand tu es prêt.'}`,
		},
	};
	const t = text[shown];
	const order: Step[] = ['ordre', 'actif', 'deplacer', 'action', 'viser', 'resultat', 'monstres', 'fin'];
	const next = () => {
		if (step === 'fin') return onDone();
		go(order[order.indexOf(step) + 1]);
	};

	// La bulle, toujours entière dans l'écran : sous l'élément éclairé s'il y a la place, sinon au-dessus,
	// sinon posée sur le bas de l'élément (le plateau, souvent) ; au centre sans élément.
	const pad = 10;
	const gap = 16;
	const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
	const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
	const w = Math.min(380, vw - 32);
	const h = Math.min(bubbleH, vh - 2 * gap);
	let style: React.CSSProperties = { width: w, left: (vw - w) / 2, top: Math.max(gap, (vh - h) / 2) };
	if (rect) {
		const left = Math.max(gap, Math.min(vw - w - gap, rect.left + rect.width / 2 - w / 2));
		const below = rect.bottom + pad + gap;
		const above = rect.top - pad - gap - h;
		const top = below + h <= vh - gap ? below : above >= gap ? above : Math.min(vh - gap - h, Math.max(gap, rect.bottom - h - gap));
		style = { width: w, left, top };
	}
	style.maxHeight = vh - 2 * gap;

	return createPortal(
		<div className="tuto" aria-live="polite">
			<div
				className={`tuto__spot${rect ? '' : ' is-full'}`}
				style={rect ? { left: rect.left - pad, top: rect.top - pad, width: rect.width + 2 * pad, height: rect.height + 2 * pad } : undefined}
				aria-hidden="true"
			/>
			<div ref={bubble} className="tuto__bubble card" role="dialog" aria-modal="false" aria-labelledby="tuto-title" style={style}>
				<p className="tuto__step" aria-hidden="true">
					Tutoriel · {Math.min(order.indexOf(step) + 1, order.length)}/{order.length}
				</p>
				<h2 id="tuto-title" className="tuto__title">
					{t.title}
				</h2>
				<p className="tuto__body">{t.body}</p>
				<div className="tuto__actions">
					{t.next ? (
						<button type="button" className="btn tuto__next" onClick={next}>
							{t.next}
						</button>
					) : null}
					{t.stay ? (
						<button type="button" className="btn btn--ghost tuto__next" onClick={() => go('action')}>
							Je reste ici
						</button>
					) : null}
					{step !== 'fin' ? (
						<button type="button" className="btn btn--ghost btn--small tuto__skip" onClick={onDone}>
							Passer le tutoriel
						</button>
					) : null}
				</div>
			</div>
		</div>,
		document.body,
	);
}
