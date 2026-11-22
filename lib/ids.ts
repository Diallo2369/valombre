/** Identifiant aléatoire lisible (navigateur et serveur). */
export function newId(prefix = ''): string {
	const bytes = new Uint8Array(9);
	globalThis.crypto.getRandomValues(bytes);
	const id = Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 14);
	return prefix ? `${prefix}_${id}` : id;
}
