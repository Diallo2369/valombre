/** id de média → URL publique du fichier présent. Les versions supplémentaires d'une musique sont rangées sous « id~2 », « id~3 »… */
export type MediaMap = Record<string, string>;

/** Toutes les versions présentes d'un média, dans l'ordre (mus-route.mp3, mus-route-2.mp3…). */
export function mediaVariants(media: MediaMap, id: string | undefined): string[] {
	if (!id || !media[id]) return [];
	const urls = [media[id]];
	for (let n = 2; media[`${id}~${n}`]; n++) urls.push(media[`${id}~${n}`]);
	return urls;
}
