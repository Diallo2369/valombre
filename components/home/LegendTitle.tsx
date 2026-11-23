/**
 * Le titre façon cinématique de jeu : des lettres d'or métallique qui arrivent grandes et floues, se resserrent
 * avec un éclat, puis un reflet de lumière passe dessus une fois ; un trait d'or s'ouvre dessous.
 * Animations et réglage « réduire les animations » : voir .legend-title dans _pages.scss.
 */
export function LegendTitle({ text, className }: { text: string; className?: string }) {
	return (
		<h1 className={['legend-title', className].filter(Boolean).join(' ')}>
			<span className="legend-title__word" data-text={text}>
				{text}
			</span>
			<span className="legend-title__rule" aria-hidden="true">
				<span className="legend-title__gem" />
			</span>
		</h1>
	);
}
