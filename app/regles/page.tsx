import { SiteHeader } from '@/components/SiteHeader';
import { CLASS_LIST, DIFFICULTY, STATS } from '@/engine/rules';
import { currentUser } from '@/lib/auth';

export const metadata = { title: 'Règles du jeu' };

export default function RulesPage() {
	const user = currentUser();
	return (
		<>
			<SiteHeader user={user} />
			<main className="container rules">
				<h1>Comment on joue ?</h1>
				<p className="rules__lead">
					Un jeu de rôle, c’est une histoire qu’on raconte ensemble. Le conteur (c’est le jeu) décrit ce qui se passe et fait parler les
					personnages. Vous, vous êtes les héros : vous décidez de ce qu’ils font.
				</p>

				<section className="card rules__block">
					<h2>1. Les cinq caractéristiques</h2>
					<p>Chaque héros a cinq talents, notés avec un chiffre. Plus le chiffre est grand, plus le héros est doué.</p>
					<ul className="rules__stats">
						{STATS.map((s) => (
							<li key={s.key}>
								<strong>{s.label}</strong> — {s.hint}
							</li>
						))}
					</ul>
					<p>
						À la création, on lance <strong>un dé pour chaque caractéristique</strong>. Un 1 compte comme un 2. Ensuite, la classe donne ses
						bonus (par exemple +2 en Endurance pour le guerrier), et on peut échanger deux caractéristiques une fois. Les points de vie
						valent 6 + l’Endurance, plus le bonus de la classe.
					</p>
				</section>

				<section className="card rules__block">
					<h2>2. Tenter quelque chose de difficile</h2>
					<p>
						Quand un choix porte le symbole 🎲, il faut faire un <strong>test</strong>. Le groupe choisit qui essaie, puis ce héros lance
						un dé et ajoute sa caractéristique.
					</p>
					<ul className="rules__diff">
						{Object.values(DIFFICULTY).map((d) => (
							<li key={d.label}>
								<strong>{d.label}</strong> : il faut faire {d.target} ou plus
							</li>
						))}
					</ul>
					<p>
						Un <strong>6 sur le dé réussit toujours</strong>. Un échec n’est jamais la fin de l’histoire : il arrive juste autre chose,
						parfois même de très drôle.
					</p>
				</section>

				<section className="card rules__block">
					<h2>3. Les combats</h2>
					<p>
						Au début, chacun lance l’<strong>initiative</strong> (un dé + l’Agilité) : on joue dans cet ordre, le monstre à sa place.
						À son tour, chaque héros choisit une action de sa classe : un coup, un tir, un sort… Si c’est réussi, le monstre perd un ou
						plusieurs cœurs ♥. Quand vient son tour, le monstre attaque un héros. L’<strong>armure</strong> prend les coups avant les points
						de vie, et elle est réparée à chaque nouveau combat. On peut parfois parler ou s’enfuir au lieu de se battre.
					</p>
					<p>
						<strong>Personne ne meurt à Valombre.</strong> À 0 PV, un héros est épuisé : il ne peut plus agir jusqu’à ce qu’on le soigne
						(potion, chant du barde, repos). Si tout le groupe est épuisé, quelqu’un vient vous secourir.
					</p>
				</section>

				<section className="card rules__block">
					<h2>4. Les classes et leurs pouvoirs</h2>
					<p>Chaque pouvoir s’utilise une fois, puis se recharge quand le groupe se repose.</p>
					<ul className="rules__classes">
						{CLASS_LIST.map((c) => (
							<li key={c.id}>
								<strong>{c.name}</strong> ({c.tagline}) — <em>{c.power.name}</em> : {c.power.text}
							</li>
						))}
					</ul>
				</section>

				<section className="card rules__block">
					<h2>5. Explorer librement</h2>
					<p>
						Vous pouvez sortir de l’auberge, fouiller le village, aller jusqu’à la forêt… Mais si vous vous éloignez trop pendant la nuit,
						il se passera quelque chose (une tempête, une cloche, des hurlements) qui vous ramènera à l’abri. Profitez-en pour découvrir les
						quêtes secondaires : elles donnent des objets et des amis très utiles pour la suite.
					</p>
				</section>

				<section className="card rules__block rules__parents">
					<h2>Pour les parents</h2>
					<ul>
						<li>
							<strong>Le porte-parole tourne</strong> : à chaque choix, le jeu désigne un joueur qui décide pour le groupe, après en avoir
							discuté. Ça évite que le plus rapide décide de tout.
						</li>
						<li>
							<strong>Les vrais dés</strong> : dans les réglages ⚙︎, cochez « On lance de vrais dés ». Les enfants adorent lancer pour de
							vrai, et vous saisissez le résultat.
						</li>
						<li>
							<strong>Lisez à voix haute</strong> si la voix du navigateur vous semble trop robotique : coupez-la dans les réglages, et faites
							le conteur vous-même en imitant les personnages.
						</li>
						<li>
							<strong>Sauvegarde automatique</strong> : à chaque choix. Une séance de 45 minutes à 1 heure suffit largement avec des
							enfants ; vous reprendrez exactement où vous étiez.
						</li>
						<li>
							<strong>Clavier</strong> : les touches 1 à 9 choisissent une réponse, Échap ferme une fenêtre.
						</li>
					</ul>
				</section>
			</main>
		</>
	);
}
