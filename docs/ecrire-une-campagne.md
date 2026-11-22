# Écrire une campagne

Format technique des scènes. Les règles d’écriture sont dans `conventions.md`.

## Une scène

```ts
{
	id: 'cuisine',                 // unique dans la campagne
	title: 'La cuisine de Berthe', // affiché en grand sur l’image
	chapter: 1,
	zone: 'auberge',               // voir ZONES dans bible.ts
	hub: true,                     // (optionnel) scène pivot : remet l’excursion à zéro
	next: 'salle-commune',         // (optionnel) ajoute les choix de ce lieu (« Ou bien, ailleurs : »)
	noRecall: true,                // (optionnel) jamais interrompue par un rappel
	media: { image, video, music, musicNow, ambience, sfx: [] },   // identifiants du catalogue media.ts
	lines: [{ who: 'berthe', text: '…', if: [conditions] }],
	onEnter: [effets],
	redirects: [{ if: [conditions], to: 'autre-scene' }],
	choices: [
		{ label: 'Descendre', to: 'cave', if: [...], effects: [...], once: true },
		{ label: 'Grimper', check: { stat: 'agilite', difficulty: 'moyen',
			success: { to: 'haut', text: 'Phrase lue après le dé', effects: [...] },
			failure: { to: 'bas', effects: [{ damage: 1, target: 'random' }] } } },
	],
	combat: { enemy: { name, hearts, difficulty, damage, brume, image }, victory, defeat, talk, flee },
	ending: { title, text, unlock: 'id-campagne-suivante' },
}
```

## Conditions (`if`)

`{ flag }` `{ notFlag }` `{ item }` `{ notItem }` `{ quest, status: 'none'|'active'|'done'|'failed' }`
`{ visited }` `{ notVisited }` `{ min: 2, of: [drapeaux] }` `{ gold: 5 }` `{ hasClass: 'mage' }` `{ firstVisit: true|false }`

## Effets

`{ setFlag }` `{ clearFlag }` `{ addItem, qty }` `{ removeItem }` `{ gold: ±n }` `{ heal: n|'full' }`
`{ damage: n, target: 'all'|'random' }` `{ xp: n }` `{ quest, status }` `{ rest: true }` `{ message }`
Chaque effet accepte aussi un `if`.

## La laisse (liberté encadrée)

Dans `ZONES`, une zone peut avoir `leash: 3` et `recalls: ['rappel-tempete', …]`.
Après 3 scènes d’affilée dans cette zone (ou 9 au total loin du pivot), la scène suivante est remplacée
par un rappel jamais vu (tempête, cloche, garde…) qui ramène au pivot. `leashUntil: 'ch2'` coupe la laisse
quand le drapeau est posé (le scénario avance).

Entrer dans une zone sans laisse (l’auberge) remet aussi l’excursion à zéro.

## Règles du jeu

Les règles d’écriture (digressions à chaque étape, fils narratifs, au moins deux choix, rappels qu’on peut refuser,
voix, musique, ambiances) sont dans **`conventions.md`**. À lire avant d’écrire une scène.

## Recette d’une bonne quête secondaire

1. Un PNJ du pivot l’annonce, ou on tombe dessus en explorant.
2. Deux façons de la résoudre (un dé, ou un objet/une gentillesse).
3. Une récompense **utile plus tard** dans l’intrigue principale (objet, allié, raccourci, indice).
4. Une scène de récompense `noRecall`.

## Médias

Chaque identifiant cité dans `media` doit exister dans `media.ts` (ou dans le catalogue commun).
Prompt = ce qu’on voit ou entend précisément ; le guide de style s’ajoute tout seul.
