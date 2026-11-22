'use client';

export function PrintButton() {
	return (
		<button type="button" className="btn btn--small" onClick={() => window.print()}>
			🖨 Imprimer
		</button>
	);
}
