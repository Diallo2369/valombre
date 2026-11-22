import Link from 'next/link';
import { redirect } from 'next/navigation';
import { COMMON_MEDIA } from '@/campaigns';
import { MediaView } from '@/components/MediaView';
import { SiteHeader } from '@/components/SiteHeader';
import { currentUser } from '@/lib/auth';
import { scanMedia } from '@/lib/media';

export default function HomePage() {
	const user = currentUser();
	if (user) redirect('/portail');
	const media = scanMedia('commun', COMMON_MEDIA);

	return (
		<>
			<SiteHeader user={null} />
			<main className="home">
				<section className="home__hero">
					<MediaView className="home__bg" media={media} image="img-portail" alt="" />
					<div className="home__content container">
						<p className="home__eyebrow">Jeu de rôle familial</p>
						<h1 className="home__title">Valombre</h1>
						<p className="home__lead">
							Une vallée noyée de brume, une auberge au coin du feu, des héros tirés aux dés.
							<br />
							Le conteur raconte, les personnages parlent, et c’est toute la famille qui décide.
						</p>
						<div className="home__cta">
							<Link className="btn" href="/inscription">
								Créer notre table
							</Link>
							<Link className="btn btn--ghost" href="/connexion">
								J’ai déjà un compte
							</Link>
						</div>
					</div>
				</section>

				<section className="home__features container">
					<article className="card">
						<h2>🎲 Des héros aux dés</h2>
						<p>Chaque joueur crée son personnage en lançant les dés : guerrier, rôdeur, mage ou barde. Les fiches sont gardées d’une campagne à l’autre.</p>
					</article>
					<article className="card">
						<h2>🗣 Des personnages qui parlent</h2>
						<p>L’aubergiste bourrue, le vieux cartographe, la petite créature de brume… chacun a sa voix. Vous répondez en choisissant parmi des propositions.</p>
					</article>
					<article className="card">
						<h2>🧭 Libres, mais pas perdus</h2>
						<p>Sortez de l’auberge, explorez le village, poussez jusqu’à la forêt… Une tempête ou une cloche vous ramènera toujours vers l’histoire.</p>
					</article>
				</section>
			</main>
		</>
	);
}
