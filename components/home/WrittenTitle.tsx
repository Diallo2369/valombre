/**
 * Le titre qui s'écrit à la plume : le contour des lettres se trace, puis elles se remplissent et s'illuminent.
 * Le texte reste lisible par les lecteurs d'écran (le dessin est décoratif).
 */
export function WrittenTitle({ text, className }: { text: string; className?: string }) {
	return (
		<h1 className={['written-title', className].filter(Boolean).join(' ')}>
			<span className="visually-hidden">{text}</span>
			<svg className="written-title__svg" viewBox="0 0 1000 200" aria-hidden="true" focusable="false">
				<text className="written-title__text" x="500" y="150" textAnchor="middle" textLength="960" lengthAdjust="spacingAndGlyphs">
					{text}
				</text>
			</svg>
		</h1>
	);
}
