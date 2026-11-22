import type { MediaAsset, StyleGuide } from '@/engine/types';

/**
 * Médias partagés par toutes les campagnes : interface, dés, portraits de classe.
 * Fichiers attendus dans public/medias/commun/<id>.<ext>
 */

export const COMMON_STYLE: StyleGuide = {
	image:
		'Illustration peinte numérique façon livre de contes sombre pour enfants de 8 à 12 ans, mélange d’aquarelle et de gravure à l’encre, palette bleu nuit, gris brume et lumières ambrées chaudes, contrastes doux, aucun sang ni gore, aucune créature terrifiante (inquiétante au plus), aucun texte ni lettrage dans l’image.',
	video:
		'Plan de 5 à 8 secondes, mouvement de caméra lent (travelling ou parallaxe légère), même direction artistique que les illustrations, 1920×1080, 24 i/s, sans son, sans texte, fin de plan pouvant boucler sur le début.',
	music:
		'Musique instrumentale médiévale-fantastique, instruments acoustiques (vielle à roue, flûte en bois, harpe celtique, violoncelle, percussions sur peau), sans voix chantée sauf mention contraire, boucle parfaite sans silence au début ni à la fin, mixage doux pour passer sous une voix parlée.',
	ambience:
		'Ambiance sonore réaliste en boucle parfaite, sans musique ni voix intelligible, stéréo, niveau modéré (environ −20 LUFS), aucun son brusque.',
	sfx: 'Bruitage court et net, sans musique, peu de réverbération, démarrage immédiat (pas de silence au début), niveau normalisé.',
};

/**
 * Direction commune des voix (ajoutée à chaque fiche de casting dans l'atelier).
 * Les répliques sont enregistrées une par fichier : public/medias/<campagne>/voix/<id>.mp3
 */
export const VOICE_DIRECTION =
	'Jeu d’acteur de livre audio pour enfants de 8 à 12 ans : naturel, expressif, chaleureux, jamais caricatural ni criard. Français de France. Un fichier par réplique, sans musique ni bruitage, silence de 0,2 s au début et à la fin, niveau normalisé (environ −16 LUFS), mp3 128 kbit/s ou plus. Les guillemets « » ne se prononcent pas.';

export const COMMON_MEDIA: MediaAsset[] = [
	/* ---- Portail ---- */
	{
		id: 'img-portail',
		type: 'image',
		title: 'Fond du portail',
		prompt:
			'Une grande table de bois dans une chambre d’auberge éclairée à la bougie, vue de dessus en légère plongée : une carte dépliée d’une vallée brumeuse, des dés à six faces en os, une plume, une lanterne allumée, un vieux livre ouvert. Fenêtre au fond où l’on devine une nuit bleue et brumeuse. Format 16:9, centre de l’image assez calme pour poser un titre par-dessus.',
	},
	{
		id: 'mus-portail',
		type: 'music',
		title: 'Thème du portail',
		prompt:
			'Thème principal de Valombre : mélodie de flûte en bois simple et mémorable, posée sur une harpe et une nappe de violoncelle. Sentiment : on ouvre un vieux livre de contes au coin du feu, un peu de mystère mais surtout de l’émerveillement. Tempo lent (70 BPM), tonalité mineure qui s’éclaire en majeur à la fin de la phrase. 2 minutes, boucle.',
	},

	/* ---- Portraits de classe ---- */
	{
		id: 'classe-guerrier-f',
		type: 'image',
		title: 'Portrait — Guerrière',
		prompt:
			'Portrait en buste d’une jeune fille d’environ 14 ans, aventurière de la classe « Guerrière » : bouclier rond cabossé peint d’un soleil, épée courte, cape grise mouillée, regard déterminé et bienveillant. Fond uni brume bleutée. Format carré 1:1, cadrage centré.',
		notes: 'Même tenue et mêmes attributs que la version garçon, pour qu’on reconnaisse la classe au premier coup d’œil.',
	},
	{
		id: 'classe-guerrier-m',
		type: 'image',
		title: 'Portrait — Guerrier',
		prompt:
			'Portrait en buste d’un jeune garçon d’environ 14 ans, aventurier de la classe « Guerrier » : bouclier rond cabossé peint d’un soleil, épée courte, cape grise mouillée, regard déterminé et bienveillant. Fond uni brume bleutée. Format carré 1:1, cadrage centré.',
		notes: 'Même tenue et mêmes attributs que la version fille, pour qu’on reconnaisse la classe au premier coup d’œil.',
	},
	{
		id: 'classe-rodeur-f',
		type: 'image',
		title: 'Portrait — Rôdeuse',
		prompt:
			'Portrait en buste d’une jeune fille d’environ 14 ans, aventurière de la classe « Rôdeuse » : capuche de laine verte, arc en bandoulière, plume accrochée à l’oreille, sourire malicieux, feuilles mortes dans les cheveux. Fond uni brume bleutée. Format carré 1:1, cadrage centré.',
		notes: 'Même tenue et mêmes attributs que la version garçon, pour qu’on reconnaisse la classe au premier coup d’œil.',
	},
	{
		id: 'classe-rodeur-m',
		type: 'image',
		title: 'Portrait — Rôdeur',
		prompt:
			'Portrait en buste d’un jeune garçon d’environ 14 ans, aventurier de la classe « Rôdeur » : capuche de laine verte, arc en bandoulière, plume accrochée à l’oreille, sourire malicieux, feuilles mortes dans les cheveux. Fond uni brume bleutée. Format carré 1:1, cadrage centré.',
		notes: 'Même tenue et mêmes attributs que la version fille, pour qu’on reconnaisse la classe au premier coup d’œil.',
	},
	{
		id: 'classe-mage-f',
		type: 'image',
		title: 'Portrait — Mage (fille)',
		prompt:
			'Portrait en buste d’une jeune fille d’environ 14 ans, aventurière de la classe « Mage » : bâton noueux dont l’extrémité brille d’une petite flamme dorée comme un lever de soleil, grimoire serré contre la poitrine, lunettes rondes, manteau bleu nuit étoilé. Fond uni brume bleutée. Format carré 1:1, cadrage centré.',
		notes: 'Même tenue et mêmes attributs que la version garçon, pour qu’on reconnaisse la classe au premier coup d’œil.',
	},
	{
		id: 'classe-mage-m',
		type: 'image',
		title: 'Portrait — Mage (garçon)',
		prompt:
			'Portrait en buste d’un jeune garçon d’environ 14 ans, aventurier de la classe « Mage » : bâton noueux dont l’extrémité brille d’une petite flamme dorée comme un lever de soleil, grimoire serré contre la poitrine, lunettes rondes, manteau bleu nuit étoilé. Fond uni brume bleutée. Format carré 1:1, cadrage centré.',
		notes: 'Même tenue et mêmes attributs que la version fille, pour qu’on reconnaisse la classe au premier coup d’œil.',
	},
	{
		id: 'classe-barde-f',
		type: 'image',
		title: 'Portrait — Barde (fille)',
		prompt:
			'Portrait en buste d’une jeune fille d’environ 14 ans, aventurière de la classe « Barde » : petit luth de voyage, chapeau à large bord avec un ruban rouge, joues rosies, air joyeux et rassurant. Fond uni brume bleutée. Format carré 1:1, cadrage centré.',
		notes: 'Même tenue et mêmes attributs que la version garçon, pour qu’on reconnaisse la classe au premier coup d’œil.',
	},
	{
		id: 'classe-barde-m',
		type: 'image',
		title: 'Portrait — Barde (garçon)',
		prompt:
			'Portrait en buste d’un jeune garçon d’environ 14 ans, aventurier de la classe « Barde » : petit luth de voyage, chapeau à large bord avec un ruban rouge, joues rosies, air joyeux et rassurant. Fond uni brume bleutée. Format carré 1:1, cadrage centré.',
		notes: 'Même tenue et mêmes attributs que la version fille, pour qu’on reconnaisse la classe au premier coup d’œil.',
	},

	/* ---- Bruitages d’interface ---- */
	{
		id: 'sfx-de',
		type: 'sfx',
		title: 'Lancer de dé',
		prompt: 'Un dé en bois lancé sur une table en bois : il claque, rebondit deux ou trois fois et s’arrête net. Son proche, net et naturel. 1,5 s.',
		promptEn:
			'Close-up foley recording of a single small wooden die thrown onto a solid wooden tabletop: a crisp clack, two or three quick bounces and rolls, then it settles and stops. Dry room, natural, high fidelity, no reverb, no music, no voices.',
	},
	{
		id: 'sfx-succes',
		type: 'sfx',
		title: 'Réussite',
		prompt: 'Petit carillon cristallin ascendant de trois notes, joyeux, comme une clochette magique. 1,5 s.',
	},
	{
		id: 'sfx-echec',
		type: 'sfx',
		title: 'Échec',
		prompt: 'Deux notes graves descendantes de violoncelle pincé, un « oh non » amusé, pas triste. 1,5 s.',
	},
	{
		id: 'sfx-coup',
		type: 'sfx',
		title: 'Coup porté',
		prompt: 'Coup d’épée en bois sur un bouclier, choc sourd et franc, façon jeu de cape et d’épée, sans bruit de chair. 0,8 s.',
	},
	{
		id: 'sfx-blessure',
		type: 'sfx',
		title: 'Héros touché',
		prompt: 'Souffle court et étouffé « hmpf ! » + froissement de cape, cartoonesque, pas douloureux. 0,8 s.',
	},
	{
		id: 'sfx-soin',
		type: 'sfx',
		title: 'Soin',
		prompt: 'Scintillement doux et chaud, comme une poignée de lucioles qui s’envolent, avec une note de harpe. 2 s.',
	},
	{
		id: 'sfx-objet',
		type: 'sfx',
		title: 'Objet ramassé',
		prompt: 'Objet glissé dans une besace en cuir + petit tintement métallique. 1 s.',
	},
	{
		id: 'sfx-quete',
		type: 'sfx',
		title: 'Quête mise à jour',
		prompt: 'Page de parchemin qu’on déroule + accord de luth bref et lumineux. 2 s.',
	},
	{
		id: 'sfx-pouvoir',
		type: 'sfx',
		title: 'Pouvoir de classe',
		prompt: 'Montée magique dorée : souffle qui s’enroule puis éclat lumineux, épique mais bref. 2 s.',
	},
	{ id: 'sfx-page', type: 'sfx', title: 'Ouvrir le journal', prompt: 'Grosse page de livre ancien qu’on tourne. 0,8 s.' },
	{
		id: 'sfx-sort',
		type: 'sfx',
		title: 'Sort lancé',
		prompt: 'Sort magique de conte : crépitement lumineux qui monte, puis éclate en étincelles cristallines. Merveilleux, pas effrayant. 1,5 s.',
	},
	{
		id: 'sfx-griffe',
		type: 'sfx',
		title: 'Attaque du monstre',
		prompt: 'Coup de griffes rapide qui lacère l’air en trois traits sifflants, suivi d’un impact sourd. Effrayant juste ce qu’il faut pour des enfants. 0,8 s.',
	},
	{ id: 'sfx-rate', type: 'sfx', title: 'Coup manqué', prompt: 'Coup d’épée ou de bâton qui fend l’air dans le vide, souffle rapide. 0,6 s.' },
	{
		id: 'sfx-coeur-brise',
		type: 'sfx',
		title: 'Un cœur de l’ennemi se brise',
		prompt: 'Petit éclat de cristal qui se fend, doux et net, avec une note claire qui retombe. 0,8 s.',
	},
];
