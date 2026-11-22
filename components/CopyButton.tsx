'use client';

import { useState } from 'react';

export function CopyButton({ text, label = 'Copier le prompt' }: { text: string; label?: string }) {
	const [done, setDone] = useState(false);
	return (
		<button
			type="button"
			className="btn btn--small btn--ghost"
			onClick={async () => {
				try {
					await navigator.clipboard.writeText(text);
					setDone(true);
					window.setTimeout(() => setDone(false), 1500);
				} catch {
					/* presse-papiers refusé : l'utilisateur peut sélectionner le texte à la main */
				}
			}}
		>
			{done ? '✓ Copié' : label}
		</button>
	);
}
