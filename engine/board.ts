/**
 * Le plateau de combat : des hexagones « pointe en haut », rangées impaires décalées vers la droite.
 * Les monstres commencent en haut, les aventuriers en bas.
 */

export interface Hex {
	c: number;
	r: number;
}

export const BOARD = { cols: 7, rows: 6 };

export const hexKey = (h: Hex) => `${h.c},${h.r}`;
export const sameHex = (a: Hex, b: Hex) => a.c === b.c && a.r === b.r;
export const inBoard = (h: Hex) => h.c >= 0 && h.c < BOARD.cols && h.r >= 0 && h.r < BOARD.rows;

function cube(h: Hex) {
	const x = h.c - (h.r - (h.r & 1)) / 2;
	const z = h.r;
	return { x, y: -x - z, z };
}

/** Nombre de cases entre deux hexagones (1 = côte à côte). */
export function distance(a: Hex, b: Hex): number {
	const p = cube(a);
	const q = cube(b);
	return Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y), Math.abs(p.z - q.z));
}

const EVEN = [
	[1, 0],
	[0, -1],
	[-1, -1],
	[-1, 0],
	[-1, 1],
	[0, 1],
];
const ODD = [
	[1, 0],
	[1, -1],
	[0, -1],
	[-1, 0],
	[0, 1],
	[1, 1],
];

export function neighbors(h: Hex): Hex[] {
	return (h.r & 1 ? ODD : EVEN).map(([dc, dr]) => ({ c: h.c + dc, r: h.r + dr })).filter(inBoard);
}

/** Cases atteignables en `steps` pas au plus, sans traverser une case occupée (la case de départ exclue). */
export function reachable(from: Hex, steps: number, occupied: Set<string>): Hex[] {
	const seen = new Map<string, number>([[hexKey(from), 0]]);
	const queue: Hex[] = [from];
	const out: Hex[] = [];
	while (queue.length) {
		const h = queue.shift()!;
		const d = seen.get(hexKey(h))!;
		if (d >= steps) continue;
		for (const n of neighbors(h)) {
			const k = hexKey(n);
			if (seen.has(k) || occupied.has(k)) continue;
			seen.set(k, d + 1);
			out.push(n);
			queue.push(n);
		}
	}
	return out;
}

/**
 * Le chemin le plus court vers une case d'où l'on peut frapper `target` (à `range` cases au plus),
 * limité à `steps` pas. Renvoie la case d'arrivée (ou `from` si on est déjà à portée ou bloqué).
 */
export function approach(from: Hex, target: Hex, range: number, steps: number, occupied: Set<string>): Hex {
	if (distance(from, target) <= range) return from;
	const prev = new Map<string, Hex | null>([[hexKey(from), null]]);
	const queue: Hex[] = [from];
	let goal: Hex | null = null;
	while (queue.length && !goal) {
		const h = queue.shift()!;
		for (const n of neighbors(h)) {
			const k = hexKey(n);
			if (prev.has(k) || occupied.has(k)) continue;
			prev.set(k, h);
			if (distance(n, target) <= range) {
				goal = n;
				break;
			}
			queue.push(n);
		}
	}
	// Pas de chemin libre : on se rapproche à vol d'oiseau, case par case.
	if (!goal) {
		let best = from;
		for (const h of reachable(from, steps, occupied)) if (distance(h, target) < distance(best, target)) best = h;
		return best;
	}
	const path: Hex[] = [];
	for (let h: Hex | null = goal; h && !sameHex(h, from); h = prev.get(hexKey(h)) ?? null) path.unshift(h);
	return path[Math.min(steps, path.length) - 1] ?? from;
}

/** Placement de départ : les combattants au contact devant, les autres derrière, centrés. */
export function startPositions(count: number, rows: number[]): Hex[] {
	const out: Hex[] = [];
	const order = [3, 2, 4, 1, 5, 0, 6];
	for (const r of rows) for (const c of order) if (out.length < count) out.push({ c, r });
	return out;
}

/* ---- Dessin (unités du viewBox SVG : un hexagone fait 100 de large) ---- */
export const HEX_W = 100;
export const HEX_H = 115.47;
export const BOARD_W = (BOARD.cols + 0.5) * HEX_W;
export const BOARD_H = ((BOARD.rows - 1) * 0.75 + 1) * HEX_H;

export function center(h: Hex): { x: number; y: number } {
	return { x: h.c * HEX_W + HEX_W / 2 + (h.r & 1 ? HEX_W / 2 : 0), y: h.r * HEX_H * 0.75 + HEX_H / 2 };
}

export function hexPoints(h: Hex, inset = 3): string {
	const { x, y } = center(h);
	const rad = HEX_H / 2 - inset;
	return Array.from({ length: 6 }, (_, i) => {
		const a = (Math.PI / 180) * (60 * i - 90);
		return `${(x + rad * Math.cos(a)).toFixed(1)},${(y + rad * Math.sin(a)).toFixed(1)}`;
	}).join(' ');
}
