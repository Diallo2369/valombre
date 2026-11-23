import type { Choice, Scene } from '@/engine/types';
import { CLUES } from './bible';

/**
 * CHAPITRE 1 — Une nuit au Chaudron Fêlé (intérieur de l'auberge)
 * Pivot : `salle-commune`. Tout ramène ici.
 */

/** Les scènes de l'auberge proposent aussi les choix de la salle commune : parler à quelqu'un d'autre, sortir… */
const AUTOUR = 'salle-commune';

/** Examiner une amulette : proposé à l'étal et juste après l'achat. */
const EXAMINER_AMULETTE: Choice = {
	label: 'Examiner une amulette de près',
	if: [{ notFlag: 'amulette-fausse' }],
	check: {
		stat: 'esprit',
		difficulty: 'moyen',
		success: {
			to: 'gaspard-fausse',
			effects: [{ setFlag: 'amulette-fausse' }, { quest: 'q-gaspard', status: 'active' }],
		},
		failure: {
			to: 'gaspard',
			text: 'Ça a l’air d’une vraie amulette… enfin, vous croyez.',
		},
	},
};

export const CH1_AUBERGE: Scene[] = [
	/* ---------------------------------------------------------------- */
	{
		id: 'intro',
		place: 'route',
		title: 'La route dans la brume',
		chapter: 1,
		zone: 'route',
		media: { image: 'img-route-brume', video: 'vid-intro', music: 'mus-route', ambience: 'amb-pluie-route' },
		lines: [
			{
				who: 'narrateur',
				text: 'Il pleut depuis le matin. Vous marchez depuis des heures sur la route de Combeloup, un petit village perdu au fond de la vallée de Valombre.',
			},
			{
				who: 'narrateur',
				text: 'Le soir tombe, et avec lui monte la brume. Une brume grise, épaisse, qui colle aux bottes et avale les arbres un par un. Les gens d’ici l’appellent « la Grise ».',
			},
			{
				who: 'narrateur',
				text: 'Tout en haut de la colline, une fenêtre jaune brille comme une promesse : une auberge ! Mais dans la brume, juste à côté du chemin… vous avez l’impression que quelque chose vous regarde.',
			},
		],
		choices: [
			{ label: 'Courir jusqu’à l’auberge sans se retourner', to: 'auberge-porte' },
			{
				label: 'Avancer prudemment en observant la brume',
				check: {
					stat: 'esprit',
					difficulty: 'facile',
					success: {
						to: 'auberge-porte',
						text: 'Vous apercevez deux petits yeux bleus et ronds, au ras du sol. Ils clignent… et disparaissent avec un minuscule ricanement.',
						effects: [{ setFlag: 'vu-brumelin' }],
					},
					failure: {
						to: 'auberge-porte',
						text: 'Vous plissez les yeux… et vous mettez le pied en plein dans une flaque glacée ! Rien à voir à part de la brume.',
					},
				},
			},
		],
	},

	/* ---------------------------------------------------------------- */
	{
		id: 'auberge-porte',
		place: 'porte',
		title: 'Le Chaudron Fêlé',
		chapter: 1,
		zone: 'route',
		media: { image: 'img-auberge-porte', music: 'mus-route', ambience: 'amb-pluie-route' },
		lines: [
			{
				who: 'narrateur',
				text: 'Au-dessus d’une grosse porte de chêne se balance une enseigne en fer : un chaudron fendu d’où s’échappe une fumée peinte. « Le Chaudron Fêlé ».',
			},
			{
				who: 'narrateur',
				text: 'Vous frappez. Un œil apparaît par le judas, puis la porte s’ouvre d’un coup sur une femme aux bras ronds comme des jambons.',
			},
			{
				who: 'berthe',
				text: 'Entrez, entrez, malheureux ! Avant que la Grise vous avale tout crus ! Essuyez vos pieds… non, laissez tomber, entrez !',
			},
		],
		choices: [
			{ label: 'Entrer vite dans l’auberge', to: 'salle-arrivee' },
			{ label: 'Se retourner une dernière fois vers la brume', to: 'dernier-regard' },
		],
	},
	{
		id: 'dernier-regard',
		place: 'porte',
		title: 'Un dernier regard',
		chapter: 1,
		zone: 'route',
		media: { image: 'img-auberge-porte', music: 'mus-route', ambience: 'amb-pluie-route' },
		note: 'Fil des yeux bleus (vu-brumelin) : le geste fait ici change la rencontre avec Pff dans la cave.',
		lines: [
			{ who: 'narrateur', text: 'Vous vous retournez. La brume a avalé la route, les arbres, la colline. Tout est gris.' },
			{ who: 'narrateur', text: 'Et puis, tout près du sol, deux petits yeux bleus et ronds s’allument. Ils vous regardent sans cligner. Ce n’est pas un chat : c’est bien trop bleu pour un chat.' },
			{ who: 'narrateur', text: 'Encore eux ! Les yeux de tout à l’heure, sur le chemin.', if: [{ flag: 'vu-brumelin' }] },
			{ who: 'berthe', text: 'Qu’est-ce que vous fabriquez ? Vous voulez que la Grise vous mange ? Entrez, j’ai dit !' },
		],
		onEnter: [{ setFlag: 'vu-brumelin' }],
		choices: [
			{
				label: 'Faire un petit signe de la main aux yeux bleus',
				to: 'salle-arrivee',
				text: 'Les yeux clignent… et un minuscule « pff ! » répond, comme un rire étouffé. Puis plus rien. Vous entrez, un sourire aux lèvres.',
				effects: [{ setFlag: 'brumelin-salue' }],
			},
			{
				label: 'Lancer un bout de pain vers la brume',
				to: 'salle-arrivee',
				text: 'Le pain disparaît dans la brume. On entend croquer, puis un tout petit « merci ! » avec une voix de bouilloire. Berthe vous tire à l’intérieur par la manche.',
				effects: [{ setFlag: 'pain-brumelin' }],
			},
			{ label: 'Entrer vite, sans se retourner cette fois', to: 'salle-arrivee' },
		],
	},

	/* ---------------------------------------------------------------- */
	{
		id: 'salle-arrivee',
		place: 'salle-commune',
		title: 'Une soirée qui tourne mal',
		transition: false,
		chapter: 1,
		zone: 'auberge',
		media: { image: 'img-salle-commune', video: 'vid-aubin-entre', music: 'mus-auberge', ambience: 'amb-taverne', sfx: ['sfx-porte'] },
		note: 'Scène d’exposition : présente tous les PNJ du pivot puis lance la quête principale.',
		lines: [
			{
				who: 'narrateur',
				text: 'Il fait chaud. Ça sent la soupe aux poireaux et le feu de bois. Une grande cheminée ronfle au fond de la salle.',
			},
			{
				who: 'narrateur',
				text: 'Près du feu, un très vieil homme aux yeux tout blancs caresse une carte posée sur ses genoux. Dans un coin, un soldat grisonnant souffle sur sa soupe. Et à une table couverte de breloques, un homme à la moustache fine vous fait un grand sourire.',
			},
			{ who: 'berthe', text: 'Moi c’est Berthe. Asseyez-vous. Une soupe pour chacun, c’est la maison qui offre : par ce temps, on ne fait pas payer les gens perdus.' },
			{ who: 'narrateur', text: 'BLAM ! La porte s’ouvre violemment. La pluie et la brume s’engouffrent. Un homme couvert de farine, une torche à la main, crie :' },
			{ who: 'aubin', text: 'Lisette ! Ma Lisette a disparu ! Quelqu’un a vu ma fille ? Elle était dans son lit, et maintenant sa fenêtre est ouverte !' },
			{ who: 'brac', text: 'Aubin, calme-toi. Personne ne sort cette nuit : c’est le couvre-feu. La Grise est trop épaisse. On cherchera à l’aube.' },
			{ who: 'aubin', text: 'À l’aube ? Mais elle a dix ans, Brac ! Dix ans !' },
			{ who: 'narrateur', text: 'Le meunier repart en courant dans la nuit. Un silence tombe sur la salle. Puis tous les regards se tournent… vers vous.' },
			{ who: 'berthe', text: 'Vous avez des épées et des bâtons, vous. Des têtes d’aventuriers. Vous allez l’aider, hein ?' },
		],
		onEnter: [{ quest: 'q-lisette', status: 'active' }],
		choices: [
			{ label: '« Bien sûr ! On va retrouver Lisette. »', to: 'salle-commune', effects: [{ setFlag: 'promesse-berthe' }] },
			{ label: '« D’abord la soupe… ensuite on aide ! »', to: 'salle-commune', effects: [{ heal: 'full' }] },
		],
	},

	/* ---------------------------------------------------------------- */
	{
		id: 'salle-commune',
		place: 'salle-commune',
		title: 'La salle commune',
		chapter: 1,
		zone: 'auberge',
		hub: true,
		media: { image: 'img-salle-commune', video: 'vid-salle-commune', music: 'mus-auberge', ambience: 'amb-taverne' },
		note: 'PIVOT DU CHAPITRE 1. Les lignes s’adaptent à ce que le groupe sait déjà.',
		lines: [
			{ who: 'narrateur', text: 'La salle commune du Chaudron Fêlé. Le feu crépite, la pluie frappe les carreaux.' },
			{
				who: 'narrateur',
				text: 'Pour retrouver Lisette, il faudrait des indices. Les gens d’ici savent peut-être quelque chose… et dehors, il y a la cour, le village, la forêt.',
				if: [{ notFlag: 'indice-lumiere' }, { notFlag: 'indice-legende' }, { notFlag: 'indice-gaspard' }, { notFlag: 'indice-pff' }, { notFlag: 'indice-vision' }],
			},
			{
				who: 'narrateur',
				text: 'Vous avez un premier indice. Encore un, et vous saurez où chercher.',
				if: [{ min: 1, of: CLUES }, { notFlag: 'pret-a-partir' }],
			},
			{ who: 'berthe', text: 'Vous en savez assez maintenant, non ? Moi, je dis qu’il faut y aller dès que le jour se lève.', if: [{ flag: 'pret-a-partir' }] },
		],
		onEnter: [{ setFlag: 'pret-a-partir', if: [{ min: 2, of: CLUES }] }],
		choices: [
			{ label: 'Parler à Berthe, l’aubergiste', to: 'berthe' },
			{ label: 'S’asseoir près du vieil homme aveugle', to: 'ossian' },
			{ label: 'Regarder l’étal du colporteur', to: 'gaspard', if: [{ notFlag: 'gaspard-parti' }] },
			{ label: 'Saluer le soldat grisonnant', to: 'brac' },
			{ label: 'Pousser la porte de la cuisine', to: 'cuisine' },
			{ label: 'Sortir dans la cour de l’auberge', to: 'cour' },
			{ label: 'Aller sur la place du village', to: 'place' },
			{ label: 'Monter se reposer à l’étage', to: 'repos' },
			{ label: '⭐ Partir à la recherche de Lisette dans le Bois-Noir', to: 'depart', if: [{ flag: 'pret-a-partir' }] },
		],
	},

	/* ---------------------------------------------------------------- */
	{
		id: 'berthe',
		place: 'salle-commune',
		title: 'Berthe Mâchefer',
		chapter: 1,
		zone: 'auberge',
		media: { image: 'img-salle-commune', music: 'mus-auberge', ambience: 'amb-taverne' },
		lines: [
			{ who: 'berthe', text: 'Qu’est-ce qu’il y a, mes poussins ? Encore faim ?', if: [{ visited: 'cuisine' }] },
			{ who: 'berthe', text: 'Ah, mes aventuriers ! Je vous écoute, mais faites vite, j’ai des rats qui me dévorent la cuisine.', if: [{ notVisited: 'cuisine' }] },
		],
		choices: [
			{ label: '« Parlez-nous de Lisette. »', to: 'berthe-lisette' },
			{ label: '« C’est quoi, cette brume ? »', to: 'berthe-brume' },
			{
				label: '« Des rats ? On peut vous aider ! »',
				to: 'cuisine',
				if: [{ quest: 'q-cave', status: 'none' }],
				effects: [{ quest: 'q-cave', status: 'active' }],
			},
			{
				label: '« Il nous faudrait des provisions pour la route. »',
				to: 'berthe',
				once: true,
				text: 'Berthe vous fourre une énorme saucisse fumée dans le sac : « On ne part jamais le ventre vide ! »', effects: [{ addItem: 'saucisse' }],
			},
		],
		next: AUTOUR,
	},
	{
		id: 'berthe-lisette',
		place: 'salle-commune',
		title: 'Berthe parle de Lisette',
		chapter: 1,
		zone: 'auberge',
		media: { image: 'img-salle-commune', music: 'mus-auberge', ambience: 'amb-taverne' },
		lines: [
			{
				who: 'berthe',
				text: 'Lisette ? Une petite futée, toujours fourrée avec mon neveu Tilo. Il garde les chevaux, dans l’écurie, au fond de la cour. Si quelqu’un sait quelque chose, c’est lui.',
			},
			{ who: 'berthe', text: 'Mais il ne parle pas facilement quand il a peur, le petit. Soyez gentils avec lui.' },
		],
		choices: [
			{ label: 'Aller voir Tilo à l’écurie', to: 'cour' },
			{ label: 'Poser une autre question', to: 'berthe' },
		],
	},
	{
		id: 'berthe-brume',
		place: 'salle-commune',
		title: 'Berthe parle de la Grise',
		chapter: 1,
		zone: 'auberge',
		media: { image: 'img-salle-commune', music: 'mus-mystere', ambience: 'amb-taverne' },
		lines: [
			{
				who: 'berthe',
				text: 'La Grise ? Elle a toujours été là, au fond des ravins. Mais depuis sept nuits, elle monte, elle monte… Chaque soir, quelque chose disparaît : une poule, un mouton, les lanternes qui s’éteignent toutes seules.',
			},
			{ who: 'berthe', text: 'Le vieil Ossian, là, près du feu, il dit que c’est à cause d’une vieille légende. Moi je dis que c’est à cause d’une mauvaise humeur du ciel.' },
		],
		choices: [
			{ label: 'Aller écouter Ossian', to: 'ossian' },
			{ label: 'Poser une autre question', to: 'berthe' },
		],
	},

	/* ---------------------------------------------------------------- */
	{
		id: 'ossian',
		place: 'salle-commune',
		title: 'Le vieil Ossian',
		chapter: 1,
		zone: 'auberge',
		media: { image: 'img-salle-commune', music: 'mus-mystere', ambience: 'amb-taverne' },
		onEnter: [{ setFlag: 'indice-legende', if: [{ flag: 'reve-dame' }] }],
		lines: [
			{ who: 'ossian', text: 'Des pas jeunes… et un peu mouillés. Asseyez-vous, voyageurs. Mes yeux ne voient plus rien, mais mes oreilles voient tout.', if: [{ notVisited: 'ossian-legende' }] },
			{ who: 'ossian', text: 'Ah, vous revoilà. Que puis-je pour vous ?', if: [{ visited: 'ossian-legende' }] },
			{ who: 'ossian', text: 'Vous sentez la brume… Vous avez dormi dedans, n’est-ce pas ? Et rêvé d’une dame qui chante, et d’un temple blanc ? Ce temple existe. C’est le Sanctuaire de l’Aube.', if: [{ flag: 'reve-dame' }, { notVisited: 'ossian-legende' }] },
		],
		choices: [
			{ label: '« Racontez-nous la légende de la Grise. »', to: 'ossian-legende' },
			{
				label: 'Lui montrer le fragment de carte du puits',
				to: 'ossian-carte',
				if: [{ item: 'fragment-carte' }],
			},
			{
				label: 'Lui faire toucher la pièce à la lanterne',
				to: 'ossian-piece',
				if: [{ item: 'piece-ancienne' }, { notVisited: 'ossian-piece' }],
			},
		],
		next: AUTOUR,
	},
	{
		id: 'ossian-legende',
		place: 'salle-commune',
		title: 'La légende de la Lanterne d’Aube',
		chapter: 1,
		zone: 'auberge',
		media: { image: 'img-salle-commune', music: 'mus-mystere', ambience: 'amb-taverne' },
		lines: [
			{ who: 'ossian', text: 'Il y a très longtemps, au cœur du Bois-Noir, se dressait le Sanctuaire de l’Aube. On y gardait une lanterne merveilleuse, la Lanterne d’Aube. Sa lumière repoussait la Grise tout au fond des ravins.' },
			{ who: 'ossian', text: 'Un jour, la flamme de la Lanterne a disparu. Personne ne sait comment. Mais au fond de la Lanterne restait son Cœur : une pierre dorée, qui brillait encore un peu. Assez pour tenir la Grise à distance.' },
			{ who: 'ossian', text: 'Et la gardienne du sanctuaire, la Dame Grise, veillait sur ce Cœur. On dit qu’elle s’endort quand la lumière s’éteint… et que ses feux-follets bleus vont chercher des enfants pour lui tenir compagnie dans son rêve.' },
			{ who: 'ossian', text: 'Si la Grise monte, c’est que quelqu’un a touché au Cœur. Et si la petite Lisette a disparu… cherchez du côté du sanctuaire. Au-delà du gué du Héron.' },
		],
		onEnter: [{ setFlag: 'indice-legende' }, { quest: 'q-coeur', status: 'active' }],
		choices: [
			{ label: '« Comment trouver ce sanctuaire ? »', to: 'ossian-chemin' },
		],
		next: AUTOUR,
	},
	{
		id: 'ossian-chemin',
		place: 'salle-commune',
		title: 'Le chemin du sanctuaire',
		chapter: 1,
		zone: 'auberge',
		media: { image: 'img-salle-commune', music: 'mus-mystere', ambience: 'amb-taverne' },
		lines: [
			{ who: 'ossian', text: 'Je dessinais les cartes de cette vallée, quand j’avais encore mes yeux. Le chemin passait par le gué du Héron, gardé par un esprit qui aime les énigmes.' },
			{ who: 'ossian', text: 'Ma vieille carte, je l’ai perdue il y a bien longtemps… Elle est tombée dans le puits de la place, figurez-vous. Si on la retrouvait, je pourrais vous montrer le sentier caché.' },
		],
		onEnter: [{ quest: 'q-puits', status: 'active', if: [{ notItem: 'fragment-carte' }, { notItem: 'carte-ossian' }] }],
		choices: [
			{
				label: 'Aller tout de suite voir le puits de la place',
				to: 'puits',
				if: [{ notFlag: 'puits-fini' }],
				text: 'Vous saluez le vieil Ossian et quittez l’auberge. Dehors, il pleut toujours, et la nuit est profonde. Sur la place, on devine à peine la forme du vieux puits.',
			},
		],
		next: AUTOUR,
	},
	{
		id: 'ossian-carte',
		place: 'salle-commune',
		title: 'Ossian complète la carte',
		chapter: 1,
		zone: 'auberge',
		media: { image: 'img-salle-commune', music: 'mus-mystere', ambience: 'amb-taverne' },
		lines: [
			{ who: 'ossian', text: 'Ma carte ! Je reconnais le cuir sous mes doigts… Donnez-moi une plume.' },
			{ who: 'narrateur', text: 'Les yeux fermés, le vieil homme trace des lignes fines au bord du fragment, sans jamais hésiter. Un sentier apparaît, qui contourne le ravin et mène tout droit au gué.' },
			{ who: 'ossian', text: 'Voilà. Ce sentier-là, personne ne le connaît. Il vous fera gagner une bonne heure.' },
			{ who: 'ossian', text: 'Et cette berceuse, dans le puits… vous l’avez entendue, vous aussi ? C’est la Dame Grise qui chante en dormant. L’eau du puits vient du Bois-Noir, elle ramène sa voix jusqu’ici.' },
			{ who: 'ossian', text: 'Méfiez-vous : sa chanson endort tous ceux qui l’écoutent. Dame Corvine, l’herboriste de la lisière, connaît des herbes qui tiennent éveillé. Allez la voir avant de partir.' },
			{ who: 'ossian', text: 'Un temple blanc et un loup de cendre, dites-vous ? Alors c’est bien le Sanctuaire de l’Aube. Et si la petite dort, c’est qu’on peut encore la réveiller.', if: [{ flag: 'vision-sanctuaire' }] },
		],
		onEnter: [{ removeItem: 'fragment-carte' }, { addItem: 'carte-ossian' }],
		next: AUTOUR,
	},
	{
		id: 'ossian-piece',
		place: 'salle-commune',
		title: 'La pièce à la lanterne',
		chapter: 1,
		zone: 'auberge',
		media: { image: 'img-salle-commune', music: 'mus-mystere', ambience: 'amb-taverne' },
		lines: [
			{ who: 'ossian', text: 'Une lanterne et des rayons… C’est une pièce du temps du sanctuaire ! On la donnait aux pèlerins. Gardez-la précieusement : la gardienne reconnaîtra que vous venez en amis.' },
		],
		onEnter: [{ setFlag: 'piece-reconnue' }, { xp: 1 }],
		next: AUTOUR,
	},

	/* ---------------------------------------------------------------- */
	{
		id: 'gaspard',
		place: 'salle-commune',
		title: 'L’étal de Gaspard',
		chapter: 1,
		zone: 'auberge',
		media: { image: 'img-salle-commune', music: 'mus-auberge', ambience: 'amb-taverne' },
		lines: [
			{ who: 'gaspard', text: 'Approchez, approchez, jeunes gens ! Gaspard Belle-Langue, pour vous servir ! Peignes en os, rubans de soie, et surtout… mes célèbres amulettes anti-brume ! Cinq pièces seulement !' },
			{ who: 'gaspard', text: 'Ah, vous encore… Vous ne voulez toujours pas d’amulette ?', if: [{ flag: 'gaspard-mefiant' }, { notFlag: 'coeur-force' }] },
			{ who: 'gaspard', text: 'Vous… Mon coffret a été ouvert, je le sais ! Si c’est vous qui avez la pierre… gardez-la. Elle me donne des cauchemars. Une dame grise qui pleure, toutes les nuits.', if: [{ flag: 'coeur-force' }, { notFlag: 'gaspard-avoue' }] },
		],
		choices: [
			{
				label: 'Acheter une amulette avec la bourse du groupe (5 pièces)',
				to: 'gaspard-achat',
				once: true,
				if: [{ gold: 5 }, { notItem: 'amulette' }],
				effects: [{ gold: -5 }, { addItem: 'amulette' }],
			},
			EXAMINER_AMULETTE,
			{
				label: '« Vous êtes arrivé quand, à Combeloup ? »',
				if: [{ notFlag: 'indice-gaspard' }],
				check: {
					stat: 'charme',
					difficulty: 'moyen',
					success: { to: 'gaspard-gaffe', effects: [{ setFlag: 'indice-gaspard' }] },
					failure: {
						to: 'gaspard',
						text: 'Gaspard éclate de rire et change de sujet : « Moi ? Je suis de partout et de nulle part ! Un ruban ? »',
					},
				},
			},
			{
				label: '« On a vu ce qu’il y a dans votre coffret. Expliquez-vous ! »',
				if: [{ flag: 'coffret-vu' }, { notFlag: 'gaspard-avoue' }],
				check: {
					stat: 'charme',
					difficulty: 'moyen',
					success: { to: 'gaspard-avoue' },
					failure: { to: 'gaspard-nie' },
				},
			},
		],
		next: AUTOUR,
	},
	{
		id: 'gaspard-achat',
		place: 'salle-commune',
		title: 'Une amulette anti-brume',
		chapter: 1,
		zone: 'auberge',
		media: { image: 'img-salle-commune', music: 'mus-auberge', ambience: 'amb-taverne', sfx: ['sfx-objet'] },
		lines: [
			{ who: 'gaspard', text: 'Excellent choix ! Portez-la autour du cou, et la Grise n’osera plus vous approcher. Garanti sur facture ! Enfin… sans facture.' },
			{ who: 'narrateur', text: 'Vous comptez cinq pièces dans la bourse du groupe. Gaspard vous passe l’amulette : un pendentif doré au bout d’une ficelle. Elle rejoint votre sac, avec le reste de vos affaires.' },
			{ who: 'narrateur', text: 'Elle est drôlement légère, pour une amulette magique. Et Gaspard a rangé l’argent bien vite…' },
		],
		choices: [EXAMINER_AMULETTE, { label: '« On va la montrer au sergent Brac. »', to: 'brac' }],
		next: AUTOUR,
	},
	{
		id: 'gaspard-fausse',
		place: 'salle-commune',
		title: 'Une drôle d’amulette',
		chapter: 1,
		zone: 'auberge',
		media: { image: 'img-salle-commune', music: 'mus-auberge', ambience: 'amb-taverne' },
		lines: [
			{ who: 'narrateur', text: 'En grattant un peu avec l’ongle, la peinture dorée s’écaille : dessous, c’est un vulgaire caillou de rivière ! Ces amulettes ne protègent de rien du tout.' },
			{ who: 'gaspard', text: 'Ahem… C’est… c’est la protection qui s’use, voilà. Normal. Très normal.' },
		],
		choices: [
			{ label: '« Le sergent Brac va adorer cette histoire… »', to: 'brac' },
		],
		next: AUTOUR,
	},
	{
		id: 'gaspard-gaffe',
		place: 'salle-commune',
		title: 'Gaspard parle trop',
		chapter: 1,
		zone: 'auberge',
		media: { image: 'img-salle-commune', music: 'mus-tension', ambience: 'amb-taverne' },
		lines: [
			{ who: 'gaspard', text: 'Il y a sept jours ! Je suis passé par le Bois-Noir, un raccourci. Des ruines magnifiques, et là, sur une sorte d’autel, j’ai trouvé une pierre qui brillait comme un…' },
			{ who: 'gaspard', text: '…euh. Comme un rien du tout. Je n’ai rien trouvé. Je n’ai rien dit. Il fait chaud ici, non ?' },
			{ who: 'narrateur', text: 'Sept jours. Exactement le jour où la Grise a commencé à monter…' },
		],
		next: AUTOUR,
	},
	{
		id: 'gaspard-avoue',
		place: 'salle-commune',
		title: 'Gaspard avoue tout',
		chapter: 1,
		zone: 'auberge',
		media: { image: 'img-salle-commune', music: 'mus-mystere', ambience: 'amb-taverne' },
		lines: [
			{ who: 'gaspard', text: 'D’accord, d’accord ! Je l’ai prise, cette pierre. Elle était si belle… Je me disais qu’un riche seigneur me l’achèterait une fortune.' },
			{ who: 'gaspard', text: 'Mais depuis, je fais des cauchemars. Une dame toute grise qui pleure. Tenez, prenez-la. Je n’en veux plus. Et… dites à la petite que je suis désolé.' },
			{ who: 'narrateur', text: 'Il vous tend un petit coffret. Dedans, une pierre dorée, tiède comme une main, qui bat tout doucement. Le Cœur de l’Aube.' },
		],
		onEnter: [
			{ addItem: 'coeur-aube' },
			{ setFlag: 'gaspard-avoue' },
			{ setFlag: 'indice-gaspard' },
			{ quest: 'q-gaspard', status: 'done' },
		],
		next: AUTOUR,
	},
	{
		id: 'gaspard-nie',
		place: 'salle-commune',
		title: 'Gaspard nie tout',
		chapter: 1,
		zone: 'auberge',
		media: { image: 'img-salle-commune', music: 'mus-tension', ambience: 'amb-taverne' },
		lines: [
			{ who: 'gaspard', text: 'Un coffret ? Quel coffret ? Vous avez rêvé, mes jeunes amis. C’est la brume, ça donne des visions.' },
			{ who: 'narrateur', text: 'Il serre sa besace contre lui et jette des coups d’œil inquiets vers la porte. Il ne vous lâchera rien comme ça… mais vous savez où regarder.' },
		],
		onEnter: [{ setFlag: 'gaspard-mefiant' }],
		next: AUTOUR,
	},

	/* ---------------------------------------------------------------- */
	{
		id: 'brac',
		place: 'salle-commune',
		title: 'Le sergent Brac',
		chapter: 1,
		zone: 'auberge',
		media: { image: 'img-salle-commune', music: 'mus-auberge', ambience: 'amb-taverne' },
		lines: [
			{ who: 'brac', text: 'Hmpf. Des aventuriers. Écoutez-moi bien : personne ne va dans le Bois-Noir cette nuit. La cour et la place, à la rigueur. Mais si je vous attrape à la lisière, je vous ramène par les oreilles.' },
			{
				who: 'brac',
				text: 'Quoi, des cailloux peints ? Ce Gaspard… Je l’ai à l’œil depuis qu’il est arrivé. Mais un caillou peint, ce n’est pas un crime. Trouvez-moi mieux que ça.',
				if: [{ flag: 'amulette-fausse' }],
			},
		],
		choices: [
			{ label: '« Vous avez une idée de ce qui est arrivé à Lisette ? »', to: 'brac-lisette' },
			{ label: 'Lui parler de la berceuse du puits', to: 'brac-berceuse', if: [{ visited: 'puits' }, { notVisited: 'brac-berceuse' }] },
		],
		next: AUTOUR,
	},
	{
		id: 'brac-lisette',
		place: 'salle-commune',
		title: 'Brac se confie',
		chapter: 1,
		zone: 'auberge',
		media: { image: 'img-salle-commune', music: 'mus-mystere', ambience: 'amb-taverne' },
		lines: [
			{ who: 'brac', text: 'Quand j’étais gamin, mon petit frère a suivi une lumière bleue dans la forêt. On l’a retrouvé le lendemain, endormi au pied d’un arbre, en pleine forme. Il disait qu’une dame triste lui avait chanté des chansons.' },
			{ who: 'brac', text: 'C’est pour ça que je veux attendre l’aube. Mais… si vous trouvez quelque chose de sûr, je ne vous retiendrai pas.' },
		],
		next: AUTOUR,
	},
	{
		id: 'brac-berceuse',
		place: 'salle-commune',
		title: 'La chanson du frère de Brac',
		chapter: 1,
		zone: 'auberge',
		media: { image: 'img-salle-commune', music: 'mus-mystere', ambience: 'amb-taverne' },
		note: 'Fil de la berceuse : relie le puits, le frère de Brac et la Dame Grise. Brac devient un allié (il ne vous retiendra plus de force).',
		lines: [
			{ who: 'narrateur', text: 'Vous fredonnez les quelques notes entendues au fond du puits. Le sergent repose lentement sa cuillère.' },
			{ who: 'brac', text: 'Cette chanson… Mon petit frère la chantonnait encore des semaines après. Celle de la dame triste, dans la forêt.' },
			{ who: 'brac', text: 'Si elle chante de nouveau, c’est qu’elle a pris la petite. Et qu’elle ne lui fera pas de mal. Mon frère est revenu, lui.' },
			{ who: 'brac', text: 'Bon. Je ne vais pas vous retenir de force. Mais ne vous perdez pas dans la Grise : elle endort ceux qui traînent.' },
		],
		onEnter: [{ setFlag: 'brac-allie' }, { xp: 1 }],
		choices: [{ label: '« Merci, sergent. On fera attention. »', to: 'salle-commune' }],
		next: AUTOUR,
	},

	/* ---------------------------------------------------------------- */
	{
		id: 'cuisine',
		place: 'cuisine',
		title: 'La cuisine de Berthe',
		chapter: 1,
		zone: 'auberge',
		media: { image: 'img-cuisine', music: 'mus-auberge', ambience: 'amb-cuisine', sfx: ['sfx-rats'] },
		lines: [
			{ who: 'narrateur', text: 'La cuisine est un fouillis de marmites en cuivre et de saucisses pendues. Deux rats filent entre vos jambes et disparaissent sous un buffet.' },
			{ who: 'berthe', text: 'Vous voyez ? Ils sortent de la cave, là, par la trappe. Ça fait trois nuits qu’ils ont peur de quelque chose, en bas. Moi je n’y descends plus.', if: [{ quest: 'q-cave', status: 'active' }] },
			{ who: 'narrateur', text: 'Tout est calme maintenant. Berthe chantonne en remuant sa soupe.', if: [{ quest: 'q-cave', status: 'done' }] },
		],
		onEnter: [{ quest: 'q-cave', status: 'active' }],
		choices: [
			{ label: 'Soulever la trappe et descendre à la cave', to: 'cave', if: [{ quest: 'q-cave', status: 'active' }] },
			{ label: 'Chiper un morceau de pain', to: 'cuisine', once: true, text: 'Le pain est encore tiède. Miam.', effects: [{ heal: 1 }] },
		],
		next: AUTOUR,
	},
	{
		id: 'cave',
		place: 'cave',
		title: 'La cave qui grince',
		chapter: 1,
		zone: 'auberge',
		media: { image: 'img-cave', music: 'mus-tension', ambience: 'amb-cave' },
		lines: [
			{ who: 'narrateur', text: 'L’escalier de bois craque sous vos pieds. En bas, il fait froid et humide. Les tonneaux font des ombres bizarres.' },
			{ who: 'narrateur', text: 'Au fond, un tonneau couché tremble tout seul. Et il en sort… de la brume ? Et un tout petit reniflement.' },
		],
		choices: [
			{
				label: 'S’approcher sans faire de bruit',
				check: {
					stat: 'agilite',
					difficulty: 'moyen',
					success: { to: 'cave-tonneau', text: 'Pas un craquement. Vous arrivez juste à côté du tonneau.' },
					failure: {
						to: 'combat-pff',
						text: 'CRAC ! Une marche cède. La chose dans le tonneau pousse un cri aigu et vous saute dessus !',
					},
				},
			},
			{ label: 'Foncer et renverser le tonneau !', to: 'combat-pff' },
			{ label: 'Remonter vite fait', to: 'cuisine' },
		],
	},
	{
		id: 'cave-tonneau',
		place: 'cave',
		title: 'Dans le tonneau',
		chapter: 1,
		zone: 'auberge',
		media: { image: 'img-pff', music: 'mus-mystere', ambience: 'amb-cave' },
		lines: [
			{ who: 'narrateur', text: 'Dans le tonneau, roulée en boule, il y a une petite créature de brume grise, grande comme un chat, avec d’immenses yeux bleus tout mouillés.' },
			{ who: 'pff', text: 'Pff ! Pff pas méchant ! Pff perdu ! Pas taper Pff !' },
			{ who: 'narrateur', text: 'Ces deux grands yeux bleus… Ce sont ceux qui vous regardaient dans la brume, au bord de la route !', if: [{ flag: 'vu-brumelin' }] },
			{ who: 'pff', text: 'Grand gentil a fait coucou à Pff ! Pff se souvient !', if: [{ flag: 'brumelin-salue' }] },
			{ who: 'pff', text: 'Pain ! Vous êtes pain ! Pain était bon. Pff a encore faim…', if: [{ flag: 'pain-brumelin' }] },
		],
		choices: [
			{
				label: 'Lui parler doucement',
				check: {
					stat: 'charme',
					difficulty: 'facile',
					success: { to: 'pff-ami' },
					failure: { to: 'pff-fuit', text: 'Vous tendez la main un peu trop vite. Pff prend peur !' },
				},
			},
			{
				label: 'Lui offrir la saucisse de Berthe',
				to: 'pff-ami',
				if: [{ item: 'saucisse' }],
				text: 'Pff engloutit la saucisse d’un coup. Elle était plus grosse que lui !', effects: [{ removeItem: 'saucisse' }],
			},
			{
				label: 'Lui rappeler le bout de pain de la route',
				to: 'pff-ami',
				if: [{ flag: 'pain-brumelin' }],
				text: 'Pff écarquille les yeux, puis bondit hors du tonneau en battant des mains. Plus besoin de discuter : vous êtes ses amis.',
			},
			{
				label: 'Lui refaire un petit signe de la main',
				to: 'pff-ami',
				if: [{ flag: 'brumelin-salue' }],
				text: 'Pff vous répond par un petit signe, tout content. Il sort du tonneau sans plus trembler.',
			},
			{ label: 'Le chasser de la cave', to: 'combat-pff' },
		],
	},
	{
		id: 'combat-pff',
		place: 'cave',
		title: 'La bestiole de la cave',
		chapter: 1,
		zone: 'auberge',
		media: { image: 'img-pff', music: 'mus-combat', ambience: 'amb-cave', sfx: ['sfx-ricanement'] },
		lines: [{ who: 'narrateur', text: 'Une petite boule de brume rebondit de tonneau en tonneau en sifflant comme une bouilloire ! Elle est rapide !' }],
		combat: {
			enemy: { name: 'la boule de brume', hearts: 14, difficulty: 'facile', damage: 4, move: 3, brume: true, image: 'img-pff', attack: 'La boule de brume rebondit de tonneau en tonneau et vous fonce dessus en sifflant !' },
			victory: {
				to: 'pff-chasse',
				effects: [{ quest: 'q-cave', status: 'done' }],
			},
			defeat: { to: 'pff-chasse', effects: [{ quest: 'q-cave', status: 'done' }, { heal: 2 }] },
			talk: {
				label: 'Crier « Stop ! On ne te veut pas de mal ! »',
				stat: 'charme',
				difficulty: 'moyen',
				outcome: { to: 'pff-ami' },
			},
		},
	},
	{
		id: 'pff-chasse',
		place: 'cave',
		title: 'La cave est libre',
		chapter: 1,
		zone: 'auberge',
		media: { image: 'img-cave', music: 'mus-auberge', ambience: 'amb-cave' },
		lines: [
			{ who: 'narrateur', text: 'La petite créature file par le soupirail en laissant derrière elle un filet de brume. Les rats, eux, reviennent tranquillement grignoter leurs miettes à leur place.' },
			{ who: 'berthe', text: 'Plus un couinement ! Vous êtes des champions ! Tenez, une potion de ma grand-mère, ça peut toujours servir.' },
		],
		onEnter: [{ addItem: 'potion' }, { setFlag: 'pff-chasse' }],
		next: AUTOUR,
	},
	{
		id: 'pff-fuit',
		place: 'cave',
		title: 'Pff s’enfuit',
		chapter: 1,
		zone: 'auberge',
		media: { image: 'img-cave', music: 'mus-auberge', ambience: 'amb-cave' },
		lines: [
			{ who: 'narrateur', text: 'Pff bondit hors du tonneau et disparaît par le soupirail en couinant. Les rats reviennent à leur place, rassurés.' },
			{ who: 'narrateur', text: 'Dommage : il avait l’air de vouloir dire quelque chose…' },
		],
		onEnter: [{ quest: 'q-cave', status: 'done' }, { addItem: 'potion' }],
		next: AUTOUR,
	},
	{
		id: 'pff-ami',
		place: 'cave',
		title: 'Un nouvel ami',
		chapter: 1,
		zone: 'auberge',
		media: { image: 'img-pff', music: 'mus-mystere', ambience: 'amb-cave' },
		note: 'Récompense de la gentillesse : Pff devient un compagnon, compte comme un indice et ouvre un raccourci au chapitre 2.',
		lines: [
			{ who: 'pff', text: 'Gentils ! Gentils grands ! Pff s’appelle Pff. Pff vient de la forêt. Pff perdu à cause de la Grise trop grande.' },
			{ who: 'pff', text: 'Grande Dame Grise triste. Très triste. Quelqu’un a volé sa pierre qui brille. Alors elle dort, et la Grise déborde partout, et Pff tombe dans tonneau.' },
			{ who: 'pff', text: 'Pff connaît chemin secret sous les racines ! Pff vient avec vous ? Oui ? Oui !' },
			{ who: 'pff', text: 'Sur la route, c’était Pff ! Pff vous a suivis jusqu’ici. Pff a eu peur de la grosse dame à la porte, alors Pff est passé par le soupirail.', if: [{ flag: 'vu-brumelin' }] },
			{ who: 'narrateur', text: 'Sans attendre la réponse, Pff saute dans votre sac et ne laisse dépasser que ses deux oreilles.' },
		],
		onEnter: [{ setFlag: 'pff-ami' }, { setFlag: 'indice-pff' }, { quest: 'q-cave', status: 'done' }],
		next: AUTOUR,
	},

	/* ---------------------------------------------------------------- */
	{
		id: 'repos',
		place: 'chambre',
		title: 'Une chambre à l’étage',
		chapter: 1,
		zone: 'auberge',
		media: { image: 'img-repos', music: 'mus-mystere', ambience: 'amb-pluie-route' },
		lines: [
			{ who: 'narrateur', text: 'Berthe vous a préparé une chambre sous les toits. Les lits sentent la lavande. Vous dormez quelques heures, d’un sommeil sans rêves.' },
			{ who: 'narrateur', text: 'Quand vous redescendez, il fait encore nuit, et la brume colle toujours aux carreaux.', if: [{ notFlag: 'pret-a-partir' }] },
			{ who: 'narrateur', text: 'Par la fenêtre, le ciel commence à pâlir. Bientôt l’aube… le moment de partir ?', if: [{ flag: 'pret-a-partir' }] },
		],
		onEnter: [{ rest: true }],
		next: AUTOUR,
	},
];
