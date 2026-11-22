import Link from 'next/link';
import { logoutAction } from '@/app/actions/auth';
import type { User } from '@/lib/auth';

export function SiteHeader({ user }: { user: User | null }) {
	return (
		<header className="site-header">
			<Link href={user ? '/portail' : '/'} className="site-header__brand">
				VALOMBRE
			</Link>
			<nav className="site-header__nav" aria-label="Navigation principale">
				<Link href="/regles">Règles du jeu</Link>
				{user ? (
					<>
						<Link href="/portail">Portail</Link>
						<Link href="/atelier">Atelier</Link>
						<form action={logoutAction}>
							<button type="submit" className="btn btn--small btn--ghost">
								Quitter ({user.displayName})
							</button>
						</form>
					</>
				) : (
					<>
						<Link href="/connexion">Connexion</Link>
						<Link className="btn btn--small" href="/inscription">
							Créer un compte
						</Link>
					</>
				)}
			</nav>
		</header>
	);
}
