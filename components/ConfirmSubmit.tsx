'use client';

/** Bouton d'envoi de formulaire qui demande confirmation avant une action qu'on ne peut pas annuler. */
export function ConfirmSubmit({ message, className, children }: { message: string; className?: string; children: React.ReactNode }) {
	return (
		<button
			type="submit"
			className={className}
			onClick={(e) => {
				if (!window.confirm(message)) e.preventDefault();
			}}
		>
			{children}
		</button>
	);
}
