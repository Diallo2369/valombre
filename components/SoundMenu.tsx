'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { Prefs } from '@/lib/prefs';
import { VolumeControls } from './Drawers';

/**
 * Bouton « 🔊 Son » de la barre de jeu : ouvre un petit panneau de volumes (voix, musique,
 * ambiance, bruitages) qui agit en direct, sans quitter la partie.
 * Motif « disclosure » : bouton aria-expanded, Échap ou un clic ailleurs referme.
 */
export function SoundMenu({ prefs, onChange }: { prefs: Prefs; onChange: (p: Prefs) => void }) {
	const [open, setOpen] = useState(false);
	const id = useId();
	const root = useRef<HTMLDivElement>(null);
	const button = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (!open) return;
		root.current?.querySelector<HTMLElement>('input')?.focus();
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== 'Escape') return;
			setOpen(false);
			button.current?.focus();
		};
		const onClick = (e: MouseEvent) => {
			if (!root.current?.contains(e.target as Node)) setOpen(false);
		};
		window.addEventListener('keydown', onKey);
		window.addEventListener('mousedown', onClick);
		return () => {
			window.removeEventListener('keydown', onKey);
			window.removeEventListener('mousedown', onClick);
		};
	}, [open]);

	return (
		<div className="sound-menu" ref={root}>
			<button
				ref={button}
				type="button"
				className="btn btn--small btn--ghost"
				aria-expanded={open}
				aria-controls={id}
				onClick={() => setOpen((o) => !o)}
			>
				{prefs.audio.muted ? '🔇' : '🔊'} Son
			</button>
			<div id={id} className="sound-menu__panel" hidden={!open}>
				<p className="sound-menu__title">Volumes</p>
				<VolumeControls prefs={prefs} onChange={onChange} />
			</div>
		</div>
	);
}
