import type { Choice, Scene } from '@/engine/types';

/**
 * CHAPITRE 1 — Dehors : cour, village, lisière.
 * Ces zones sont « en laisse » (voir bible.ts / ZONES) : au bout de quelques scènes,
 * un rappel (cloche, tempête, sergent Brac, loups) ramène le groupe à la salle commune.
 * Les scènes de récompense sont marquées `noRecall` pour ne jamais couper un moment fort.
 */

const AUBERGE = { label: 'Rentrer à l’auberge', to: 'salle-commune' };

/** Proposé depuis le puits et depuis l'écho, dès que le groupe a la corde d'Aubin. */
const DESCENDRE_DANS_LE_PUITS: Choice = {
	label: 'Descendre avec la corde d’Aubin',
	if: [{ item: 'corde' }],
	check: {
		stat: 'force',
		difficulty: 'moyen',
		success: { to: 'fond-puits', text: 'Main après main, vous descendez dans le noir. Plouf ! Vos pieds touchent l’eau.' },
		failure: {
			to: 'fond-puits',
			text: 'La corde glisse un peu vite… PLOUF ! Vous arrivez en bas, trempé jusqu’aux genoux.',
			effects: [{ damage: 1, target: 'random' }],
		},
	},
};

export const CH1_DEHORS: Scene[] = [
	/* ======================== LA COUR ======================== */
	{
		id: 'cour',
		place: 'cour',
		title: 'La cour de l’auberge',
		chapter: 1,
		zone: 'abords',
		media: { image: 'img-cour', music: 'mus-village-nuit', ambience: 'amb-cour' },
		lines: [
			{ who: 'narrateur', text: 'La pluie tambourine sur les pavés. À gauche, l’écurie, où brille une petite lanterne. Au milieu, la roulotte bariolée du colporteur, couverte d’une grande bâche.' },
			{ who: 'narrateur', text: 'Une lueur dorée passe par une fente de la bâche. Elle s’allume… s’éteint… s’allume… comme un cœur qui bat.', if: [{ notFlag: 'coffret-vu' }, { notItem: 'coeur-aube' }] },
		],
		choices: [
			{ label: 'Entrer dans l’écurie', to: 'ecurie' },
			{ label: 'Jeter un œil sous la bâche de la roulotte', to: 'roulotte', if: [{ notItem: 'coeur-aube' }] },
			{ label: 'Rejoindre la place du village', to: 'place' },
			AUBERGE,
		],
	},
	{
		id: 'ecurie',
		place: 'ecurie',
		title: 'L’écurie',
		chapter: 1,
		zone: 'abords',
		media: { image: 'img-ecurie', music: 'mus-village-nuit', ambience: 'amb-ecurie' },
		lines: [
			{ who: 'narrateur', text: 'Il fait chaud dans l’écurie. Une jument pommelée mâchonne son foin. Assis sur une botte de paille, un garçon roux renifle très fort en faisant semblant de ne pas pleurer.', if: [{ notFlag: 'indice-lumiere' }] },
			{ who: 'tilo', text: 'Vous êtes qui, vous ? Vous venez pour Lisette ?', if: [{ notFlag: 'indice-lumiere' }] },
			{ who: 'tilo', text: 'Vous l’avez trouvée ? Non ? Alors dépêchez-vous !', if: [{ flag: 'indice-lumiere' }] },
			{ who: 'narrateur', text: 'Au-dessus de vous, dans le grenier à foin, quelque chose fait « miaou ».', if: [{ notItem: 'minuit' }, { notFlag: 'minuit-rendu' }] },
		],
		onEnter: [],
		choices: [
			{
				label: '« On est là pour t’aider, Tilo. Raconte-nous. »',
				if: [{ notFlag: 'indice-lumiere' }],
				check: {
					stat: 'charme',
					difficulty: 'facile',
					success: { to: 'tilo-raconte' },
					failure: {
						to: 'tilo-boude',
						text: 'Tilo se renfrogne. Peut-être qu’il faut lui montrer que vous êtes sérieux…',
					},
				},
			},
			{ label: 'Grimper au grenier voir ce qui miaule', to: 'grenier', if: [{ notItem: 'minuit' }, { notFlag: 'minuit-rendu' }] },
		],
		next: 'cour',
	},
	{
		id: 'tilo-boude',
		place: 'ecurie',
		title: 'Tilo se méfie',
		chapter: 1,
		zone: 'abords',
		media: { image: 'img-ecurie', music: 'mus-village-nuit', ambience: 'amb-ecurie' },
		lines: [
			{ who: 'tilo', text: 'Tout le monde dit qu’il faut attendre l’aube. Même Brac. Pourquoi vous, vous feriez quelque chose ?' },
		],
		choices: [
			{ label: '« Parce qu’on a promis à Berthe ! »', to: 'tilo-raconte', if: [{ flag: 'promesse-berthe' }] },
			{
				label: 'Lui montrer qu’on est de vrais aventuriers (Force)',
				check: {
					stat: 'force',
					difficulty: 'facile',
					success: {
						to: 'tilo-raconte',
						text: 'Vous soulevez une botte de paille à bout de bras. Tilo ouvre de grands yeux.',
					},
					failure: { to: 'tilo-raconte', text: 'La botte de paille vous tombe sur la tête. Tilo éclate de rire… et ça le décoince.' },
				},
			},
			{ label: 'Le laisser tranquille pour l’instant', to: 'cour' },
		],
	},
	{
		id: 'tilo-raconte',
		place: 'ecurie',
		title: 'Le secret de Tilo',
		chapter: 1,
		zone: 'abords',
		noRecall: true,
		media: { image: 'img-ecurie', music: 'mus-mystere', ambience: 'amb-ecurie' },
		lines: [
			{ who: 'tilo', text: 'Ce soir, Lisette est venue me voir ici, en cachette. Elle m’a dit : « Tilo, regarde ! » Il y avait une petite lumière bleue, qui dansait dans la cour. Comme une luciole, mais plus grosse.' },
			{ who: 'tilo', text: 'Elle a dit « Elle est si jolie, je veux voir où elle va. » Je lui ai dit non ! Mais elle l’a suivie jusqu’à la lisière du Bois-Noir. Moi… moi j’ai eu peur, je suis resté.' },
			{ who: 'tilo', text: 'Tenez. C’est ma lanterne. Sa flamme ne s’éteint jamais, même dans la Grise. Ramenez-la, d’accord ? Et ramenez Lisette.' },
		],
		onEnter: [{ setFlag: 'indice-lumiere' }, { addItem: 'lanterne' }],
		choices: [
			{ label: '« Promis, Tilo. »', to: 'cour' },
			{ label: 'Grimper au grenier voir ce qui miaule', to: 'grenier', if: [{ notItem: 'minuit' }, { notFlag: 'minuit-rendu' }] },
		],
		next: 'cour',
	},
	{
		id: 'grenier',
		place: 'grenier',
		title: 'Le grenier à foin',
		chapter: 1,
		zone: 'abords',
		media: { image: 'img-grenier', music: 'mus-village-nuit', ambience: 'amb-ecurie', sfx: ['sfx-miaou'] },
		lines: [
			{ who: 'narrateur', text: 'En haut de l’échelle, sur une poutre, un chat noir aux yeux d’or fait le dos rond. Il a l’air coincé… et très vexé de l’être.' },
		],
		choices: [
			{
				label: 'Marcher sur la poutre pour l’attraper',
				check: {
					stat: 'agilite',
					difficulty: 'facile',
					success: {
						to: 'grenier-chat',
						text: 'Pas à pas, en équilibre… hop ! Vous attrapez le chat, qui se met aussitôt à ronronner.',
					},
					failure: {
						to: 'grenier-chat',
						text: 'Vous glissez et tombez dans le foin ! Le chat, curieux, saute sur votre ventre. Gagné… un peu par hasard.',
						effects: [{ damage: 1, target: 'random' }],
					},
				},
			},
			{
				label: 'L’appeler doucement : « Petit, petit… »',
				check: {
					stat: 'charme',
					difficulty: 'moyen',
					success: { to: 'grenier-chat', text: 'Le chat descend de sa poutre avec une grâce de roi et vient se frotter contre vos jambes.' },
					failure: { to: 'ecurie', text: 'Le chat vous regarde comme si vous étiez un navet. Il ne bouge pas.' },
				},
			},
			{ label: 'Redescendre', to: 'ecurie' },
		],
	},
	{
		id: 'grenier-chat',
		place: 'grenier',
		title: 'Un chat noir',
		chapter: 1,
		zone: 'abords',
		noRecall: true,
		media: { image: 'img-grenier', music: 'mus-village-nuit', ambience: 'amb-ecurie' },
		lines: [
			{ who: 'narrateur', text: 'Le chat porte un petit collier de cuir avec une plume de corbeau. Gravé dessus : « MINUIT — rendre à Corvine, la hutte de la lisière ».' },
			{ who: 'tilo', text: 'C’est le chat de la sorcière ! Enfin… de l’herboriste. Elle n’est pas méchante. Juste un peu… piquante.' },
		],
		onEnter: [{ addItem: 'minuit' }, { quest: 'q-minuit', status: 'active' }],
		choices: [{ label: 'Emmener Minuit chez Dame Corvine, à la lisière', to: 'hutte' }],
		next: 'cour',
	},
	{
		id: 'roulotte',
		place: 'roulotte',
		title: 'La roulotte de Gaspard',
		chapter: 1,
		zone: 'abords',
		media: { image: 'img-cour', music: 'mus-tension', ambience: 'amb-cour' },
		lines: [{ who: 'narrateur', text: 'La roulotte est couverte d’une bâche trempée. La fente lumineuse est juste là. Et si Gaspard regardait par la fenêtre de l’auberge ?' }],
		choices: [
			{
				label: 'Soulever la bâche discrètement',
				check: {
					stat: 'agilite',
					difficulty: 'moyen',
					success: { to: 'roulotte-dedans', effects: [{ setFlag: 'coffret-vu' }] },
					failure: { to: 'roulotte-surpris' },
				},
			},
			{ label: 'Laisser tomber', to: 'cour' },
		],
	},
	{
		id: 'roulotte-dedans',
		place: 'roulotte',
		title: 'Sous la bâche',
		chapter: 1,
		zone: 'abords',
		noRecall: true,
		media: { image: 'img-roulotte', music: 'mus-mystere', ambience: 'amb-cour' },
		lines: [
			{ who: 'narrateur', text: 'Des rubans, des peignes, des cailloux peints… et au fond, un petit coffret de bois fermé par un cadenas. C’est de là que vient la lumière dorée. Elle pulse doucement, comme si elle respirait.' },
		],
		onEnter: [{ setFlag: 'indice-gaspard' }],
		choices: [
			{
				label: 'Forcer le cadenas',
				check: {
					stat: 'force',
					difficulty: 'difficile',
					success: {
						to: 'roulotte-coeur',
					},
					failure: { to: 'cour', text: 'Le cadenas résiste. Il faudra plutôt faire parler Gaspard…' },
				},
			},
			{ label: 'Tout remettre en place et aller interroger Gaspard', to: 'gaspard' },
		],
	},
	{
		id: 'roulotte-coeur',
		place: 'roulotte',
		title: 'Le Cœur de l’Aube',
		chapter: 1,
		zone: 'abords',
		noRecall: true,
		media: { image: 'img-roulotte', music: 'mus-mystere', ambience: 'amb-cour', sfx: ['sfx-coffret'] },
		lines: [
			{ who: 'narrateur', text: 'Clac ! Le couvercle s’ouvre. Une pierre dorée, tiède comme une main, bat tout doucement dans la paille. Vous sentez que la brume autour de vous recule d’un pas.' },
			{ who: 'narrateur', text: 'Ce n’est pas un caillou ordinaire. C’est quelque chose de très ancien… et qui n’a rien à faire dans une roulotte.' },
		],
		onEnter: [{ addItem: 'coeur-aube' }, { setFlag: 'coeur-force' }],
		choices: [{ label: 'Montrer la pierre au vieil Ossian', to: 'ossian' }],
		next: 'cour',
	},
	{
		id: 'roulotte-surpris',
		place: 'cour',
		title: 'Pris la main dans la bâche',
		chapter: 1,
		zone: 'abords',
		media: { image: 'img-cour', music: 'mus-tension', ambience: 'amb-cour' },
		lines: [
			{ who: 'gaspard', text: 'Hé ! Pas touche à ma marchandise ! Bande de petits fouineurs ! Allez, ouste !' },
			{ who: 'narrateur', text: 'Gaspard resserre les cordes de sa bâche et rentre en grommelant. Il faudra être plus malin.' },
		],
		onEnter: [{ setFlag: 'gaspard-mefiant' }],
		next: 'cour',
	},

	/* ======================== LE VILLAGE ======================== */
	{
		id: 'place',
		place: 'place',
		title: 'La place de Combeloup',
		chapter: 1,
		zone: 'village',
		media: { image: 'img-place', music: 'mus-village-nuit', ambience: 'amb-village-nuit' },
		lines: [
			{ who: 'narrateur', text: 'Toutes les maisons ont fermé leurs volets. Au milieu de la place, il y a un vieux puits couvert d’un petit toit. Plus loin, la roue du moulin grince au bord du ruisseau. Un chemin de terre part vers la forêt.' },
			{ who: 'aubin', text: 'Lisette ! LISETTE !', if: [{ notVisited: 'aubin' }] },
			{ who: 'narrateur', text: 'Du puits monte une mélodie très douce, comme une berceuse.', if: [{ notFlag: 'puits-fini' }] },
		],
		choices: [
			{ label: 'Parler au meunier qui appelle sa fille', to: 'aubin' },
			{ label: 'Se pencher au-dessus du puits', to: 'puits', if: [{ notFlag: 'puits-fini' }] },
			{ label: 'Aller voir la chambre de Lisette, au moulin', to: 'moulin' },
			{ label: 'Prendre le chemin de la forêt', to: 'lisiere' },
			{ label: 'Retourner dans la cour de l’auberge', to: 'cour' },
			AUBERGE,
		],
	},
	{
		id: 'aubin',
		place: 'aubin',
		title: 'Aubin le meunier',
		chapter: 1,
		zone: 'village',
		media: { image: 'img-place', music: 'mus-mystere', ambience: 'amb-village-nuit' },
		lines: [
			{ who: 'aubin', text: 'Vous allez m’aider ? Merci… merci. Lisette a des nattes brunes et une écharpe rouge, elle ne la quitte jamais.' },
			{ who: 'aubin', text: 'Ces derniers jours, elle parlait de lumières bleues dans la forêt. Je croyais que c’étaient des histoires…' },
			{ who: 'aubin', text: 'Prenez ma corde. Elle vient du moulin, elle est solide. Avec la Grise, on ne sait jamais où on va devoir grimper.', if: [{ firstVisit: true }] },
		],
		onEnter: [{ addItem: 'corde', if: [{ firstVisit: true }] }],
		choices: [
			{
				label: 'Le réconforter',
				once: true,
				check: {
					stat: 'charme',
					difficulty: 'facile',
					success: {
						to: 'place',
						text: 'Aubin respire un grand coup et sourit un peu. « Vous avez raison. Elle est maligne, ma Lisette. »',
						effects: [{ xp: 1 }],
					},
					failure: { to: 'place', text: 'Aubin hoche la tête sans vous entendre vraiment. Il repart en criant le nom de sa fille.' },
				},
			},
		],
		next: 'place',
	},
	{
		id: 'moulin',
		place: 'moulin',
		title: 'La chambre de Lisette',
		chapter: 1,
		zone: 'village',
		media: { image: 'img-moulin', music: 'mus-mystere', ambience: 'amb-village-nuit' },
		lines: [
			{ who: 'narrateur', text: 'La chambre de Lisette est sous le toit du moulin. Le lit est défait. Une poupée de chiffon est tombée par terre. La fenêtre est grande ouverte.' },
			{ who: 'narrateur', text: 'Sur le plancher, une fine traînée de poussière bleue scintille. Elle va jusqu’à la fenêtre… et dehors, sur le chemin, elle continue vers la forêt.' },
		],
		choices: [
			{
				label: 'Examiner la poussière bleue',
				if: [{ notFlag: 'poussiere-vue' }],
				check: {
					stat: 'esprit',
					difficulty: 'moyen',
					success: {
						to: 'moulin',
						text: 'Elle est froide, et elle sent la pluie. Ce n’est pas de la poussière : c’est de la brume devenue lumière. Un feu-follet est passé par là.',
						effects: [{ setFlag: 'poussiere-vue' }, { setFlag: 'indice-lumiere' }],
					},
					failure: { to: 'moulin', text: 'Ça brille, c’est joli… et ça fait éternuer. Atchoum !', effects: [{ setFlag: 'poussiere-vue' }] },
				},
			},
			{ label: 'Suivre la traînée bleue vers la forêt', to: 'lisiere' },
			{ label: 'Revenir sur la place', to: 'place' },
		],
	},
	{
		id: 'puits',
		place: 'puits',
		title: 'Le vieux puits',
		chapter: 1,
		zone: 'village',
		media: { image: 'img-puits', music: 'mus-mystere', ambience: 'amb-puits' },
		lines: [
			{ who: 'narrateur', text: 'Vous vous penchez. Tout au fond, il y a une très faible lueur argentée. Et cette berceuse, qui monte, qui monte… Une voix de femme, triste et douce.' },
			{ who: 'narrateur', text: 'C’est bien trop profond pour sauter. Il faudrait une corde : le meunier, sur la place, en a sûrement une. Ou alors, très prudemment, s’agripper aux vieilles pierres…', if: [{ notItem: 'corde' }] },
		],
		onEnter: [{ quest: 'q-puits', status: 'active' }],
		choices: [
			DESCENDRE_DANS_LE_PUITS,
			{
				label: 'Descendre sans corde, en s’agrippant aux pierres',
				if: [{ notItem: 'corde' }],
				check: {
					stat: 'agilite',
					difficulty: 'difficile',
					success: { to: 'fond-puits', text: 'Une prise, puis une autre… les pierres sont glissantes, mais vous tenez bon. Plouf ! Vous voilà en bas.' },
					failure: {
						to: 'place',
						text: 'Votre pied glisse sur la mousse ! Vous vous rattrapez de justesse à la margelle et remontez, le cœur battant. Sans corde, c’est trop dangereux.',
						effects: [{ damage: 1, target: 'random' }],
					},
				},
			},
			{ label: '« Ohé ! Il y a quelqu’un ? »', to: 'puits-echo', if: [{ notVisited: 'puits-echo' }] },
			{ label: 'Revenir sur la place', to: 'place' },
		],
	},
	{
		id: 'puits-echo',
		place: 'puits',
		title: 'L’écho',
		chapter: 1,
		zone: 'village',
		media: { image: 'img-puits', music: 'mus-mystere', ambience: 'amb-puits' },
		lines: [
			{ who: 'narrateur', text: '« …quelqu’un… quelqu’un… » répond l’écho. Puis la berceuse reprend, comme si de rien n’était.' },
		],
		choices: [
			DESCENDRE_DANS_LE_PUITS,
		],
		next: 'place',
	},
	{
		id: 'fond-puits',
		place: 'fond-puits',
		title: 'Au fond du puits',
		chapter: 1,
		zone: 'village',
		noRecall: true,
		media: { image: 'img-fond-puits', music: 'mus-mystere', ambience: 'amb-puits', sfx: ['sfx-plouf'] },
		lines: [
			{ who: 'narrateur', text: 'L’eau vous arrive aux chevilles. Sur la paroi, une pierre est gravée d’une lanterne entourée de rayons. C’est elle qui brille faiblement.' },
			{ who: 'narrateur', text: 'Et la berceuse… elle sort de la pierre. Comme si quelqu’un chantait très loin, de l’autre côté de la vallée, et que l’eau ramenait sa voix jusqu’ici.' },
			{ who: 'narrateur', text: 'Dans une niche, derrière la pierre, vous trouvez une vieille pièce et un rouleau de cuir huilé.' },
			{ who: 'narrateur', text: 'Vous bâillez sans le vouloir. Puis encore une fois. Cette chanson donne terriblement sommeil… Mieux vaut ne pas rester là trop longtemps.' },
		],
		onEnter: [
			{ addItem: 'piece-ancienne' },
			{ addItem: 'fragment-carte' },
			{ gold: 3 },
			{ setFlag: 'puits-fini' },
			{ quest: 'q-puits', status: 'done' },
		],
		choices: [
			{ label: 'Coller l’oreille contre la pierre qui chante', to: 'puits-vision', if: [{ notFlag: 'vision-sanctuaire' }] },
			{
				label: 'Escalader les pierres glissantes',
				check: {
					stat: 'agilite',
					difficulty: 'facile',
					success: { to: 'place', text: 'De prise en prise, vous grimpez comme un chat. Vous voilà dehors, à peine mouillé.' },
					failure: {
						to: 'place',
						text: 'Votre pied dérape deux fois sur la mousse. Vous sortez enfin, trempé et un peu écorché.',
						effects: [{ damage: 1, target: 'random' }],
					},
				},
			},
			{
				label: 'Remonter à la force des bras',
				check: {
					stat: 'force',
					difficulty: 'facile',
					success: { to: 'place', text: 'Vous remontez à la force des bras. Ouf, l’air de la nuit !' },
					failure: {
						to: 'place',
						text: 'Vous glissez deux fois avant d’y arriver. Vous voilà dehors, couvert de mousse.',
						effects: [{ damage: 1, target: 'random' }],
					},
				},
			},
		],
	},
	{
		id: 'puits-vision',
		place: 'fond-puits',
		title: 'La vision dans l’eau',
		chapter: 1,
		zone: 'village',
		noRecall: true,
		media: { image: 'img-fond-puits', music: 'mus-mystere', musicNow: true, ambience: 'amb-puits' },
		note: 'Fil de la berceuse : la vision prépare le sanctuaire (temple blanc, cocon, loup de cendre) et compte comme un indice.',
		lines: [
			{ who: 'narrateur', text: 'La pierre est tiède contre votre joue. La berceuse devient plus nette… et vous comprenez les mots : « Dors, petite… dors… je ne serai plus seule… »' },
			{ who: 'narrateur', text: 'L’eau sous vos pieds se met à briller. Dedans, comme dans un miroir, une image apparaît : un temple de pierre blanche, au milieu d’une forêt noire.' },
			{ who: 'narrateur', text: 'Une petite fille aux nattes brunes y dort, roulée en boule dans un cocon de brume argentée. Au-dessus d’elle, une immense dame de brume chante, les yeux fermés.' },
			{ who: 'narrateur', text: 'Et sur les marches du temple, couché comme un chien de garde, un grand loup fait de cendre et de braises lève la tête… et vous regarde.' },
			{ who: 'narrateur', text: 'Plouf ! L’image se brouille. Il ne reste que l’eau froide et la berceuse. Mais maintenant, vous savez : Lisette est vivante. Elle dort, quelque part dans le Bois-Noir.' },
		],
		onEnter: [{ setFlag: 'vision-sanctuaire' }, { setFlag: 'indice-vision' }, { xp: 1 }],
		choices: [
			{
				label: 'Escalader les pierres glissantes',
				check: {
					stat: 'agilite',
					difficulty: 'facile',
					success: { to: 'place', text: 'De prise en prise, vous grimpez comme un chat. Vous voilà dehors, à peine mouillé.' },
					failure: {
						to: 'place',
						text: 'Votre pied dérape deux fois sur la mousse. Vous sortez enfin, trempé et un peu écorché.',
						effects: [{ damage: 1, target: 'random' }],
					},
				},
			},
			{
				label: 'Remonter à la force des bras',
				check: {
					stat: 'force',
					difficulty: 'facile',
					success: { to: 'place', text: 'Vous remontez à la force des bras. Ouf, l’air de la nuit !' },
					failure: {
						to: 'place',
						text: 'Vous glissez deux fois avant d’y arriver. Vous voilà dehors, couvert de mousse.',
						effects: [{ damage: 1, target: 'random' }],
					},
				},
			},
		],
	},

	/* ======================== LA LISIÈRE ======================== */
	{
		id: 'lisiere',
		place: 'lisiere',
		title: 'La lisière du Bois-Noir',
		chapter: 1,
		zone: 'lisiere',
		media: { image: 'img-lisiere', music: 'mus-mystere', ambience: 'amb-lisiere' },
		lines: [
			{ who: 'narrateur', text: 'Le chemin s’arrête devant un mur de troncs noirs. La brume sort d’entre les arbres comme un grand souffle froid. Tout au fond, une minuscule lumière bleue danse.' },
			{ who: 'narrateur', text: 'Sur la droite, une hutte au toit couvert d’herbes. Une lumière verte brille à la fenêtre.' },
		],
		choices: [
			{ label: 'Frapper à la porte de la hutte', to: 'hutte' },
			{ label: 'Entrer sous les arbres, vers la lumière bleue', to: 'sous-bois' },
			{ label: 'Revenir vers le village', to: 'place' },
		],
	},
	{
		id: 'hutte',
		noRecall: true,
		place: 'hutte',
		title: 'La hutte de Dame Corvine',
		chapter: 1,
		zone: 'lisiere',
		media: { image: 'img-hutte', music: 'mus-mystere', ambience: 'amb-lisiere' },
		lines: [
			{ who: 'corvine', text: 'Entrez donc, au lieu de laisser la Grise entrer avec vous. Vous cherchez la petite du meunier, je suppose. Tout le monde la cherche, et personne ne cherche mon chat.', if: [{ firstVisit: true }] },
			{ who: 'corvine', text: 'Vous revoilà. Avez-vous trouvé Minuit ?', if: [{ firstVisit: false }, { notFlag: 'minuit-rendu' }, { notItem: 'minuit' }] },
			{ who: 'corvine', text: 'Mais… c’est Minuit que j’entends ronronner dans votre sac ?', if: [{ item: 'minuit' }] },
			{ who: 'corvine', text: 'Mes amis ! Une tisane ?', if: [{ flag: 'minuit-rendu' }] },
		],
		onEnter: [{ quest: 'q-minuit', status: 'active' }],
		choices: [
			{ label: 'Rendre Minuit à Dame Corvine', to: 'hutte-minuit', if: [{ item: 'minuit' }] },
			{ label: '« Qu’est-ce que vous savez de la Grise ? »', to: 'hutte-savoir' },
			{ label: '« Où peut-il être, votre chat ? »', to: 'hutte', if: [{ notItem: 'minuit' }, { notFlag: 'minuit-rendu' }], once: true, who: 'corvine', text: 'Il adore les endroits chauds et hauts. Les greniers, les toits… Il déteste la pluie, cet idiot.' },
			{ label: 'Ressortir', to: 'lisiere' },
		],
		next: 'lisiere',
	},
	{
		id: 'hutte-minuit',
		place: 'hutte',
		title: 'Minuit est rentré',
		chapter: 1,
		zone: 'lisiere',
		noRecall: true,
		media: { image: 'img-hutte', music: 'mus-auberge', ambience: 'amb-lisiere', sfx: ['sfx-miaou'] },
		lines: [
			{ who: 'narrateur', text: 'Minuit saute du sac, s’étire, et va s’asseoir sur l’épaule de Corvine comme si de rien n’était.' },
			{ who: 'corvine', text: 'Vieux bandit. Je me suis fait un sang d’encre… Merci, mes enfants. Ça mérite un cadeau.' },
			{ who: 'corvine', text: 'Deux potions de sureau. Et ce sachet d’herbes de veille : menthe sauvage et ortie. Qui le respire ne peut pas s’endormir. Là où vous allez, croyez-moi, ça servira.' },
		],
		onEnter: [
			{ removeItem: 'minuit' },
			{ setFlag: 'minuit-rendu' },
			{ addItem: 'potion', qty: 2 },
			{ addItem: 'herbes-veille' },
			{ quest: 'q-minuit', status: 'done' },
		],
		choices: [
			{ label: '« Qu’est-ce que vous savez de la Grise ? »', to: 'hutte-savoir' },
			{ label: 'Ressortir', to: 'lisiere' },
		],
	},
	{
		id: 'hutte-savoir',
		noRecall: true,
		place: 'hutte',
		title: 'Ce que sait Corvine',
		chapter: 1,
		zone: 'lisiere',
		media: { image: 'img-hutte', music: 'mus-mystere', ambience: 'amb-lisiere' },
		lines: [
			{ who: 'corvine', text: 'La Grise endort ceux qui suivent ses feux-follets. Pas pour leur faire du mal : la Dame Grise a juste peur d’être seule dans son rêve. Mais un rêve trop long, ce n’est bon pour personne.' },
			{ who: 'corvine', text: 'Et devant son sanctuaire veille le Loup de Cendre. Il garde, il ne hait pas. Il est fait de feu éteint… Les loups comme lui aiment ce qui sent bon la maison et le foyer.' },
			{ who: 'corvine', text: 'Un conseil : ne partez pas de nuit. Attendez l’aube, et partez avec tout ce que vous aurez appris.' },
		],
		onEnter: [{ setFlag: 'conseil-loup' }],
		choices: [{ label: 'Rentrer au village, à la place', to: 'place' }],
		next: 'hutte',
	},
	{
		id: 'sous-bois',
		place: 'sous-bois',
		title: 'Sous les arbres',
		chapter: 1,
		zone: 'lisiere',
		media: { image: 'img-sous-bois-nuit', music: 'mus-tension', ambience: 'amb-lisiere', sfx: ['sfx-ricanement'] },
		note: 'Volontairement juste avant la limite de la laisse : un pas de plus et un rappel se déclenche.',
		lines: [
			{ who: 'narrateur', text: 'Il fait si noir que vous ne voyez plus vos pieds. La lumière bleue danse devant vous, toujours un peu trop loin.' },
			{ who: 'narrateur', text: 'Dans les racines, des petits yeux bleus s’ouvrent. Un, deux, cinq, dix… Quelqu’un ricane.' },
			{ who: 'narrateur', text: 'Heureusement, la lanterne de Tilo éclaire un peu le chemin.', if: [{ item: 'lanterne' }] },
		],
		choices: [
			{ label: 'Suivre la lumière bleue, plus profond', to: 'sous-bois-profond' },
			{
				label: 'Chercher des traces de Lisette',
				check: {
					stat: 'esprit',
					difficulty: 'moyen',
					success: {
						to: 'sous-bois',
						text: 'Accrochée à une ronce, une écharpe rouge ! Lisette est bien passée par ici.',
						effects: [{ addItem: 'echarpe-rouge' }, { setFlag: 'indice-lumiere' }],
					},
					failure: { to: 'sous-bois-profond', text: 'Rien… à part de la boue. Et la lumière bleue qui s’éloigne. Vous la suivez sans réfléchir.' },
				},
				if: [{ notItem: 'echarpe-rouge' }],
			},
			{ label: 'Faire demi-tour vers la lisière', to: 'lisiere' },
		],
	},
	{
		id: 'sous-bois-profond',
		place: 'sous-bois',
		title: 'Plus profond',
		chapter: 1,
		zone: 'lisiere',
		media: { image: 'img-sous-bois-nuit', music: 'mus-tension', ambience: 'amb-lisiere' },
		lines: [
			{ who: 'narrateur', text: 'Les arbres se resserrent. La brume vous arrive à la taille. La lumière bleue s’arrête… se retourne… et file comme une flèche vers le cœur de la forêt.' },
			{ who: 'narrateur', text: 'Vous comprenez qu’il est impossible d’aller plus loin cette nuit. Il faudra revenir de jour, préparés.' },
		],
		next: 'lisiere',
	},

	/* ======================== RAPPELS ======================== */
	{
		id: 'rappel-cloche',
		place: 'dehors',
		title: 'La cloche de Berthe',
		chapter: 1,
		zone: 'village',
		noRecall: true,
		media: { image: 'img-cour', music: 'mus-auberge', ambience: 'amb-cour', sfx: ['sfx-cloche'] },
		lines: [
			{ who: 'narrateur', text: 'DING ! DING ! DING ! Une cloche résonne dans toute la vallée. C’est Berthe, sur le pas de sa porte, qui secoue la cloche de la cour de toutes ses forces.' },
			{ who: 'berthe', text: 'Mes aventuriers ! Rentrez tout de suite ! La Grise épaissit, on n’y voit plus à trois pas ! Et la soupe va refroidir !' },
			{ who: 'narrateur', text: 'Elle a raison : la brume est si épaisse que vous avez du mal à retrouver le chemin. Vous suivez le son de la cloche jusqu’à l’auberge.' },
		],
		choices: [
			{ label: 'Rentrer au chaud près du feu', to: 'salle-commune', effects: [{ heal: 1 }] },
			{ label: 'Rentrer et aller tout droit voir Berthe', to: 'berthe' },
			{
				label: 'Faire la sourde oreille et s’enfoncer dans la brume',
				to: 'brume-perdus',
				text: 'Vous tournez le dos à la cloche et vous enfoncez dans la brume, entre les maisons endormies.',
			},
		],
	},
	{
		id: 'rappel-tempete',
		place: 'dehors',
		title: 'La tempête se lève',
		chapter: 1,
		zone: 'village',
		noRecall: true,
		media: { image: 'img-tempete', video: 'vid-tempete', music: 'mus-tension', ambience: 'amb-tempete', sfx: ['sfx-tonnerre'] },
		lines: [
			{ who: 'narrateur', text: 'CRAAAC ! Un éclair déchire le ciel. Le vent se lève d’un coup, la pluie tombe à l’horizontale, les volets claquent dans tout le village.' },
			{ who: 'narrateur', text: 'Une enseigne arrachée passe en sifflant au-dessus de vos têtes ! Il faut se mettre à l’abri, vite !' },
		],
		choices: [
			{
				label: 'Courir jusqu’à l’auberge !',
				check: {
					stat: 'agilite',
					difficulty: 'facile',
					success: { to: 'salle-commune', text: 'Vous zigzaguez entre les flaques et plongez à l’intérieur juste avant la grosse averse.' },
					failure: {
						to: 'salle-commune',
						text: 'Une branche vous fouette au passage. Vous arrivez à l’auberge trempés et décoiffés.',
						effects: [{ damage: 1, target: 'random' }],
					},
				},
			},
			{
				label: 'S’abriter au moulin, plus proche',
				to: 'moulin',
				text: 'Vous poussez la porte du moulin juste avant l’averse. La grande roue grince dans le vent.',
			},
			{
				label: 'Se tenir par la main et avancer ensemble',
				to: 'salle-commune',
				text: 'Lentement mais sûrement, en file indienne, vous rejoignez l’auberge sans perdre personne.',
			},
		],
	},
	{
		id: 'rappel-brac',
		place: 'dehors',
		title: 'Le sergent Brac',
		chapter: 1,
		zone: 'village',
		noRecall: true,
		media: { image: 'img-place', music: 'mus-village-nuit', ambience: 'amb-village-nuit' },
		lines: [
			{ who: 'narrateur', text: 'Une torche surgit de la brume. Derrière, une moustache en brosse et un casque cabossé.' },
			{ who: 'brac', text: 'Je vous avais prévenus : couvre-feu ! On n’y voit plus rien. Allez, tout le monde à l’auberge, et pas de discussion.' },
			{ who: 'brac', text: '…Bon. Vous avez du cran, je vous l’accorde. À l’aube, je ne vous retiendrai pas.', if: [{ flag: 'pret-a-partir' }] },
			{ who: 'brac', text: 'Ah, c’est vous… Bon. Je vous ai promis de ne pas vous retenir. Mais si vous allez vers la forêt, ouvrez l’œil.', if: [{ flag: 'brac-allie' }] },
		],
		choices: [
			{ label: 'Suivre le sergent jusqu’à l’auberge', to: 'salle-commune' },
			{ label: '« Sergent, vous savez quelque chose sur Lisette ? »', to: 'brac-lisette' },
			{ label: 'Le saluer et continuer vers la forêt', to: 'fuite-foret', if: [{ flag: 'brac-allie' }] },
			{
				label: 'Filer dans la brume avant qu’il vous attrape',
				if: [{ notFlag: 'brac-allie' }],
				check: {
					stat: 'agilite',
					difficulty: 'moyen',
					success: { to: 'fuite-foret', text: 'Vous plongez dans la brume. « Revenez ici, petits garnements ! » La torche de Brac devient un point, puis plus rien.' },
					failure: {
						to: 'salle-commune',
						text: 'Une grosse main vous attrape par le col. « Pas si vite ! » Brac vous ramène à l’auberge, un par un, en ronchonnant.',
					},
				},
			},
		],
	},
	{
		id: 'fuite-foret',
		place: 'lisiere',
		title: 'Dans la brume, vers la forêt',
		chapter: 1,
		zone: 'lisiere',
		noRecall: true,
		media: { image: 'img-lisiere', music: 'mus-tension', ambience: 'amb-lisiere' },
		note: 'Refus d’un rappel : la liberté a un prix (la nuit, la brume) mais ouvre la ronde des brumelins.',
		lines: [
			{ who: 'narrateur', text: 'Vous courez jusqu’à ne plus entendre le village. Autour de vous, il n’y a plus que la brume, et les troncs noirs de la lisière qui sortent de la nuit.' },
			{ who: 'narrateur', text: 'Et là, entre les arbres… des petites lumières bleues tournent en rond. On entend des rires, et une chanson. La berceuse du puits !' },
		],
		choices: [
			{ label: 'S’approcher sans bruit des lumières', to: 'ronde-brumelins' },
			{ label: 'Frapper chez l’herboriste pour se mettre à l’abri', to: 'hutte' },
			{ label: 'Rentrer au village, finalement', to: 'place' },
		],
	},
	{
		id: 'brume-perdus',
		place: 'brume',
		title: 'Perdus dans la Grise',
		chapter: 1,
		zone: 'village',
		noRecall: true,
		media: { image: 'img-place', music: 'mus-mystere', ambience: 'amb-village-nuit' },
		note: 'Refus de la cloche : la brume endort ceux qui traînent (fil de la berceuse).',
		lines: [
			{ who: 'narrateur', text: 'La cloche sonne toujours, mais de plus en plus loin. La brume est si épaisse que vous ne voyez plus vos mains.' },
			{ who: 'narrateur', text: 'Une petite lumière bleue apparaît devant vous. Elle danse, recule, revient… comme si elle vous attendait. Et tout doucement, quelqu’un fredonne la berceuse.' },
			{ who: 'narrateur', text: 'Vous bâillez. Vos jambes deviennent lourdes. Il ferait si bon s’allonger là, juste une minute…' },
		],
		choices: [
			{
				label: 'Suivre la lumière bleue sans s’endormir',
				check: {
					stat: 'esprit',
					difficulty: 'moyen',
					success: { to: 'ronde-brumelins', text: 'Vous vous pincez les joues et suivez la lumière. Elle vous mène jusqu’aux arbres noirs de la lisière.' },
					failure: { to: 'brume-sommeil', text: 'Vos paupières se ferment. Juste une minute… juste une…' },
				},
			},
			{ label: 'Suivre le son de la cloche, vite !', to: 'salle-commune', text: 'DING… DING… Vous finissez par tomber sur la porte de l’auberge. Ouf !' },
		],
	},
	{
		id: 'brume-sommeil',
		place: 'salle-commune',
		title: 'Réveillés par Brac',
		transition: false,
		chapter: 1,
		zone: 'auberge',
		noRecall: true,
		media: { image: 'img-salle-commune', music: 'mus-auberge', ambience: 'amb-taverne' },
		lines: [
			{ who: 'narrateur', text: 'Quelqu’un vous secoue l’épaule. Vous ouvrez les yeux : vous êtes assis près du feu de l’auberge, enroulés dans une couverture.' },
			{ who: 'brac', text: 'Endormis en plein milieu de la place, comme des marmottes ! Voilà ce que fait la Grise à ceux qui traînent dedans. Vous avez eu de la chance que je passe.' },
			{ who: 'narrateur', text: 'Dans votre rêve, une dame chantait. Vous vous souvenez encore de l’air… et d’un temple blanc, très loin dans la forêt.' },
		],
		onEnter: [{ setFlag: 'reve-dame' }],
		choices: [
			{ label: 'Raconter ce rêve au vieil Ossian', to: 'ossian' },
			{ label: '« Merci, sergent. » Et se réchauffer près du feu', to: 'salle-commune', effects: [{ heal: 1 }] },
		],
		next: 'salle-commune',
	},
	{
		id: 'ronde-brumelins',
		place: 'ronde',
		title: 'La ronde des brumelins',
		chapter: 1,
		zone: 'lisiere',
		noRecall: true,
		media: { image: 'img-brumelins', music: 'mus-mystere', musicNow: true, ambience: 'amb-lisiere' },
		note: 'Récompense des refus de rappel : l’écharpe de Lisette (indice), et la berceuse chantée par les brumelins.',
		lines: [
			{ who: 'narrateur', text: 'Cachés derrière un tronc, vous les voyez enfin : une dizaine de brumelins dansent en rond autour d’un feu-follet bleu, en chantant la berceuse avec leurs petites voix de bouilloire.' },
			{ who: 'narrateur', text: 'Au milieu de la ronde, posée sur un champignon comme un trésor, il y a une écharpe rouge. L’écharpe de Lisette !', if: [{ notItem: 'echarpe-rouge' }] },
			{ who: 'narrateur', text: 'Au milieu de la ronde, posé sur un champignon comme un trésor, il y a un petit ruban bleu. Un ruban du colporteur, sans doute « emprunté ».', if: [{ item: 'echarpe-rouge' }] },
			{ who: 'narrateur', text: 'Le feu-follet s’élève, puis file vers le cœur de la forêt. Les brumelins le suivent des yeux en soupirant : « La Dame… la Dame dort… »' },
		],
		choices: [
			{
				label: 'Bondir et attraper l’écharpe',
				if: [{ notItem: 'echarpe-rouge' }],
				check: {
					stat: 'agilite',
					difficulty: 'moyen',
					success: {
						to: 'lisiere',
						text: 'Hop ! Vous attrapez l’écharpe au vol. Les brumelins s’éparpillent en sifflant comme des bouilloires.',
						effects: [{ addItem: 'echarpe-rouge' }, { setFlag: 'indice-lumiere' }],
					},
					failure: { to: 'combat-rappel', text: 'Vous glissez sur la mousse ! Les brumelins vous ont vus. Ils vous sautent dessus en ricanant !' },
				},
			},
			{
				label: 'Entrer dans la ronde et chanter avec eux',
				check: {
					stat: 'charme',
					difficulty: 'facile',
					success: {
						to: 'lisiere',
						text: 'Les brumelins éclatent de rire et vous font tourner avec eux. Quand la chanson s’arrête, ils vous laissent leur trésor en cadeau, et filent dans les arbres.',
						effects: [{ addItem: 'echarpe-rouge', if: [{ notItem: 'echarpe-rouge' }] }, { setFlag: 'indice-lumiere' }, { xp: 1 }],
					},
					failure: { to: 'combat-rappel', text: 'Vous chantez faux. Très faux. Les brumelins se bouchent les oreilles… et vous attaquent !' },
				},
			},
			{ label: 'Repartir sans bruit vers le village', to: 'place' },
		],
	},
	{
		id: 'rappel-loups',
		place: 'lisiere',
		title: 'Des hurlements dans la nuit',
		chapter: 1,
		zone: 'lisiere',
		noRecall: true,
		media: { image: 'img-brumelins', music: 'mus-tension', ambience: 'amb-lisiere', sfx: ['sfx-loups'] },
		lines: [
			{ who: 'narrateur', text: 'AOUUUUH ! Un hurlement monte du fond de la forêt, puis un autre. Ce ne sont pas des loups ordinaires…' },
			{ who: 'narrateur', text: 'Et soudain, des hautes herbes surgissent des petites créatures de brume aux yeux bleus et aux sourires pointus. Des brumelins ! Ils vous encerclent en ricanant !' },
		],
		choices: [
			{ label: 'Se défendre !', to: 'combat-rappel' },
			{
				label: 'Prendre ses jambes à son cou',
				check: {
					stat: 'agilite',
					difficulty: 'moyen',
					success: { to: 'salle-commune', text: 'Vous filez comme le vent ! Les brumelins ricanent derrière vous, mais aucun ne vous rattrape.' },
					failure: { to: 'combat-rappel', text: 'Trop tard : ils vous ont coupé la route !' },
				},
			},
		],
	},
	{
		id: 'combat-rappel',
		place: 'lisiere',
		title: 'Les brumelins de la lisière',
		chapter: 1,
		zone: 'lisiere',
		noRecall: true,
		media: { image: 'img-brumelins', music: 'mus-combat', ambience: 'amb-lisiere', sfx: ['sfx-ricanement'] },
		lines: [{ who: 'narrateur', text: 'Les brumelins sautent dans tous les sens en essayant de vous tirer les cheveux et de vous chiper vos affaires !' }],
		combat: {
			enemy: { name: 'les brumelins', hearts: 16, difficulty: 'facile', damage: 3, move: 3, brume: true, image: 'img-brumelins', attack: 'Les brumelins vous sautent dessus : ils tirent les cheveux et mordillent les chevilles !' },
			foes: [
				{ name: 'le brumelin chapardeur', hearts: 8 },
				{ name: 'le brumelin grincheux', hearts: 8 },
			],
			victory: {
				to: 'rappel-loups-fin',
			},
			defeat: { to: 'defaite-auberge' },
			flee: {
				label: 'Courir vers le village',
				stat: 'agilite',
				difficulty: 'facile',
				outcome: { to: 'salle-commune', text: 'Vous détalez jusqu’à l’auberge sans vous retourner !' },
			},
		},
	},
	{
		id: 'rappel-loups-fin',
		place: 'lisiere',
		title: 'Ils détalent !',
		chapter: 1,
		zone: 'lisiere',
		noRecall: true,
		media: { image: 'img-lisiere', music: 'mus-village-nuit', ambience: 'amb-lisiere' },
		lines: [
			{ who: 'narrateur', text: 'Les brumelins s’éparpillent en sifflant comme des bouilloires et disparaissent dans la forêt. Mais d’autres hurlements montent, plus près.' },
			{ who: 'narrateur', text: 'Cette nuit, la forêt n’est pas pour vous. Mieux vaut rentrer à l’auberge et revenir à l’aube.' },
		],
		onEnter: [{ xp: 1 }],
		choices: [
			{ label: 'Rentrer à l’auberge', to: 'salle-commune' },
			{ label: 'Se réfugier chez Dame Corvine, tout près', to: 'hutte' },
		],
	},
	{
		id: 'defaite-auberge',
		place: 'chambre',
		title: 'Réveil à l’auberge',
		transition: false,
		chapter: 1,
		zone: 'auberge',
		noRecall: true,
		media: { image: 'img-defaite', music: 'mus-auberge', ambience: 'amb-taverne' },
		lines: [
			{ who: 'narrateur', text: 'Vous ouvrez les yeux dans un lit qui sent la lavande. Berthe vous pose un linge humide sur le front.' },
			{ who: 'berthe', text: 'Le sergent vous a ramenés sur son dos, un par un. Vous avez de la chance que ces bestioles soient plus farceuses que méchantes. Elles vous ont juste chipé quelques pièces.' },
		],
		onEnter: [{ rest: true }, { gold: -3 }],
		next: 'salle-commune',
	},
];
