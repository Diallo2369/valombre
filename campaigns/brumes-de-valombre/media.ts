import type { Light, MediaAsset } from '@/engine/types';

/**
 * Catalogue des médias de la campagne.
 * Chaque entrée = un fichier à générer avec une autre IA, puis à déposer dans
 * public/medias/brumes-de-valombre/<id>.<ext>   (ext : webp/jpg/png, mp4/webm, mp3/ogg)
 * Le guide de style commun (campaigns/commun/media.ts) s'ajoute à chaque prompt à l'export.
 *
 * Images : 16:9 (1920×1080) sauf portraits (1:1, 1024×1024).
 * Vidéos : remplacent l'image fixe quand elles existent (même id de scène, autre fichier).
 */

const img = (id: string, title: string, prompt: string, notes?: string): MediaAsset => ({
	id,
	type: 'image',
	title,
	prompt,
	notes,
});
const portrait = (id: string, title: string, prompt: string): MediaAsset => ({
	id,
	type: 'image',
	title,
	prompt: `${prompt} Portrait en buste, fond uni de brume bleutée, format carré 1:1.`,
	notes: 'Format carré 1024×1024.',
});
const vid = (id: string, title: string, prompt: string, notes?: string): MediaAsset => ({
	id,
	type: 'video',
	title,
	prompt,
	notes,
});
const mus = (id: string, title: string, prompt: string): MediaAsset => ({ id, type: 'music', title, prompt });
const amb = (id: string, title: string, prompt: string, promptEn?: string): MediaAsset => ({ id, type: 'ambience', title, prompt, promptEn });
const sfx = (id: string, title: string, prompt: string): MediaAsset => ({ id, type: 'sfx', title, prompt });

export const MEDIA: MediaAsset[] = [
	/* ================================================================ */
	/* IMAGES — lieux et moments clés                                    */
	/* ================================================================ */
	img(
		'img-couverture',
		'Couverture de la campagne',
		'Une auberge à colombages au toit moussu, seule lumière chaude au milieu d’une vallée noyée de brume grise au crépuscule. Une enseigne en forme de chaudron fêlé se balance. Au loin, une forêt de troncs noirs et une minuscule lueur bleue qui danse. Au premier plan, quatre silhouettes de jeunes aventuriers de dos, capes au vent.',
		'Sert aussi de vignette sur le portail. Garder le haut de l’image dégagé pour le titre.',
	),
	img(
		'img-route-brume',
		'La route dans la brume',
		'Chemin de terre boueux qui monte une colline sous la pluie fine, la nuit. Brume épaisse au ras du sol, arbres tordus de chaque côté. Au sommet, la fenêtre jaune d’une auberge perce le brouillard. Dans la brume, au ras du sol près du chemin, si on regarde bien, deux petits yeux ronds d’un bleu lumineux observent.',
	),
	img(
		'img-auberge-porte',
		'La porte du Chaudron Fêlé',
		'Grosse porte en chêne cloutée d’une auberge médiévale, sous un auvent ruisselant de pluie. Enseigne en fer forgé : un chaudron fendu d’où s’échappe une fumée peinte. Lanterne accrochée au mur. La porte s’entrouvre sur une lumière orange chaude.',
	),
	img(
		'img-salle-commune',
		'La salle commune',
		'Intérieur chaleureux d’une auberge médiévale la nuit : grande cheminée de pierre où mijote un chaudron, poutres basses avec jambons et herbes séchées, tables de bois usées, quelques clients. Près du feu, un vieil homme aux yeux voilés et une carte sur les genoux. Dans un coin, un soldat grisonnant devant un bol de soupe. Fenêtres où la brume grise se colle aux carreaux.',
		'Image pivot du chapitre 1 : elle reviendra souvent, soigner les détails.',
	),
	img(
		'img-cuisine',
		'La cuisine de Berthe',
		'Cuisine d’auberge médiévale encombrée : marmites de cuivre, miches de pain, saucisses pendues, chat-pot de lait renversé. Une trappe en bois au sol, entrouverte, d’où sortent deux rats affolés. Lumière de chandelle.',
	),
	img(
		'img-cave',
		'La cave qui grince',
		'Cave voûtée en pierre, tonneaux et jarres, toiles d’araignée argentées. Une seule bougie. Au fond, un tonneau renversé d’où dépassent deux petites oreilles grises pointues et une queue de brume. Inquiétant mais un peu comique.',
	),
	img(
		'img-pff',
		'Pff, le brumelin',
		'Petite créature de brume grise de la taille d’un chat, aux grands yeux bleus ronds et humides, aux oreilles pointues qui tombent, au corps vaporeux qui s’effiloche en volutes. Elle tient une miette de pain dans ses petites mains. Adorable et un peu triste, assise sur un tonneau de cave.',
	),
	img(
		'img-cour',
		'La cour de l’auberge',
		'Cour pavée d’une auberge sous la pluie, la nuit. À gauche une écurie au toit de chaume avec une lanterne. Au centre, la roulotte bariolée d’un colporteur couverte d’une bâche, une lueur dorée filtrant à travers une fente. Brume qui rampe sur les pavés.',
	),
	img(
		'img-ecurie',
		'L’écurie',
		'Intérieur d’écurie chaude : une jument pommelée, du foin, une échelle vers un grenier. Assis sur une botte de paille, un garçon de 11 ans aux cheveux roux en bataille, les yeux rougis, une lanterne de corne à ses pieds.',
	),
	img(
		'img-grenier',
		'Le grenier à foin',
		'Grenier à foin sous les combles, poutres et toiles d’araignée, rayons de lune par une lucarne. Sur une poutre haute, un chat noir aux yeux d’or, le dos rond, qui regarde vers le bas.',
	),
	img(
		'img-roulotte',
		'La roulotte de Gaspard',
		'Gros plan sous la bâche d’une roulotte de colporteur : babioles, rubans, fausses amulettes de cailloux peints, et un petit coffret de bois cadenassé d’où s’échappe une lumière dorée qui pulse doucement comme un cœur.',
	),
	img(
		'img-place',
		'La place de Combeloup',
		'Petite place de village médiéval la nuit, maisons à colombages aux volets clos, vieux puits de pierre couvert d’un toit, moulin à eau au bord d’un ruisseau. Un homme enfariné tient une torche et appelle dans la brume. Atmosphère de couvre-feu.',
	),
	img(
		'img-puits',
		'Le vieux puits',
		'Gros plan d’un vieux puits en pierre moussue, avec une poulie et un seau. De l’ouverture monte une très légère lueur argentée et des volutes de brume, comme si quelqu’un chantait en dessous.',
	),
	img(
		'img-fond-puits',
		'Au fond du puits',
		'Fond d’un puits, eau jusqu’aux chevilles, parois de pierre luisantes. Une pierre gravée d’une lanterne entourée de rayons brille faiblement. Une pièce ancienne et un rouleau de cuir huilé dépassent d’une niche. Vue en contre-plongée vers le petit rond de ciel nocturne tout en haut.',
	),
	img(
		'img-moulin',
		'La chambre de Lisette au moulin',
		'Petite chambre d’enfant sous les toits d’un moulin : lit défait, poupée de chiffon, fenêtre grande ouverte sur la nuit brumeuse. Sur le plancher, une traînée de poussière bleue scintillante mène jusqu’à la fenêtre.',
	),
	img(
		'img-lisiere',
		'La lisière du Bois-Noir',
		'Orée d’une forêt de troncs noirs serrés, la nuit. La brume sort d’entre les arbres comme un souffle. À droite, une hutte de herboriste au toit végétal, une lumière verte à la fenêtre et des bocaux sur le rebord. Au fond de la forêt, une minuscule lumière bleue danse.',
	),
	img(
		'img-hutte',
		'La hutte de Dame Corvine',
		'Intérieur de hutte d’herboriste : bouquets de plantes séchées au plafond, bocaux étiquetés, chaudron vert qui bouillonne, plume de corbeau. Une femme âgée, mince, au nez pointu et au sourire en coin, cheveux gris tressés de rubans noirs, châle couleur mousse.',
	),
	img(
		'img-sous-bois-nuit',
		'Sous les arbres, la nuit',
		'Sentier étroit sous de grands arbres noirs, la nuit, brume jusqu’aux genoux. Un feu-follet bleu flotte entre les troncs. Dans les racines, plusieurs paires de petits yeux bleus. Effrayant juste ce qu’il faut.',
	),
	img(
		'img-tempete',
		'La tempête se lève',
		'Village médiéval pris dans une tempête soudaine la nuit : rideaux de pluie, éclair qui illumine la brume, volets qui claquent, une enseigne arrachée qui vole, silhouettes qui courent vers une auberge éclairée.',
	),
	img(
		'img-brumelins',
		'Les brumelins attaquent',
		'Une bande de petites créatures de brume grise aux yeux bleus ronds et aux sourires pointus, de la taille de gros chats, qui surgissent des hautes herbes en ricanant. Elles sont espiègles, pas monstrueuses. Nuit, lune voilée.',
	),
	img(
		'img-repos',
		'Une chambre à l’étage',
		'Chambre d’auberge sous les toits, lits de bois garnis de couvertures en patchwork, bougie presque consumée, fenêtre où la brume pâlit avec l’aube. Des sacs d’aventuriers posés au pied des lits. Paisible.',
	),
	img(
		'img-depart',
		'Le départ à l’aube',
		'Cour d’auberge à l’aube froide, brume rose et grise. Une aubergiste robuste tend des besaces, un garçon roux agite la main, un vieil homme aveugle lève la main en bénédiction. Au loin, la ligne noire du Bois-Noir.',
	),
	img(
		'img-oree',
		'L’orée du Bois-Noir au matin',
		'Entrée d’une immense forêt de troncs noirs et lisses comme du charbon, à l’aube. Trois chemins partent : à gauche une allée de pierres levées gravées, au centre un ravin plongeant, à droite un trou entre de grosses racines. Brume basse, lumière pâle.',
	),
	img(
		'img-pierres-levees',
		'Le sentier des pierres levées',
		'Alignement de pierres levées couvertes de lichen dans une forêt sombre, chacune gravée d’une lanterne et de rayons de soleil. La brume tourne autour sans oser les toucher. Rais de lumière pâle.',
	),
	img(
		'img-ravin',
		'Le ravin',
		'Ravin étroit et pentu dans une forêt noire, éboulis de pierres, racines qui pendent comme des cordes, un filet d’eau au fond. Vue plongeante vertigineuse mais lumineuse.',
	),
	img(
		'img-terriers',
		'Les terriers des brumelins',
		'Tunnel creusé entre d’énormes racines, tapissé de mousse luminescente bleue. Petits objets volés rangés dans des niches : boutons, cuillères, rubans. Vue subjective comme si on suivait quelqu’un de petit.',
	),
	img(
		'img-gue',
		'Le gué du Héron',
		'Rivière large et peu profonde au milieu de la forêt, pierres plates pour traverser, roseaux argentés. Au milieu, un immense héron fantomatique, translucide et lumineux, aussi grand qu’un arbre, qui baisse son long bec vers le spectateur. Majestueux et calme.',
	),
	img(
		'img-clairiere',
		'La clairière des brumelins',
		'Clairière ronde dans une forêt noire, cercle de champignons pâles, des dizaines de brumelins (petites créatures de brume aux yeux bleus) qui dansent en rond. Au centre, suspendu à une branche dans un filet de lianes, un homme maigre à la moustache fine et au chapeau à plume, l’air terrifié.',
		'Variante si Gaspard n’est pas là : la même clairière avec un filet vide. Tu peux générer les deux (img-clairiere et img-clairiere-vide).',
	),
	img('img-clairiere-vide', 'La clairière (sans Gaspard)', 'Même clairière que img-clairiere, mais le filet de lianes suspendu est vide.'),
	img(
		'img-loup',
		'Le Loup de Cendre',
		'Sur un escalier de pierre en ruine, un immense loup fait de cendre grise et de braises orange qui rougeoient sous sa fourrure, ses yeux comme deux charbons ardents. Il garde l’entrée d’un temple. Impressionnant mais noble, pas sanguinaire, gueule fermée.',
	),
	img(
		'img-loup-apaise',
		'Le Loup apaisé',
		'Le même loup de cendre et de braises, allongé sur les marches, la tête posée sur les pattes, les braises qui ronronnent doucement. Il regarde avec des yeux devenus dorés et doux.',
	),
	img(
		'img-louveteau',
		'Le louveteau de braise',
		'Un tout petit louveteau fait de cendre et de braises, de la taille d’un chiot, qui remue la queue au milieu d’un tas de cendres. Adorable.',
	),
	img(
		'img-sanctuaire',
		'Le Sanctuaire de l’Aube',
		'Intérieur d’un temple de pierre blanche en ruine envahi par la brume et les racines. Au fond, un autel avec une grande lanterne de bronze vide. Dans un cocon de brume argentée, une fillette de 10 ans à l’écharpe rouge dort paisiblement en lévitation. Lumière bleutée irréelle.',
	),
	img(
		'img-dame-grise',
		'La Dame Grise',
		'Une femme immense et translucide faite de brume, aux longs cheveux qui se dissolvent en volutes, au visage triste et doux, aux yeux fermés. Elle penche la tête vers le spectateur dans un temple en ruine. Mélancolique, pas effrayante.',
	),
	img(
		'img-coeur-lumiere',
		'Le Cœur retrouvé',
		'Une pierre dorée posée dans une grande lanterne de bronze sur un autel : une lumière d’aube jaillit en rayons, la brume recule comme un rideau qui se lève, des fleurs s’ouvrent sur les racines. Une fillette à l’écharpe rouge ouvre les yeux.',
	),
	img(
		'img-retour',
		'Le retour au village',
		'Groupe de jeunes aventuriers qui sortent d’une forêt noire au lever du soleil, accompagnés d’une fillette à l’écharpe rouge. La brume se déchire, la vallée apparaît, verte et dorée, avec le village et son auberge au loin.',
	),
	img(
		'img-fete',
		'La fête au Chaudron Fêlé',
		'Salle commune d’auberge en fête, de jour : guirlandes, tables couvertes de tartes et de saucisses, un meunier qui serre sa fille dans ses bras, une aubergiste qui rit en levant une louche, un garçon roux qui danse avec un petit brumelin. Lumière dorée.',
	),
	img(
		'img-defaite',
		'Réveil à l’auberge',
		'Chambre d’auberge, matin gris. Une aubergiste robuste pose un linge humide sur le front d’un jeune aventurier couché. Bol de soupe fumant sur la table de nuit. Ambiance rassurante.',
	),

	/* ================================================================ */
	/* PORTRAITS — PNJ                                                   */
	/* ================================================================ */
	portrait(
		'portrait-berthe',
		'Berthe Mâchefer',
		'Aubergiste d’une cinquantaine d’années, solide, joues rouges, bras de boulangère, tablier taché, torchon sur l’épaule, cheveux gris relevés en chignon avec une cuillère en bois piquée dedans. Sourcils froncés mais yeux qui rient.',
	),
	portrait(
		'portrait-tilo',
		'Tilo',
		'Garçon de 11 ans, cheveux roux en bataille avec des brins de paille, taches de rousseur, chemise trop grande, yeux rougis d’avoir pleuré mais l’air courageux.',
	),
	portrait(
		'portrait-ossian',
		'Ossian',
		'Vieil homme très âgé, longue barbe blanche tressée, yeux laiteux d’aveugle, sourire paisible, bonnet de laine, plume d’oie derrière l’oreille, doigts tachés d’encre.',
	),
	portrait(
		'portrait-aubin',
		'Aubin le meunier',
		'Homme d’une quarantaine d’années, grand et doux, couvert de farine jusque dans les sourcils, visage inquiet, torche à la main.',
	),
	portrait(
		'portrait-gaspard',
		'Gaspard Belle-Langue',
		'Colporteur maigre aux yeux vifs, fine moustache recourbée, chapeau à large bord orné d’une plume de faisan, gilet bariolé couvert de breloques, sourire un peu trop large.',
	),
	portrait(
		'portrait-corvine',
		'Dame Corvine',
		'Herboriste âgée, mince, nez pointu, sourire en coin, cheveux gris tressés de rubans noirs, châle couleur mousse, une plume de corbeau en broche. Air de sorcière gentille.',
	),
	portrait(
		'portrait-brac',
		'Sergent Brac',
		'Vieux soldat grisonnant à la moustache en brosse, casque cabossé, cape de garde délavée, cicatrice sur le sourcil, air bourru mais fatigué et honnête.',
	),
	portrait(
		'portrait-pff',
		'Pff',
		'Petite créature de brume grise, grands yeux bleus ronds et brillants, oreilles pointues qui tombent, sourire timide. Volutes qui s’échappent de ses contours.',
	),
	portrait(
		'portrait-heron',
		'L’Esprit du Héron',
		'Tête et cou d’un héron immense, translucide, fait de lumière argentée et d’eau, œil ancien et sage, plumes qui ondulent comme des reflets sur une rivière.',
	),
	portrait(
		'portrait-dame-grise',
		'La Dame Grise',
		'Visage de femme fait de brume pâle, yeux mi-clos, expression triste et tendre, cheveux qui se dissolvent en volutes, diadème de bronze terni en forme de lanterne.',
	),
	portrait(
		'portrait-lisette',
		'Lisette',
		'Fillette de 10 ans, nattes brunes, écharpe rouge, robe de laine, farine sur le bout du nez, regard vif et curieux.',
	),

	/* ================================================================ */
	/* VIDÉOS — moments forts                                            */
	/* ================================================================ */
	vid(
		'vid-intro',
		'Ouverture : la route dans la brume',
		'Travelling avant lent sur un chemin de colline sous la pluie la nuit, la brume roule au ras du sol, des gouttes tombent des branches. La fenêtre jaune d’une auberge grossit au sommet de la colline. À mi-plan, au ras du sol, deux petits yeux ronds d’un bleu lumineux s’ouvrent dans la brume puis disparaissent.',
		'Remplace img-route-brume pendant la scène d’ouverture. 8 s.',
	),
	vid(
		'vid-salle-commune',
		'La salle commune vivante',
		'Plan fixe légèrement animé de la salle commune (cf. img-salle-commune) : les flammes dansent, la fumée du chaudron monte, les jambons se balancent un peu, la brume glisse derrière les carreaux.',
		'Boucle parfaite de 6 s. Optionnel : si absent, l’image fixe suffit.',
	),
	vid(
		'vid-aubin-entre',
		'Aubin fait irruption',
		'La porte d’une auberge s’ouvre violemment, la pluie et la brume s’engouffrent, un meunier couvert de farine, torche à la main, entre en criant. Les bougies vacillent.',
		'6 s, pas de boucle.',
	),
	vid(
		'vid-tempete',
		'La tempête',
		'Rafales de pluie sur un village la nuit, éclair qui blanchit la scène, volets qui claquent, enseigne qui se balance violemment, brume chassée par le vent.',
		'Boucle 6 s.',
	),
	vid(
		'vid-heron',
		'Le Héron se dresse',
		'Au milieu d’une rivière forestière, la brume se condense et forme un héron géant lumineux qui déplie lentement ses ailes et baisse son bec vers la caméra.',
		'8 s.',
	),
	vid(
		'vid-loup',
		'Le Loup de Cendre se lève',
		'Un tas de cendres sur des marches de pierre se soulève, des braises s’allument une à une, et un immense loup de cendre se dresse, les yeux comme deux charbons ardents. Il secoue la tête, des étincelles s’envolent.',
		'8 s. Pas de gueule ouverte ni de crocs en gros plan.',
	),
	vid(
		'vid-coeur',
		'La lumière revient',
		'Gros plan : une pierre dorée est posée dans une lanterne de bronze, une lumière d’aube éclate en rayons, la brume se retire comme une marée, des fleurs blanches éclosent sur les racines, une fillette endormie ouvre les yeux.',
		'10 s. Le moment le plus important de la campagne.',
	),
	vid(
		'vid-final',
		'Lever de soleil sur Valombre',
		'Vue aérienne lente d’une vallée verte au lever du soleil, la brume se déchire, un village et son auberge apparaissent, la forêt noire au loin. Au dernier moment, très loin au nord, une citadelle blanche brille sur une montagne.',
		'10 s. Teaser de la campagne 2.',
	),

	/* ================================================================ */
	/* MUSIQUES                                                          */
	/* ================================================================ */
	mus(
		'mus-route',
		'Sur la route, la nuit',
		'Nappe de violoncelle grave et vielle à roue lointaine, quelques notes de harpe comme des gouttes de pluie. Sentiment : on est perdu, il fait froid, mais une lumière nous attend. 65 BPM, ré mineur, 2 min.',
	),
	mus(
		'mus-auberge',
		'Le Chaudron Fêlé',
		'Air de taverne médiévale chaleureux et un peu bourru : vielle à roue, flûte, tambourin léger, contrebasse pincée. Sentiment : on est à l’abri, ça sent la soupe, les gens sont gentils mais inquiets. Pas trop festif. 95 BPM, sol majeur avec passages en mi mineur, 3 min.',
	),
	mus(
		'mus-village-nuit',
		'Combeloup sous la brume',
		'Musique d’exploration nocturne, discrète : pizzicati de cordes, flûte basse, petite cloche lointaine. Curiosité et léger frisson, sans menace. 80 BPM, la mineur, 2 min 30.',
	),
	mus(
		'mus-mystere',
		'Le murmure de la Grise',
		'Nappe mystérieuse : harmonica de verre, voix féminine sans paroles très lointaine (un « ooh » de berceuse), harpe arpégée lente. Sentiment : une légende ancienne et triste. 60 BPM, 2 min.',
	),
	mus(
		'mus-foret',
		'Le Bois-Noir',
		'Exploration de forêt sombre au matin : bourdon de vielle à roue, flûte en bois qui lance des appels, percussions sur bois très douces, craquements intégrés. Aventure prudente. 85 BPM, ré dorien, 3 min.',
	),
	mus(
		'mus-tension',
		'Danger proche',
		'Tension montante sans percussions fortes : trémolo de cordes, notes graves de violoncelle qui reviennent comme un cœur qui bat, petites dissonances. Pour « quelque chose approche ». 100 BPM, 1 min 30.',
	),
	mus(
		'mus-combat',
		'Combat !',
		'Combat d’aventure enjoué et énergique, pas effrayant : tambours sur peau, vielle à roue rythmique, flûte héroïque, cuivres légers. Sentiment : « on peut y arriver ensemble ! ». 130 BPM, mi mineur, 2 min.',
	),
	mus(
		'mus-boss',
		'Le Loup de Cendre',
		'Thème du gardien : grands tambours lents, chœur grave sans paroles, cor lointain, cordes en crescendo. Majestueux, impressionnant, mais noble plutôt que maléfique. 90 BPM, do mineur, 2 min 30.',
	),
	mus(
		'mus-sanctuaire',
		'Le sanctuaire endormi',
		'Musique de rêve : célesta, harpe, chœur féminin très doux sans paroles, longues résonances. Sentiment : beau, triste, sacré, on chuchote. 55 BPM, 2 min 30.',
	),
	mus(
		'mus-aube',
		'L’Aube revient',
		'Le thème du portail (flûte) repris en grand : orchestre chaleureux, cordes qui s’envolent, harpe, cloches. Libération et joie. 80 BPM, ré majeur, 2 min.',
	),
	mus(
		'mus-fete',
		'Fête au village',
		'Danse médiévale joyeuse : vielle à roue, cornemuse douce, tambourin, flûte, claquements de mains. Ronde de fête de village. 120 BPM, sol majeur, 3 min.',
	),

	/* ================================================================ */
	/* AMBIANCES (boucles)                                               */
	/* ================================================================ */
	amb(
		'amb-pluie-route',
		'Nuit sur la route',
		'Nuit dehors, très calme : pluie fine et douce sur les feuilles, naturelle, de grande qualité (pas un souffle ni un grésillement), vent très léger. Rien d’autre.',
		'High-fidelity field recording of a calm night outdoors: soft, gentle, natural light rain falling on leaves, close and detailed, with a faint breeze. Warm and soothing, low level. Not white noise, no hiss, no static. No animals, no footsteps, no sudden sounds, no music, no voices. Seamless loop.',
	),
	amb(
		'amb-taverne',
		'Salle commune',
		'Intérieur d’auberge feutré et chaleureux, la nuit : feu de cheminée qui crépite doucement, tout près ; très léger brouhaha lointain de quelques personnes qui parlent bas. Calme, intime, sans rires ni éclats de voix.',
		'Cozy, muffled medieval inn interior at night. A fireplace gently crackling close by, a very soft and distant indistinct murmur of a few people talking quietly. Warm, calm, intimate, low level. No laughter, no shouting, no clinking glasses, no music, no intelligible words. Seamless loop.',
	),
	amb(
		'amb-cuisine',
		'Cuisine',
		'Cuisine d’auberge la nuit : feu de four qui crépite doucement, une marmite en fonte qui ronronne très bas, ustensiles qui tintent à peine. Aucun bruit d’eau.',
		'A medieval inn kitchen at night. A wood oven fire gently crackling, a cast iron pot humming very low, a faint occasional soft clink of a ladle. Warm, calm, low level. No water, no boiling bubbles, no music, no voices. Seamless loop.',
	),
	amb(
		'amb-cave',
		'Cave',
		'Cave de pierre fraîche et silencieuse : silence profond, très léger souffle étrange comme une respiration de brume, un tonneau qui craque. Aucun bruit d’eau.',
		'A quiet stone cellar under an inn. Deep, close silence, a very faint strange airy breathing like living mist, an old wooden barrel creaking softly once in a while. Intimate, mysterious, low level. No water, no dripping, no animals, no music, no voices. Seamless loop.',
	),
	amb(
		'amb-cour',
		'Cour dans la brume',
		'Cour d’auberge la nuit, dans la brume : calme étouffé, léger souffle de vent, une enseigne en fer qui grince doucement de temps en temps. Aucun bruit d’eau.',
		'An inn courtyard at night in thick fog. Hushed, muffled calm, a light low wind, an iron shop sign creaking softly now and then. Sparse, low level. No water, no rain, no dripping, no animals, no footsteps, no music, no voices. Seamless loop.',
	),
	amb(
		'amb-ecurie',
		'Écurie',
		'Écurie chaude la nuit : un cheval qui respire calmement et mâche son foin, paille froissée, vieilles poutres en bois qui craquent doucement. Aucun bruit d’eau.',
		'Inside a warm wooden stable at night. A horse breathing calmly and slowly chewing hay, soft rustle of straw, old wooden beams creaking gently. Cozy, quiet, close, low level. No water, no rain, no dripping, no music, no voices. Seamless loop.',
	),
	amb(
		'amb-village-nuit',
		'Village dans la Grise',
		'Village noyé dans un brouillard épais, la nuit : silence étouffé, comme sous du coton. Souffle grave et lent du vent, très loin le grincement d’une roue de moulin. Aucun bruit d’eau. Mystérieux, pas effrayant.',
		'A small medieval village at night, drowned in thick fog. Muffled, hushed stillness, as if heard through cotton wool. A deep, slow, low wind hum and a very distant, faint creak of a wooden mill wheel. Mysterious but not scary, sparse, low level. No water, no rain, no dripping, no dogs, no animals, no footsteps, no sudden sounds, no music, no voices. Seamless loop.',
	),
	amb(
		'amb-puits',
		'Fond du puits',
		'Fond d’un puits de pierre : silence qui résonne, écho profond et doux, et très loin une berceuse fredonnée par une voix de femme, sans paroles, comme dans un rêve. Pas de clapotis.',
		'At the bottom of an old stone well. Resonant, hollow silence with deep soft echo, and very far away a woman softly humming a lullaby without words, dreamy and blurred by the echo. Mysterious, gentle, low level. No water splashing, no dripping, no music instruments. Seamless loop.',
	),
	amb(
		'amb-lisiere',
		'Lisière dans la Grise',
		'Lisière d’une grande forêt noire la nuit, dans le brouillard : vent lent dans les hauts arbres, craquement de branche lointain, silence épais. Aucun bruit d’eau.',
		'The edge of a dark old forest at night, in thick fog. Slow wind moving through tall trees, an occasional distant branch creak, deep heavy silence. Mysterious, slightly eerie, not scary, low level. No water, no rain, no dripping, no animals, no footsteps, no music, no voices. Seamless loop.',
	),
	amb(
		'amb-tempete',
		'Tempête',
		'Tempête de nuit : fortes rafales de vent, pluie battante naturelle et de grande qualité, tonnerre qui roule au loin, volets qui claquent.',
		'High-fidelity recording of a night storm over a village: strong gusts of wind, heavy natural rain, distant rolling thunder, wooden shutters banging now and then. Powerful but not harsh, no static, no hiss, no music, no voices. Seamless loop.',
	),
	amb('amb-foret-matin', 'Forêt au matin', 'Forêt froide au petit jour : quelques oiseaux timides, gouttes qui tombent des feuilles, craquements, ruisseau lointain.'),
	amb('amb-riviere', 'Le gué', 'Rivière peu profonde qui court sur des pierres, roseaux dans le vent, battement d’ailes très lent et grave de temps en temps.'),
	amb('amb-clairiere', 'Clairière des brumelins', 'Petits rires et chuchotements aigus de créatures, ronde de pas légers, vent dans les feuilles, insectes nocturnes.'),
	amb('amb-sanctuaire', 'Sanctuaire', 'Grand espace de pierre résonnant, gouttes, souffle lent et régulier comme une respiration endormie, tintement de bronze lointain.'),
	amb('amb-fete', 'Fête', 'Foule joyeuse dans une auberge : rires, verres et chopes, enfants qui courent, applaudissements.'),

	/* ================================================================ */
	/* BRUITAGES de scène                                                */
	/* ================================================================ */
	sfx('sfx-porte', 'Porte d’auberge', 'Lourde porte en chêne qui s’ouvre en grinçant, puis claque. 2 s.'),
	sfx('sfx-porte-claque', 'Porte enfoncée', 'Porte ouverte violemment, battant qui frappe le mur, bourrasque de pluie qui entre. 1,5 s.'),
	sfx('sfx-cloche', 'Cloche de Berthe', 'Cloche de cour en bronze, secouée énergiquement quatre fois. 3 s.'),
	sfx('sfx-tonnerre', 'Tonnerre', 'Coup de tonnerre proche qui craque puis roule longuement. 4 s.'),
	sfx('sfx-loups', 'Hurlement', 'Hurlement de loup lointain, repris par deux autres. 4 s.'),
	sfx('sfx-ricanement', 'Ricanement de brumelin', 'Petit ricanement aigu et espiègle, comme un lutin, avec un souffle venteux. 1,5 s.'),
	sfx('sfx-miaou', 'Miaulement', 'Miaulement de chat noir, plaintif puis curieux. 1,5 s.'),
	sfx('sfx-rats', 'Rats', 'Couinements de rats affolés et galopade de petites pattes sur du bois. 2 s.'),
	sfx('sfx-corde', 'Corde', 'Corde de chanvre qui frotte sur une margelle de pierre et se tend. 2 s.'),
	sfx('sfx-plouf', 'Plouf', 'Pieds qui atterrissent dans une eau peu profonde, écho de puits. 1,5 s.'),
	sfx('sfx-coffret', 'Coffret', 'Petit cadenas qui cède, couvercle de bois qui s’ouvre, puis un bourdonnement doux et lumineux. 2,5 s.'),
	sfx('sfx-heron', 'Cri du héron', 'Cri de héron grave et ralenti, comme venu d’un rêve, avec battement d’ailes. 3 s.'),
	sfx('sfx-grondement', 'Grondement du loup', 'Grondement profond de grand loup, mêlé à un crépitement de braises. 3 s.'),
	sfx('sfx-braises', 'Braises', 'Gros feu qui s’effondre en braises qui crépitent, puis un petit jappement de chiot. 3 s.'),
	sfx('sfx-souffle-vent', 'Souffle de la plume', 'Souffle léger qui devient bourrasque puis s’éteint. 2 s.'),
	sfx('sfx-aube', 'Le Cœur s’allume', 'Bourdonnement chaud qui monte, puis éclat lumineux avec chœur bref et cloches. 4 s.'),
	sfx('sfx-applaudissements', 'Hourra', 'Petite foule qui crie « hourra ! » et applaudit. 3 s.'),
];

/**
 * Lumières vivantes posées sur les images (feu, lanterne, brume, éclair, magie).
 * Positions estimées d'après les prompts : à ajuster quand l'illustration existe (x, y en % de l'image).
 */
const brume: Light = { kind: 'brume' };
const BLEU = '120,170,255';
const ARGENT = '205,215,255';
const OR = '255,205,110';

export const LIGHTS: Record<string, Light[]> = {
	// Calé sur l'image réelle : fenêtre de l'auberge en haut à droite, yeux de Pff dans la brume à gauche.
	'img-route-brume': [brume, { kind: 'lanterne', x: 81, y: 18, size: 0.05, intensity: 0.9 }, { kind: 'magie', x: 31, y: 55, size: 0.025, color: BLEU, intensity: 0.7 }],
	// Calé sur l'image réelle : lanterne au-dessus de la porte, feu de la salle par la porte entrouverte, deux fenêtres.
	'img-auberge-porte': [
		{ ...brume, intensity: 0.7 },
		{ kind: 'lanterne', x: 53, y: 21, size: 0.12 },
		{ kind: 'feu', x: 55, y: 57, size: 0.09, intensity: 0.8 },
		{ kind: 'lanterne', x: 9, y: 43, size: 0.08, intensity: 0.6 },
		{ kind: 'lanterne', x: 86, y: 51, size: 0.05, intensity: 0.5 },
	],
	'img-salle-commune': [{ kind: 'feu', x: 80, y: 58, size: 0.45 }],
	'img-cuisine': [{ kind: 'feu', x: 25, y: 62, size: 0.4 }],
	'img-cave': [{ kind: 'lanterne', x: 30, y: 30, size: 0.22, intensity: 0.6 }],
	'img-pff': [{ kind: 'magie', x: 50, y: 50, size: 0.25, color: BLEU, intensity: 0.7 }],
	'img-cour': [brume, { kind: 'lanterne', x: 22, y: 42, size: 0.14 }, { kind: 'magie', x: 55, y: 55, size: 0.08, color: OR, intensity: 0.8 }],
	'img-ecurie': [{ kind: 'lanterne', x: 60, y: 30, size: 0.3 }],
	'img-grenier': [{ kind: 'lanterne', x: 50, y: 72, size: 0.25, intensity: 0.5 }],
	'img-roulotte': [{ kind: 'magie', x: 55, y: 62, size: 0.2, color: OR }],
	'img-place': [brume],
	'img-puits': [brume, { kind: 'magie', x: 50, y: 62, size: 0.18, color: ARGENT, intensity: 0.7 }],
	'img-fond-puits': [{ kind: 'magie', x: 50, y: 48, size: 0.35, color: ARGENT }],
	'img-moulin': [brume, { kind: 'magie', x: 50, y: 78, size: 0.18, color: BLEU, intensity: 0.5 }],
	'img-lisiere': [brume, { kind: 'magie', x: 62, y: 45, size: 0.05, color: BLEU }, { kind: 'lanterne', x: 86, y: 52, size: 0.07, color: '150,230,140' }],
	'img-hutte': [{ kind: 'feu', x: 40, y: 58, size: 0.35, color: '255,170,90' }],
	'img-sous-bois-nuit': [brume, { kind: 'magie', x: 55, y: 40, size: 0.06, color: BLEU }],
	'img-tempete': [{ kind: 'eclair' }, brume],
	'img-brumelins': [brume, { kind: 'magie', x: 50, y: 55, size: 0.3, color: BLEU, intensity: 0.8 }],
	'img-repos': [{ kind: 'lanterne', x: 30, y: 45, size: 0.22, intensity: 0.7 }],
	'img-defaite': [{ kind: 'lanterne', x: 30, y: 45, size: 0.22, intensity: 0.7 }],
	'img-oree': [{ ...brume, intensity: 0.6 }],
	'img-pierres-levees': [{ ...brume, intensity: 0.7 }],
	'img-ravin': [{ ...brume, intensity: 0.6 }],
	'img-gue': [brume, { kind: 'magie', x: 50, y: 40, size: 0.3, color: ARGENT, intensity: 0.6 }],
	'img-clairiere': [brume, { kind: 'magie', x: 50, y: 60, size: 0.25, color: BLEU, intensity: 0.6 }],
	'img-clairiere-vide': [brume],
	'img-loup': [{ kind: 'feu', x: 50, y: 50, size: 0.35, color: '255,110,40' }],
	'img-loup-apaise': [{ kind: 'feu', x: 50, y: 60, size: 0.3, color: '255,120,50', intensity: 0.7 }],
	'img-louveteau': [{ kind: 'feu', x: 50, y: 62, size: 0.15, color: '255,120,50' }],
	'img-sanctuaire': [brume, { kind: 'magie', x: 50, y: 50, size: 0.3, color: ARGENT }],
	'img-dame-grise': [brume, { kind: 'magie', x: 50, y: 40, size: 0.4, color: ARGENT }],
	'img-coeur-lumiere': [{ kind: 'magie', x: 50, y: 50, size: 0.5, color: OR, intensity: 1.2 }],
	'img-fete': [{ kind: 'feu', x: 50, y: 55, size: 0.6, intensity: 0.8 }],
};

/**
 * Composition des images : où placer les éléments importants, pour que les lumières vivantes (LIGHTS)
 * tombent au bon endroit. Positions en tiers et en quarts de l'image, faciles à comprendre pour une IA.
 * Après génération, les lumières sont recalées sur l'image réelle si besoin.
 */
export const COMPOSITIONS: Record<string, string> = {
	'img-couverture': 'L’auberge au centre, un peu sous la mi-hauteur ; la forêt noire et la petite lueur bleue au fond à droite ; les quatre aventuriers de dos au premier plan, en bas à gauche. Haut de l’image dégagé (ciel) pour le titre.',
	'img-route-brume': 'Une seule petite fenêtre jaune allumée, tout en haut de la colline, au tiers droit de l’image et dans son tiers supérieur. La route monte vers elle depuis le bas à gauche. Brume basse au premier plan.',
	'img-auberge-porte': 'La porte de chêne au centre ; une lanterne allumée accrochée juste au-dessus de la porte, au centre, un peu au-dessus de la mi-hauteur. L’enseigne du chaudron fêlé en haut, légèrement à droite. Brume au sol.',
	'img-salle-commune': 'La grande cheminée allumée sur le côté droit (au quart droit de l’image, à mi-hauteur), c’est elle qui éclaire la salle. Les tables et les personnages s’étendent vers la gauche, dans une lumière plus douce.',
	'img-cuisine': 'Le four à pain allumé sur la gauche (au quart gauche, un peu sous la mi-hauteur). Marmites et saucisses pendues au centre et à droite.',
	'img-cave': 'Une lanterne faible accrochée en haut à gauche ; le reste dans la pénombre. Le tonneau couché d’où sort un filet de brume au centre-droit.',
	'img-pff': 'La petite créature de brume au centre exact de l’image, ses grands yeux bleus lumineux bien au milieu.',
	'img-cour': 'L’écurie sur la gauche, sa lanterne allumée au quart gauche un peu au-dessus de la mi-hauteur. La roulotte bâchée au centre, avec une fente dorée qui luit au centre de l’image, juste sous la mi-hauteur. Brume au sol.',
	'img-ecurie': 'Une lanterne accrochée à une poutre, un peu à droite du centre, dans le tiers supérieur. La jument à gauche, le garçon sur sa botte de paille à droite, en bas.',
	'img-grenier': 'Le chat noir sur une poutre, en haut au centre. La lumière monte d’en bas, par le trou de l’échelle au centre bas de l’image.',
	'img-roulotte': 'L’intérieur sous la bâche ; le petit coffret qui luit d’une lumière dorée au centre, légèrement à droite et sous la mi-hauteur.',
	'img-place': 'Le vieux puits sous son petit toit au centre ; le moulin au fond à droite ; le chemin de la forêt qui part à gauche. Brume au sol au premier plan.',
	'img-puits': 'Le puits vu de près, au centre ; une très faible lueur argentée tout au fond, au centre de l’image, sous la mi-hauteur.',
	'img-fond-puits': 'La pierre gravée d’une lanterne qui luit, au centre exact de l’image, sur la paroi.',
	'img-moulin': 'La chambre de Lisette sous le toit ; la fenêtre ouverte en haut à droite ; la traînée de poussière bleue part du centre bas de l’image vers la fenêtre.',
	'img-lisiere': 'Le mur d’arbres noirs ; une minuscule lumière bleue entre les troncs, un peu à droite du centre, à mi-hauteur. La hutte au bord droit, sa fenêtre verte allumée à mi-hauteur. Brume au sol.',
	'img-hutte': 'L’âtre de la hutte un peu à gauche du centre, à mi-hauteur ; Corvine et ses herbes pendues autour.',
	'img-sous-bois-nuit': 'Sous les arbres, presque noir ; la lumière bleue au centre, un peu au-dessus de la mi-hauteur, entre deux troncs. Brume au sol.',
	'img-tempete': 'Le village sous l’orage ; ciel sombre et dégagé dans toute la moitié haute (pour les éclairs). Brume et pluie au premier plan.',
	'img-brumelins': 'Les brumelins groupés au centre, leurs yeux bleus rassemblés au centre de l’image, juste sous la mi-hauteur. Brume au sol.',
	'img-repos': 'Une bougie sur la table de chevet à gauche, à mi-hauteur ; les lits à droite.',
	'img-defaite': 'Une bougie sur la table de chevet à gauche, à mi-hauteur ; Berthe penchée au-dessus d’un lit à droite.',
	'img-oree': 'Les trois chemins qui partent du centre de l’image ; brume basse au premier plan.',
	'img-pierres-levees': 'L’allée de pierres dressées qui file vers le centre ; brume basse au premier plan.',
	'img-ravin': 'Le ravin qui plonge au centre ; brume au premier plan.',
	'img-gue': 'Le héron de brume lumineux au centre de la rivière, un peu au-dessus de la mi-hauteur.',
	'img-clairiere': 'La ronde des brumelins au centre, juste sous la mi-hauteur ; Gaspard suspendu dans un filet en haut, au centre. Brume au sol.',
	'img-clairiere-vide': 'La clairière ronde, un filet vide pendu en haut au centre. Brume au sol.',
	'img-loup': 'Le Loup de Cendre au centre exact de l’image, ses braises rougeoyantes bien au milieu.',
	'img-loup-apaise': 'Le grand loup couché au centre, un peu sous la mi-hauteur.',
	'img-louveteau': 'Le petit louveteau de braise au centre, sous la mi-hauteur.',
	'img-sanctuaire': 'La lanterne de bronze sur l’autel et le cocon argenté de Lisette au centre de l’image. Brume au sol.',
	'img-dame-grise': 'La Dame Grise au centre, son visage un peu au-dessus de la mi-hauteur. Brume autour.',
	'img-coeur-lumiere': 'La lanterne qui s’illumine au centre exact de l’image.',
	'img-fete': 'La grande cheminée et la fête au centre ; la lumière du feu au centre, à mi-hauteur.',
	'img-depart': 'Toute l’auberge réunie dans la cour à gauche ; les héros au centre, de dos, face au chemin qui part à droite vers la forêt. Ciel pâle de l’aube en haut.',
	'img-terriers': 'Le tunnel qui file vers le centre de l’image ; mousse bleue lumineuse sur les parois ; Pff de dos au centre bas.',
	'img-retour': 'Le chemin qui descend vers la vallée au centre ; le village et l’auberge tout au fond, au centre ; lumière dorée du matin.',
};

/** Les portraits s'affichent en petit, découpés en rond : visage bien centré, cadrage serré. */
const PORTRAIT_COMPOSITION =
	'Portrait en buste, format carré : le visage bien au centre, cadrage serré (de la tête aux épaules), regard vers le spectateur, fond sombre et simple. L’image sera découpée en rond : rien d’important dans les coins.';
for (const asset of MEDIA) if (asset.id.startsWith('portrait-')) COMPOSITIONS[asset.id] = PORTRAIT_COMPOSITION;
for (const asset of MEDIA) {
	const c = COMPOSITIONS[asset.id];
	if (c) asset.composition = c;
}
