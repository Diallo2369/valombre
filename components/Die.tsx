'use client';

import { useEffect, useState } from 'react';

const PIPS: Record<number, [number, number][]> = {
	1: [[1, 1]],
	2: [[0, 0], [2, 2]],
	3: [[0, 0], [1, 1], [2, 2]],
	4: [[0, 0], [0, 2], [2, 0], [2, 2]],
	5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
	6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

interface Props {
	value: number | null;
	/** Pendant le lancer, le dé affiche des faces au hasard. */
	rolling?: boolean;
	size?: number;
	tone?: 'neutral' | 'good' | 'bad';
}

/** Dé à 6 faces dessiné en SVG. */
export function Die({ value, rolling = false, size = 88, tone = 'neutral' }: Props) {
	const [face, setFace] = useState<number>(value ?? 1);

	useEffect(() => {
		if (!rolling) {
			if (value) setFace(value);
			return;
		}
		const t = window.setInterval(() => setFace(1 + Math.floor(Math.random() * 6)), 70);
		return () => window.clearInterval(t);
	}, [rolling, value]);

	const pips = value === null && !rolling ? [] : PIPS[face];
	return (
		<svg
			className={`die die--${tone}${rolling ? ' die--rolling' : ''}`}
			width={size}
			height={size}
			viewBox="0 0 100 100"
			role="img"
			aria-label={value && !rolling ? `Dé : ${value}` : 'Dé'}
		>
			<rect x="4" y="4" width="92" height="92" rx="20" className="die__face" />
			{value === null && !rolling ? (
				<text x="50" y="64" textAnchor="middle" className="die__q">
					?
				</text>
			) : null}
			{pips.map(([r, c], i) => (
				<circle key={i} cx={25 + c * 25} cy={25 + r * 25} r="8.5" className="die__pip" />
			))}
		</svg>
	);
}

/** Petite attente « suspense » pendant le lancer, puis le résultat. */
export function rollWithSuspense(onDone: (value: number) => void, ms = 900) {
	const value = 1 + Math.floor(Math.random() * 6);
	window.setTimeout(() => onDone(value), ms);
}
