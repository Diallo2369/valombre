/**
 * Les effets de combat : une dizaine de familles (entaille, projectile, tourbillon, rayon, bulle, notes…),
 * réglées par compétence. Chaque effet renvoie le moment (ms) où il touche sa cible : c'est là que les
 * cœurs tombent et que le jeton tremble.
 */
import { ease, glowFill, glowStroke, INK, lerp, starPath, type FxEngine, type P } from './fx-engine';

export interface FxCall {
	from: P;
	/** Créatures visées. */
	foes: P[];
	/** Compagnons visés (soin, bouclier, intervention) ; pour un chant, tout le groupe. */
	allies: P[];
	success: boolean;
	crit: boolean;
}

type Fx = (eng: FxEngine, c: FxCall) => number;

const angleTo = (a: P, b: P) => Math.atan2(b.y - a.y, b.x - a.x);
const dist = (a: P, b: P) => Math.hypot(b.x - a.x, b.y - a.y);
/** Une cible ratée : le coup passe à côté. */
const beside = (from: P, to: P): P => {
	const a = angleTo(from, to) + (Math.random() < 0.5 ? 0.35 : -0.35);
	const d = dist(from, to) * 1.25;
	return { x: from.x + Math.cos(a) * d, y: from.y + Math.sin(a) * d };
};

/* ---------------- Les briques ---------------- */

/** Une explosion de lumière en étoile, qui surgit puis se replie. */
function burstStar(eng: FxEngine, at: P, fill: string, inner: string, r: number, delay = 0, life = 300) {
	const spikes = Array.from({ length: 12 }, (_, i) => (i % 2 ? 0.5 : 1) * (0.85 + Math.random() * 0.3));
	const rot = Math.random() * Math.PI;
	eng.draw({
		life,
		delay,
		draw(ctx, t) {
			// Surgit en dépassant, puis se replie (on rétrécit au lieu de s'effacer).
			const k = t < 0.35 ? ease.out(t / 0.35) * 1.15 : 1.15 * (1 - ease.in((t - 0.35) / 0.65));
			if (k <= 0.02) return;
			ctx.globalCompositeOperation = 'source-over';
			for (const [col, m, line] of [
				[fill, 1, 4],
				[inner, 0.55, 3],
			] as const) {
				ctx.beginPath();
				spikes.forEach((sp, i) => {
					const a = rot + (i / spikes.length) * Math.PI * 2;
					ctx.lineTo(at.x + Math.cos(a) * r * k * m * sp, at.y + Math.sin(a) * r * k * m * sp);
				});
				ctx.closePath();
				glowFill(ctx, col, line);
			}
		},
	});
}

/** L'impact : un éclair bref, une explosion de lumière en étoile, une onde, des éclats et des reflets à 4 branches. */
export function impact(eng: FxEngine, at: P, colors: string[], power = 1, delay = 0) {
	const main = colors[1] ?? colors[0];
	const light = colors[0];
	// Un éclair de lumière très bref, sous le dessin.
	eng.add({ x: at.x, y: at.y, life: 180, delay, size: 50 * power, sizeEnd: 85 * power, color: '#ffffff', alpha: 0.8 });
	burstStar(eng, at, main, light === main ? '#ffffff' : light, 58 * power, delay, 320);
	// Une onde blanche lumineuse.
	eng.add({ x: at.x, y: at.y, life: 380, delay: delay + 30, size: 22, sizeEnd: 105 * power, color: '#ffffff', shape: 'ring', neon: true });
	// Des éclats pleins qui partent et retombent, quelques étoiles.
	eng.burst(at, Math.round(10 * power), { speed: 420 * power, life: 620, delay, size: 6, sizeEnd: 2, color: colors, ay: 900, drag: 1.2, neon: true });
	eng.burst(at, Math.round(8 * power), { speed: 520 * power, life: 380, delay, size: 6, color: colors, shape: 'spark', drag: 2.4, neon: true });
	eng.burst(at, Math.round(3 * power), { speed: 260 * power, life: 700, delay: delay + 40, size: 9, sizeEnd: 4, color: ['#ffe28a', '#ffffff'], shape: 'star', vr: 8, ay: 500, drag: 1, neon: true });
	// Les reflets : des étincelles à 4 branches qui scintillent autour du point d'impact.
	for (let i = 0; i < Math.round(3 + 2 * power); i += 1) {
		const a = Math.random() * Math.PI * 2;
		const d = 18 + Math.random() * 46 * power;
		eng.add({ x: at.x + Math.cos(a) * d, y: at.y + Math.sin(a) * d, life: 420 + Math.random() * 260, delay: delay + 40 + i * 45, size: 12 + Math.random() * 12 * power, sizeEnd: 2, rot: Math.random(), vr: 2, color: main, shape: 'twinkle' });
	}
}

/** Le coup tombe à côté : un petit nuage de fumée. */
function puff(eng: FxEngine, at: P, delay = 0) {
	const blobs = Array.from({ length: 6 }, (_, i) => {
		const a = (i / 6) * Math.PI * 2 + Math.random() * 0.4;
		return { dx: Math.cos(a) * 20, dy: Math.sin(a) * 12, r: 13 + Math.random() * 7 };
	});
	eng.draw({
		life: 620,
		delay,
		draw(ctx, t) {
			const k = t < 0.3 ? ease.out(t / 0.3) : 1 - ease.in((t - 0.3) / 0.7);
			if (k <= 0.02) return;
			ctx.globalCompositeOperation = 'source-over';
			const rise = -18 * t;
			// Une fumée douce : des boules grises qui se fondent.
			for (const b of blobs) {
				const x = at.x + b.dx * (0.6 + t);
				const y = at.y + b.dy * (0.6 + t) + rise;
				const g = ctx.createRadialGradient(x, y, 0, x, y, b.r * k * 1.3);
				g.addColorStop(0, 'rgba(215,219,228,0.7)');
				g.addColorStop(1, 'rgba(215,219,228,0)');
				ctx.fillStyle = g;
				ctx.beginPath();
				ctx.arc(x, y, b.r * k * 1.3, 0, Math.PI * 2);
				ctx.fill();
			}
		},
	});
}

/** Une entaille en arc de cercle : un croissant de lumière, avec un filet blanc au milieu. */
export function slash(eng: FxEngine, at: P, color: string, angle: number, delay = 0, k = 1, life = 340) {
	const R = 70 * k;
	const c = { x: at.x - Math.cos(angle) * R * 0.45, y: at.y - Math.sin(angle) * R * 0.45 };
	const a0 = angle - 1.3;
	const a1 = angle + 1.3;
	const thick = 24 * k;
	eng.draw({
		life,
		delay,
		draw(ctx, t) {
			const head = ease.out(Math.min(1, t * 1.8));
			const tail = Math.max(0, (t - 0.35) / 0.65);
			if (head - tail < 0.01) return;
			const N = 24;
			const pt = (u: number, r: number) => {
				const b = a0 + (a1 - a0) * u;
				return [c.x + Math.cos(b) * r, c.y + Math.sin(b) * r] as const;
			};
			// Le croissant : bord extérieur, puis bord intérieur à rebours (épais au milieu, pointu aux bouts).
			ctx.globalCompositeOperation = 'source-over';
			ctx.beginPath();
			for (let i = 0; i <= N; i += 1) ctx.lineTo(...pt(tail + ((head - tail) * i) / N, R));
			for (let i = N; i >= 0; i -= 1) {
				const u = i / N;
				ctx.lineTo(...pt(tail + (head - tail) * u, R - thick * Math.sin(Math.PI * u)));
			}
			ctx.closePath();
			glowFill(ctx, color, 4);
			ctx.beginPath();
			for (let i = 2; i <= N - 2; i += 1) ctx.lineTo(...pt(tail + ((head - tail) * i) / N, R - thick * 0.3 * Math.sin((Math.PI * i) / N)));
			ctx.lineCap = 'round';
			ctx.strokeStyle = '#ffffff';
			ctx.lineWidth = 4 * k;
			ctx.stroke();
		},
	});
}

/** Un trait droit lumineux qui se dessine puis s'efface (griffes, rayons). */
function streak(eng: FxEngine, a: P, b: P, color: string, width: number, delay = 0, life = 280) {
	eng.draw({
		life,
		delay,
		draw(ctx, t) {
			const head = ease.out(Math.min(1, t * 2));
			const tail = Math.max(0, (t - 0.35) / 0.65);
			const p = lerp(a, b, tail);
			const q = lerp(a, b, head);
			ctx.globalCompositeOperation = 'source-over';
			ctx.beginPath();
			ctx.moveTo(p.x, p.y);
			ctx.lineTo(q.x, q.y);
			glowStroke(ctx, color, width, 3.5);
			ctx.strokeStyle = '#fff';
			ctx.lineWidth = width * 0.3;
			ctx.stroke();
		},
	});
}

interface ProjectileOpts {
	color: string;
	head?: 'arrow' | 'orb' | 'glyph' | 'net' | 'axe';
	glyph?: string;
	speed?: number;
	arc?: number;
	size?: number;
	delay?: number;
	wobble?: number;
	trail?: string;
}

/** Un projectile qui vole d'un point à un autre (flèche, orbe, note…), en néon. Renvoie sa durée de vol. */
export function projectile(eng: FxEngine, from: P, to: P, o: ProjectileOpts) {
	const { color, head = 'orb', speed = 900, arc = 0, size = 8, delay = 0, wobble = 0, trail = color } = o;
	const life = Math.max(160, (dist(from, to) / speed) * 1000);
	const a = angleTo(from, to);
	let last: P = from;
	let n = 0;
	eng.draw({
		life,
		delay,
		draw(ctx, t, e) {
			const base = lerp(from, to, t);
			const lift = Math.sin(Math.PI * t) * arc;
			const side = Math.sin(t * Math.PI * 4) * wobble;
			const p = { x: base.x - Math.sin(a) * side, y: base.y - lift + Math.cos(a) * side };
			const dir = Math.atan2(p.y - last.y, p.x - last.x) || a;
			last = p;
			// La traînée : des pastilles pleines qui rétrécissent, une sur deux.
			n += 1;
			if (n % 2) e.add({ x: p.x, y: p.y, life: 300, size: size * 1.1, sizeEnd: 0.5, color: trail, neon: true, core: false });
			ctx.globalCompositeOperation = 'source-over';
			if (head === 'arrow') {
				ctx.translate(p.x, p.y);
				ctx.rotate(dir);
				// Le trait de vitesse derrière, la hampe, l'empennage et la pointe, tout en lumière.
				ctx.beginPath();
				ctx.moveTo(-70, 0);
				ctx.lineTo(-38, 0);
				glowStroke(ctx, '#ffffff', 3, 2);
				ctx.beginPath();
				ctx.moveTo(-32, 0);
				ctx.lineTo(6, 0);
				glowStroke(ctx, '#c89a5a', 5, 2.5);
				for (const sgn of [-1, 1]) {
					ctx.beginPath();
					ctx.moveTo(-34, 0);
					ctx.lineTo(-24, 0);
					ctx.lineTo(-30, sgn * 9);
					ctx.lineTo(-40, sgn * 9);
					ctx.closePath();
					glowFill(ctx, color, 2.5);
				}
				ctx.beginPath();
				ctx.moveTo(18, 0);
				ctx.lineTo(2, -9);
				ctx.lineTo(6, 0);
				ctx.lineTo(2, 9);
				ctx.closePath();
				glowFill(ctx, '#eef2f8', 3);
			} else if (head === 'glyph') {
				ctx.font = `900 ${size * 3.6}px "Arial Black", Impact, serif`;
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.globalCompositeOperation = 'lighter';
				ctx.shadowColor = color;
				ctx.shadowBlur = 18;
				ctx.fillStyle = color;
				ctx.fillText(o.glyph ?? '♪', p.x, p.y);
				ctx.shadowBlur = 0;
				ctx.lineWidth = 1.5;
				ctx.strokeStyle = '#ffffff';
				ctx.strokeText(o.glyph ?? '♪', p.x, p.y);
			} else if (head === 'axe') {
				// La hache qui tournoie : un manche en bois et une lame d'acier en croissant.
				ctx.translate(p.x, p.y);
				ctx.rotate(t * 16);
				ctx.beginPath();
				ctx.moveTo(-16, 0);
				ctx.lineTo(16, 0);
				glowStroke(ctx, '#c89a5a', 4, 0);
				ctx.beginPath();
				ctx.moveTo(8, -3);
				ctx.quadraticCurveTo(22, -16, 24, 0);
				ctx.quadraticCurveTo(22, 16, 8, 3);
				ctx.closePath();
				glowFill(ctx, '#ffd0a0', 2.5);
			} else if (head === 'net') {
				// Le filet roulé en boule, qui tourne en vol.
				ctx.translate(p.x, p.y);
				ctx.rotate(t * 9);
				ctx.beginPath();
				ctx.arc(0, 0, 15, 0, Math.PI * 2);
				glowFill(ctx, '#d8b57a', 3.5);
				ctx.strokeStyle = '#7a5428';
				ctx.lineWidth = 2.5;
				for (const r of [6, 11]) {
					ctx.beginPath();
					ctx.ellipse(0, 0, 15, r, 0, 0, Math.PI * 2);
					ctx.stroke();
				}
				ctx.beginPath();
				ctx.moveTo(0, -15);
				ctx.lineTo(0, 15);
				ctx.stroke();
			} else {
				// L'orbe : un halo lumineux derrière, une boule brillante et un reflet.
				const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 3);
				g.addColorStop(0, color);
				g.addColorStop(1, 'rgba(0,0,0,0)');
				ctx.globalCompositeOperation = 'lighter';
				ctx.fillStyle = g;
				ctx.globalAlpha = 0.6;
				ctx.beginPath();
				ctx.arc(p.x, p.y, size * 3, 0, Math.PI * 2);
				ctx.fill();
				ctx.globalAlpha = 1;
				ctx.globalCompositeOperation = 'source-over';
				ctx.beginPath();
				ctx.arc(p.x, p.y, size * 1.5, 0, Math.PI * 2);
				glowFill(ctx, color, 3.5);
				ctx.beginPath();
				ctx.arc(p.x - size * 0.5, p.y - size * 0.5, size * 0.45, 0, Math.PI * 2);
				ctx.fillStyle = '#ffffff';
				ctx.fill();
			}
		},
	});
	return delay + life;
}

/** Des étoiles qui tournent au-dessus d'une tête (sonné). */
function dizzy(eng: FxEngine, at: P, delay: number, color = '#ffe28a') {
	eng.draw({
		life: 1300,
		delay,
		draw(ctx, t) {
			ctx.globalCompositeOperation = 'source-over';
			ctx.globalAlpha = t < 0.8 ? 1 : (1 - t) / 0.2;
			for (let i = 0; i < 3; i += 1) {
				const a = t * Math.PI * 4 + (i * Math.PI * 2) / 3;
				starPath(ctx, at.x + Math.cos(a) * 32, at.y - 48 + Math.sin(a) * 10, 10, a);
				glowFill(ctx, color, 3);
			}
		},
	});
}

/** Une bulle protectrice lumineuse qui se gonfle autour d'un jeton. */
function bubble(eng: FxEngine, at: P, color: string, delay = 0) {
	eng.draw({
		life: 950,
		delay,
		draw(ctx, t) {
			// Gonfle en dépassant, puis rebondit.
			const g = Math.min(1, t * 2.4);
			const r = 52 * (g < 1 ? ease.out(g) * 1.12 : 1.12 - 0.12 * ease.out(Math.min(1, (t - 0.42) * 4)));
			ctx.globalCompositeOperation = 'source-over';
			ctx.globalAlpha = t < 0.7 ? 1 : (1 - t) / 0.3;
			ctx.beginPath();
			ctx.arc(at.x, at.y, r, 0, Math.PI * 2);
			ctx.fillStyle = color.replace(')', ' / 22%)');
			ctx.fill();
			glowStroke(ctx, color, 5, 2.5);
			// Le reflet de la bulle.
			ctx.beginPath();
			ctx.arc(at.x, at.y, r * 0.78, -2.5, -1.6);
			ctx.strokeStyle = '#fff';
			ctx.lineWidth = 5;
			ctx.lineCap = 'round';
			ctx.stroke();
		},
	});
}

/** Des symboles lumineux qui montent et s'envolent (notes, « z », « + »). */
function rising(eng: FxEngine, at: P, glyphs: string[], color: string, n: number, delay = 0, size = 18) {
	for (let i = 0; i < n; i += 1)
		eng.add({
			x: at.x + (Math.random() - 0.5) * 50,
			y: at.y + 10,
			vx: (Math.random() - 0.5) * 40,
			vy: -70 - Math.random() * 60,
			life: 1000,
			delay: delay + i * 80,
			size: size * 1.3,
			color,
			shape: 'glyph',
			glyph: glyphs[i % glyphs.length],
			vr: (Math.random() - 0.5) * 2,
			neon: true,
		});
}

/** Les griffes d'une créature : trois balafres de lumière. */
function claws(eng: FxEngine, from: P, at: P, color: string) {
	const a = angleTo(from, at) + Math.PI / 2.6;
	const dx = Math.cos(a) * 38;
	const dy = Math.sin(a) * 38;
	const nx = -Math.sin(a) * 15;
	const ny = Math.cos(a) * 15;
	for (let i = -1; i <= 1; i += 1)
		streak(eng, { x: at.x - dx + nx * i, y: at.y - dy + ny * i }, { x: at.x + dx + nx * i, y: at.y + dy + ny * i }, color, 8, (i + 1) * 45);
	return 160;
}

/** Une morsure : deux mâchoires à grosses dents blanches qui se referment. */
function bite(eng: FxEngine, at: P, color: string) {
	eng.draw({
		life: 380,
		draw(ctx, t) {
			const close = ease.in(Math.min(1, t * 1.6));
			const gap = 38 * (1 - close) + 6;
			ctx.globalCompositeOperation = 'source-over';
			ctx.globalAlpha = 1 - Math.max(0, t - 0.65) / 0.35;
			for (const sgn of [-1, 1]) {
				const y = at.y + sgn * gap;
				// Les dents, pointées vers le centre.
				for (let i = -2; i <= 2; i += 1) {
					const x = at.x + i * 12;
					const yy = y - sgn * Math.abs(i) * 3;
					ctx.beginPath();
					ctx.moveTo(x - 6, yy);
					ctx.lineTo(x, yy - sgn * 15);
					ctx.lineTo(x + 6, yy);
					ctx.closePath();
					glowFill(ctx, '#ffffff', 2.5);
				}
				// La mâchoire.
				ctx.beginPath();
				ctx.moveTo(at.x - 36, y + sgn * 10);
				ctx.quadraticCurveTo(at.x, y + sgn * 2 - sgn * 8, at.x + 36, y + sgn * 10);
				glowStroke(ctx, color, 7, 3);
			}
		},
	});
	return 230;
}

/**
 * Le filet qui retombe sur la cible : des cordes épaisses qui partent d'un nœud en haut,
 * reliées par des mailles arrondies, lestées de petits plombs. Il tombe, s'écrase un peu, puis tient.
 */
function net(eng: FxEngine, at: P, delay: number) {
	const ROPE = '#d8b57a';
	const W = 46;
	const H = 50;
	const legs = 7;
	eng.draw({
		life: 1300,
		delay,
		draw(ctx, t) {
			const fall = ease.in(Math.min(1, t / 0.18));
			const squash = t < 0.18 ? 1 : 1 - 0.22 * Math.sin(Math.min(1, (t - 0.18) / 0.22) * Math.PI);
			const dy = (1 - fall) * -80;
			ctx.globalCompositeOperation = 'source-over';
			ctx.globalAlpha = t < 0.8 ? 1 : (1 - t) / 0.2;
			ctx.translate(at.x, at.y + dy + H * 0.45);
			ctx.scale(1 + (1 - squash) * 0.6, squash);
			const top = { x: 0, y: -H * 1.25 };
			// Le bas du filet : une ligne qui ondule, sous le jeton.
			const foot = (u: number) => ({ x: -W + 2 * W * u, y: 4 * Math.sin(u * Math.PI * 3) });
			const along = (u: number, v: number) => {
				// Point sur la corde u, à la hauteur v (0 : nœud du haut, 1 : bas), qui bombe vers l'extérieur.
				const f = foot(u);
				const bow = (u - 0.5) * 34 * Math.sin(Math.PI * v);
				return { x: top.x + (f.x - top.x) * v + bow, y: top.y + (f.y - top.y) * v };
			};
			// Les cordes verticales.
			for (let i = 0; i < legs; i += 1) {
				const u = i / (legs - 1);
				ctx.beginPath();
				for (let j = 0; j <= 12; j += 1) {
					const q = along(u, j / 12);
					ctx.lineTo(q.x, q.y);
				}
				glowStroke(ctx, ROPE, 4, 2);
			}
			// Les mailles : des cordes en travers, en arc.
			for (const v of [0.35, 0.6, 0.85, 1]) {
				ctx.beginPath();
				for (let j = 0; j <= 18; j += 1) {
					const q = along(j / 18, v);
					ctx.lineTo(q.x, q.y + Math.sin((j / 18) * Math.PI) * 6 * v);
				}
				glowStroke(ctx, ROPE, 4, 2);
			}
			// Les nœuds aux croisements, le gros nœud du haut et les plombs.
			for (let i = 0; i < legs; i += 1)
				for (const v of [0.35, 0.6, 0.85]) {
					const u = i / (legs - 1);
					const q = along(u, v);
					ctx.beginPath();
					ctx.arc(q.x, q.y + Math.sin(u * Math.PI) * 6 * v, 3.2, 0, Math.PI * 2);
					glowFill(ctx, '#a87a3e', 1.8);
				}
			ctx.beginPath();
			ctx.arc(top.x, top.y, 8, 0, Math.PI * 2);
			glowFill(ctx, '#a87a3e', 3);
			for (let i = 0; i < legs; i += 1) {
				const q = along(i / (legs - 1), 1);
				ctx.beginPath();
				ctx.arc(q.x, q.y + 6, 5, 0, Math.PI * 2);
				glowFill(ctx, '#6d7480', 2.5);
			}
		},
	});
}

/**
 * Un nuage de poison lumineux : des boules vertes qui gonflent, ondulent et montent,
 * des bulles qui éclatent et une petite tête de mort qui s'échappe.
 */
function poisonCloud(eng: FxEngine, at: P, delay = 0, k = 1) {
	const blobs = Array.from({ length: 7 }, (_, i) => {
		const a = (i / 7) * Math.PI * 2 + Math.random() * 0.5;
		return { dx: Math.cos(a) * 24 * k, dy: Math.sin(a) * 14 * k - 6, r: (15 + Math.random() * 9) * k, ph: Math.random() * 6 };
	});
	eng.draw({
		life: 1500,
		delay,
		draw(ctx, t) {
			// Gonfle en dépassant, ondule, puis se dissipe en rétrécissant.
			const g = t < 0.22 ? ease.out(t / 0.22) * 1.18 : t < 0.35 ? 1.18 - 0.18 * ease.inOut((t - 0.22) / 0.13) : t < 0.75 ? 1 : 1 - ease.in((t - 0.75) / 0.25);
			if (g <= 0.02) return;
			ctx.globalCompositeOperation = 'source-over';
			const rise = -22 * t * k;
			const pos = (b: (typeof blobs)[number]) => ({
				x: at.x + b.dx * (0.7 + 0.5 * t) + Math.sin(t * 9 + b.ph) * 3,
				y: at.y + b.dy + rise + Math.cos(t * 7 + b.ph) * 2,
				r: b.r * g * (1 + 0.06 * Math.sin(t * 12 + b.ph)),
			});
			// Un nuage toxique lumineux : des boules vertes qui brillent, plus claires au cœur.
			ctx.globalCompositeOperation = 'lighter';
			for (const b of blobs) {
				const q = pos(b);
				const gr = ctx.createRadialGradient(q.x, q.y - q.r * 0.25, 0, q.x, q.y, q.r * 1.25);
				gr.addColorStop(0, 'rgba(190,255,150,0.55)');
				gr.addColorStop(0.5, 'rgba(80,210,60,0.35)');
				gr.addColorStop(1, 'rgba(40,140,30,0)');
				ctx.fillStyle = gr;
				ctx.beginPath();
				ctx.arc(q.x, q.y, q.r * 1.25, 0, Math.PI * 2);
				ctx.fill();
			}
		},
	});
	// Les bulles qui montent et éclatent.
	for (let i = 0; i < 8; i += 1)
		eng.add({
			x: at.x + (Math.random() - 0.5) * 60 * k,
			y: at.y - 10,
			vx: (Math.random() - 0.5) * 20,
			vy: -40 - Math.random() * 40,
			life: 700,
			delay: delay + 150 + i * 110,
			size: 4 + Math.random() * 4,
			sizeEnd: 9,
			color: '#b6f59a',
			neon: true,
		});
	// La petite tête de mort qui s'échappe du nuage.
	eng.add({ x: at.x, y: at.y - 20, vy: -55, life: 1100, delay: delay + 250, size: 26 * k, color: '#e9ffe0', shape: 'glyph', glyph: '☠', vr: 0.6, neon: true });
	return delay + 330;
}

/**
 * L'éclair qui relie l'attaquant à sa cible, façon jeu de cartes : un zigzag épais qui crépite
 * (il se redessine plusieurs fois), un halo lumineux, un cœur blanc, deux petites fourches,
 * et une boule de lumière au point d'arrivée.
 */
export function zap(eng: FxEngine, from: P, to: P, color: string, delay = 0, life = 340, width = 9) {
	const a = angleTo(from, to);
	const len = dist(from, to);
	const nx = -Math.sin(a);
	const ny = Math.cos(a);
	let path: P[] = [];
	let forks: P[][] = [];
	let shape = -1;
	const build = () => {
		const n = Math.max(4, Math.round(len / 34));
		path = Array.from({ length: n + 1 }, (_, i) => {
			const u = i / n;
			// Pointes fortes au milieu, nulles aux deux bouts.
			const off = i === 0 || i === n ? 0 : (i % 2 ? 1 : -1) * (10 + Math.random() * 16) * Math.sin(Math.PI * u);
			return { x: from.x + (to.x - from.x) * u + nx * off, y: from.y + (to.y - from.y) * u + ny * off };
		});
		forks = [0.35, 0.65].map((u) => {
			const p = path[Math.round(u * (path.length - 1))];
			const side = Math.random() < 0.5 ? -1 : 1;
			const fa = a + side * (0.6 + Math.random() * 0.4);
			return [p, { x: p.x + Math.cos(fa) * 22 + nx * side * 6, y: p.y + Math.sin(fa) * 22 + ny * side * 6 }, { x: p.x + Math.cos(fa) * 40, y: p.y + Math.sin(fa) * 40 }];
		});
	};
	const line = (ctx: CanvasRenderingContext2D, pts: P[]) => {
		ctx.beginPath();
		pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
	};
	eng.draw({
		life,
		delay,
		draw(ctx, t) {
			// Il crépite : un nouveau tracé tous les 1/7 de sa vie.
			const k = Math.floor(t * 7);
			if (k !== shape) {
				shape = k;
				build();
			}
			const w = width * (t < 0.15 ? t / 0.15 : 1 - Math.max(0, t - 0.6) / 0.4);
			if (w < 0.4) return;
			// Le halo, en lumière.
			ctx.globalCompositeOperation = 'lighter';
			ctx.lineCap = 'round';
			ctx.lineJoin = 'round';
			ctx.shadowColor = color;
			ctx.shadowBlur = 26;
			ctx.globalAlpha = 0.55;
			ctx.strokeStyle = color;
			ctx.lineWidth = w * 2.6;
			line(ctx, path);
			ctx.stroke();
			ctx.shadowBlur = 0;
			ctx.globalAlpha = 1;
			// Le trait : couleur et cœur blanc ; les fourches plus fines.
			ctx.globalCompositeOperation = 'source-over';
			for (const f of forks) {
				line(ctx, f);
				glowStroke(ctx, color, w * 0.45, 1.6);
			}
			line(ctx, path);
			glowStroke(ctx, color, w, 2.5);
			ctx.strokeStyle = '#ffffff';
			ctx.lineWidth = w * 0.35;
			ctx.stroke();
			// La boule de lumière à l'arrivée.
			ctx.globalCompositeOperation = 'lighter';
			const r = 26 + 10 * Math.sin(t * 40);
			const g = ctx.createRadialGradient(to.x, to.y, 0, to.x, to.y, r);
			g.addColorStop(0, '#ffffff');
			g.addColorStop(0.35, color);
			g.addColorStop(1, 'rgba(0,0,0,0)');
			ctx.fillStyle = g;
			ctx.beginPath();
			ctx.arc(to.x, to.y, r, 0, Math.PI * 2);
			ctx.fill();
		},
	});
}

/* ---------------- Les compétences ---------------- */

const STEEL = ['#fff6dc', '#ffc76b', '#ff8a3c'];
const FURY = ['#ffd2a8', '#ff6a3c', '#ff3d5a'];
const ARROW = ['#fff4cf', '#ffd27a'];
const MOON = 'rgb(170 205 255)';
/** La magie des runes : violet et rose néon. */
const RUNE = ['#ffffff', '#e0b8ff', '#b46bff', '#ff5ad1'];
const RUNE_GLYPHS = ['ᚱ', 'ᚦ', 'ᛟ', 'ᚨ', 'ᛉ', 'ᛞ'];
const glyph = () => RUNE_GLYPHS[Math.floor(Math.random() * RUNE_GLYPHS.length)];

/** Un cercle de runes qui s'allume et tourne autour d'un point. */
function runeCircle(eng: FxEngine, at: P, r: number, delay = 0, life = 700, color = '#b46bff') {
	eng.draw({
		life,
		delay,
		draw(ctx, t) {
			const k = ease.out(Math.min(1, t * 2.2));
			const fade = t < 0.7 ? 1 : (1 - t) / 0.3;
			ctx.globalAlpha = fade;
			ctx.beginPath();
			ctx.arc(at.x, at.y, r * k, 0, Math.PI * 2);
			glowStroke(ctx, color, 4, 2.5);
			ctx.font = `900 ${Math.round(r * 0.28)}px serif`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			for (let i = 0; i < 6; i += 1) {
				const a = t * 2.4 + (i * Math.PI) / 3;
				ctx.shadowColor = color;
				ctx.shadowBlur = 14;
				ctx.fillStyle = '#f3e3ff';
				ctx.fillText(RUNE_GLYPHS[i], at.x + Math.cos(a) * r * k * 0.78, at.y + Math.sin(a) * r * k * 0.78);
			}
		},
	});
}

/** Un coup au contact : entaille (ou ratée), puis impact. */
function melee(eng: FxEngine, c: FxCall, colors: string[], k = 1, angleShift = 0, delay = 0) {
	const to = c.foes[0] ?? c.from;
	const a = angleTo(c.from, to) + angleShift;
	slash(eng, to, c.success ? colors[1] : '#9aa3b5', a + Math.PI / 2, delay, k * (c.crit ? 1.3 : 1));
	const hit = delay + 140;
	if (c.success) impact(eng, to, colors, c.crit ? 1.6 : k, hit);
	else puff(eng, to, hit);
	return hit;
}

/** Un tir : flèche, impact (ou flèche qui file à côté). */
function shot(eng: FxEngine, from: P, to: P, c: FxCall, color: string, delay = 0, colors = ARROW) {
	const end = c.success ? to : beside(from, to);
	const t = projectile(eng, from, end, { color, head: 'arrow', speed: 1100, arc: 18, size: 5, delay });
	if (c.success) impact(eng, to, colors, c.crit ? 1.5 : 0.9, t);
	else puff(eng, end, t);
	return t;
}

const ABILITY_FX: Record<string, Fx> = {
	/* Guerrier */
	frapper: (e, c) => melee(e, c, STEEL),
	'coup-assommant': (e, c) => {
		const t = melee(e, c, STEEL, 1.3);
		if (c.success && c.foes[0]) dizzy(e, c.foes[0], t + 100);
		return t;
	},
	taillade: (e, c) => {
		let t = 0;
		c.foes.forEach((f, i) => {
			slash(e, f, c.success ? '#ffc76b' : '#9aa3b5', angleTo(c.from, f) + Math.PI / 2, i * 90, 1.1);
			if (c.success) impact(e, f, STEEL, 0.9, i * 90 + 140);
			t = i * 90 + 140;
		});
		return t;
	},
	intervention: (e, c) => {
		const to = c.allies[0] ?? c.from;
		const t = projectile(e, c.from, to, { color: '#ffd27a', speed: 700, arc: 30, size: 9 });
		bubble(e, to, 'rgb(255 210 122)', t);
		return t;
	},


	'onde-de-choc': (e, c) => {
		// Le coup de bouclier : un éventail d'onde dorée qui part devant le guerrier, vers la créature visée.
		const to = c.foes[0] ?? c.from;
		const a = angleTo(c.from, to);
		e.draw({
			life: 600,
			delay: 80,
			draw(ctx, t) {
				const r = 30 + 170 * ease.out(t);
				ctx.globalAlpha = 1 - t;
				for (let k = 0; k < 3; k += 1) {
					const rr = r - k * 26;
					if (rr <= 10) continue;
					ctx.beginPath();
					ctx.arc(c.from.x, c.from.y, rr, a - 0.55, a + 0.55);
					glowStroke(ctx, k ? '#ffe28a' : '#fff6dc', 9 - k * 2.5, 2.5);
				}
			},
		});
		impact(e, c.from, STEEL, 0.8, 60);
		c.foes.forEach((f, i) => (c.success ? impact(e, f, STEEL, i ? 1 : 1.4, 220 + i * 80) : puff(e, f, 220)));
		return 220;
	},

	/* Cœur-sauvage */
	'double-attaque': (e, c) => {
		const t = melee(e, c, FURY, 1, -0.5);
		melee(e, { ...c, crit: false }, FURY, 0.75, 2.6, 200);
		return t;
	},
	bond: (e, c) => {
		// Le bond : des traces de pattes jusqu'à la cible, puis les deux haches.
		const to = c.foes[0] ?? c.from;
		e.add({ x: c.from.x, y: c.from.y, life: 500, size: 20, sizeEnd: 90, color: '#ff9a4a', shape: 'ring', neon: true });
		e.burst(c.from, 12, { speed: 220, life: 500, size: 6, sizeEnd: 2, color: ['#d9c2a0', '#a08060'], ay: 200, drag: 1.5 });
		const t = melee(e, c, FURY, 1.1, -0.5, 120);
		melee(e, { ...c, crit: false }, FURY, 0.9, 2.6, 300);
		speedLines(e, to, 100, '#ffd2a8');
		return t;
	},
	'fureur-ours': (e, c) => {
		// La rage de l'ours : une gueule de braise qui mord, puis la vie qui revient au cœur-sauvage.
		const t = melee(e, c, FURY, 1.2, -0.5);
		melee(e, { ...c, crit: false }, FURY, 1, 2.6, 200);
		if (c.foes[0] && c.success) bite(e, c.foes[0], '#ff6a3c');
		if (c.success) {
			e.burst(c.from, 14, { speed: 70, life: 900, delay: t + 150, size: 5, color: ['#ffd2a8', '#ff8a4a'], ay: -200, neon: true });
			rising(e, c.from, ['+'], '#8fffa0', 4, t + 200, 24);
		}
		return t;
	},
	moquerie: (e, c) => {
		const to = c.foes[0] ?? c.from;
		for (let i = 0; i < 3; i += 1) e.add({ x: c.from.x, y: c.from.y, life: 600, delay: i * 120, size: 10, sizeEnd: 70, color: '#ff9a4a', shape: 'ring', neon: true });
		const t = projectile(e, c.from, to, { color: '#ff7a3c', head: 'glyph', glyph: '!', speed: 800, arc: 40, size: 9 });
		if (c.success) rising(e, to, ['!'], '#ff6a3c', 4, t, 24);
		else puff(e, to, t);
		return t;
	},
	tourbillon: (e, c) => {
		// Un vortex bleuté : des bras de vent en spirale qui tournent autour du cœur-sauvage et s'élargissent.
		const at = c.from;
		const BLUES = ['#ffffff', '#bfefff', '#7fe3ff', '#4a8dff'];
		e.draw({
			life: 1000,
			draw(ctx, t) {
				const r = 40 + 105 * ease.out(Math.min(1, t * 1.4));
				const fade = t < 0.75 ? 1 : (1 - t) / 0.25;
				// Le cœur du vortex : un disque bleu qui tourne.
				const g = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, r);
				g.addColorStop(0, 'rgba(160,230,255,0.55)');
				g.addColorStop(0.6, 'rgba(70,140,255,0.25)');
				g.addColorStop(1, 'rgba(0,0,0,0)');
				ctx.globalAlpha = fade;
				ctx.fillStyle = g;
				ctx.beginPath();
				ctx.arc(at.x, at.y, r, 0, Math.PI * 2);
				ctx.fill();
				// Les bras en spirale.
				ctx.lineCap = 'round';
				ctx.shadowColor = '#7fe3ff';
				ctx.shadowBlur = 20;
				const base = t * Math.PI * 9;
				for (let k = 0; k < 5; k += 1) {
					ctx.strokeStyle = BLUES[k % 4];
					const N = 22;
					for (let j = 0; j < N; j += 1) {
						const u1 = j / N;
						const u2 = (j + 1) / N;
						const p1 = base + (k * Math.PI * 2) / 5 + u1 * 2.4;
						const p2 = base + (k * Math.PI * 2) / 5 + u2 * 2.4;
						const r1 = r * (0.25 + 0.75 * u1);
						const r2 = r * (0.25 + 0.75 * u2);
						ctx.globalAlpha = fade * (0.35 + 0.65 * u1);
						ctx.lineWidth = 2 + 7 * u1 * (1 - t * 0.4);
						ctx.beginPath();
						ctx.moveTo(at.x + Math.cos(p1) * r1, at.y + Math.sin(p1) * r1);
						ctx.lineTo(at.x + Math.cos(p2) * r2, at.y + Math.sin(p2) * r2);
						ctx.stroke();
					}
				}
			},
		});
		// Des éclats de vent arrachés au tourbillon, qui partent en tournoyant.
		for (let i = 0; i < 46; i += 1) {
			const a = Math.random() * Math.PI * 2;
			const d = 30 + Math.random() * 70;
			const v = 260 + Math.random() * 260;
			e.add({
				x: at.x + Math.cos(a) * d,
				y: at.y + Math.sin(a) * d,
				vx: -Math.sin(a) * v + Math.cos(a) * 120,
				vy: Math.cos(a) * v + Math.sin(a) * 120,
				life: 650 + Math.random() * 300,
				delay: Math.random() * 300,
				size: 3.5,
				color: BLUES[i % 4],
				shape: 'spark',
				drag: 1.4,
			});
		}
		e.add({ x: at.x, y: at.y, life: 700, delay: 250, size: 30, sizeEnd: 170, color: '#7fe3ff', shape: 'ring' });
		c.foes.forEach((f, i) => (c.success ? impact(e, f, BLUES, 1.25, 320 + i * 70) : puff(e, f, 320)));
		return 320;
	},

	/* Rôdeur */
	tir: (e, c) => shot(e, c.from, c.foes[0], c, '#ffd27a'),
	'fleche-visee': (e, c) => {
		// On vise : un réticule se resserre sur la cible, puis la flèche part, très vite.
		const to = c.foes[0];
		e.draw({
			life: 380,
			draw(ctx, t) {
				const r = 60 - 36 * ease.out(t);
				ctx.globalCompositeOperation = 'source-over';
				ctx.globalAlpha = 1 - t * 0.3;
				ctx.beginPath();
				ctx.arc(to.x, to.y, r, 0, Math.PI * 2);
				ctx.moveTo(to.x - r - 8, to.y);
				ctx.lineTo(to.x - r + 8, to.y);
				ctx.moveTo(to.x + r - 8, to.y);
				ctx.lineTo(to.x + r + 8, to.y);
				glowStroke(ctx, '#ffe28a', 4, 2.5);
			},
		});
		const end = c.success ? to : beside(c.from, to);
		const t = projectile(e, c.from, end, { color: '#ffe28a', head: 'arrow', speed: 1800, size: 6, delay: 360, trail: '#fff1b8' });
		if (c.success) {
			impact(e, to, ['#ffffff', '#ffe28a', '#ffb347'], 1.8, t);
			rising(e, to, ['🤐'], '#ffe28a', 1, t + 120, 22);
		} else puff(e, end, t);
		return t;
	},
	salve: (e, c) => {
		let t = 0;
		const list = c.foes.length ? c.foes : [c.from];
		for (let i = 0; i < 3; i += 1) t = Math.max(t, shot(e, c.from, list[i % list.length], c, '#ffd27a', i * 110));
		return t - 220;
	},
	filet: (e, c) => {
		const to = c.foes[0];
		const end = c.success ? to : beside(c.from, to);
		const t = projectile(e, c.from, end, { color: '#d9c9a0', head: 'net', speed: 650, arc: 50, size: 6 });
		if (!c.success) {
			puff(e, end, t);
			return t;
		}
		net(e, to, t);
		return t;
	},
	'fleche-empoisonnee': (e, c) => {
		const to = c.foes[0];
		const t = shot(e, c.from, to, c, '#8cff7a', 0, ['#d6ffcc', '#6fdc5a']);
		if (c.success) poisonCloud(e, to, t);
		return t;
	},

	/* Mage : la magie des runes */
	'projectiles-runes': (e, c) => {
		// Trois runes violettes qui filent en serpentant, l'une après l'autre.
		const to = c.foes[0];
		let t = 0;
		for (let i = 0; i < 3; i += 1) {
			const end = c.success ? to : beside(c.from, to);
			t = projectile(e, c.from, end, { color: RUNE[2], head: 'glyph', glyph: glyph(), speed: 900, size: 8, wobble: 14, arc: 20 * (i - 1), delay: i * 120, trail: RUNE[3] });
			if (c.success) impact(e, to, RUNE, 0.7, t);
		}
		if (!c.success) puff(e, beside(c.from, to), t);
		return t;
	},
	'rune-eclat': (e, c) => {
		// Une grande rune se dessine sur la créature, puis éclate.
		const to = c.foes[0];
		runeCircle(e, to, 50, 0, 650);
		e.add({ x: to.x, y: to.y, life: 500, delay: 320, size: 30, sizeEnd: 120, color: RUNE[3], shape: 'ring', neon: true });
		impact(e, to, RUNE, 1.5, 380);
		e.burst(to, 22, { speed: 360, life: 650, delay: 380, size: 4.5, color: [RUNE[1], RUNE[3]], shape: 'spark', drag: 1, neon: true });
		return 380;
	},
	'rune-ricochet': (e, c) => {
		// Une rune qui saute de créature en créature, en laissant un trait violet.
		if (!c.success) {
			const to = beside(c.from, c.foes[0]);
			const t = projectile(e, c.from, to, { color: RUNE[2], head: 'glyph', glyph: glyph(), speed: 1000, size: 9 });
			puff(e, to, t);
			return t;
		}
		const chain = [c.from, ...c.foes];
		let first = 0;
		let d = 0;
		for (let i = 1; i < chain.length; i += 1) {
			const t = projectile(e, chain[i - 1], chain[i], { color: RUNE[2], head: 'glyph', glyph: glyph(), speed: 1100, size: 9, arc: 30, delay: d, trail: RUNE[3] });
			impact(e, chain[i], RUNE, 1.1 - i * 0.1, t);
			if (i === 1) first = t;
			d = t;
		}
		return first;
	},
	'orbe-runique': (e, c) => {
		// Une boule de runes qui tourne en vol, puis éclate sur la créature et ses voisines.
		const to = c.success ? c.foes[0] : beside(c.from, c.foes[0]);
		const t = projectile(e, c.from, to, { color: RUNE[2], speed: 800, size: 14, wobble: 4, arc: 40, trail: RUNE[3] });
		if (!c.success) {
			puff(e, to, t);
			return t;
		}
		runeCircle(e, to, 80, t, 600);
		c.foes.forEach((f, i) => impact(e, f, RUNE, i ? 0.9 : 1.3, t + i * 60));
		e.burst(to, 26, { speed: 300, life: 700, delay: t, size: 5, color: RUNE.slice(1), shape: 'twinkle', drag: 1.2, neon: true });
		return t;
	},
	deflagration: (e, c) => {
		// Le cercle de runes explose autour du mage : une onde violette qui repousse tout.
		const at = c.from;
		runeCircle(e, at, 60, 0, 500);
		for (let i = 0; i < 3; i += 1) e.add({ x: at.x, y: at.y, life: 600, delay: 220 + i * 90, size: 20, sizeEnd: 190, color: RUNE[2 + (i % 2)], shape: 'ring', neon: true });
		e.burst(at, 30, { speed: 520, life: 600, delay: 220, size: 4.5, color: RUNE.slice(1), shape: 'spark', drag: 1.6, neon: true });
		c.foes.forEach((f, i) => (c.success ? impact(e, f, RUNE, 1.1, 300 + i * 50) : puff(e, f, 300)));
		return 300;
	},
	'bouclier-lune': (e, c) => {
		const to = c.allies[0] ?? c.from;
		const t = to === c.from ? 0 : projectile(e, c.from, to, { color: MOON, speed: 700, arc: 30, size: 8 });
		bubble(e, to, MOON, t);
		return t;
	},

	/* Barde */
	'air-guerison': (e, c) => {
		// Des notes vertes volent jusqu'au compagnon, puis une colonne de lumière et des « + » qui montent.
		const to = c.allies[0] ?? c.from;
		const t = to === c.from ? 0 : projectile(e, c.from, to, { color: '#8fffa0', head: 'glyph', glyph: '♫', speed: 650, size: 8, wobble: 12, arc: 24 });
		e.add({ x: to.x, y: to.y, life: 600, delay: t, size: 40, sizeEnd: 80, color: '#8fffa0', alpha: 0.8 });
		for (let i = 0; i < 2; i += 1) e.add({ x: to.x, y: to.y, life: 600, delay: t + i * 120, size: 14, sizeEnd: 75, color: '#8fffa0', shape: 'ring', neon: true });
		e.burst(to, 12, { speed: 60, life: 1000, delay: t, size: 4, color: ['#c8ffd0', '#8fffa0'], ay: -220, neon: true });
		for (let i = 0; i < 4; i += 1) e.add({ x: to.x + (Math.random() - 0.5) * 50, y: to.y + (Math.random() - 0.5) * 30, life: 600, delay: t + 100 + i * 90, size: 14, sizeEnd: 2, rot: Math.random(), vr: 2, color: '#8fffa0', shape: 'twinkle' });
		rising(e, to, ['+'], '#8fffa0', 5, t + 80, 24);
		return t;
	},
	berceuse: (e, c) => {
		const to = c.success ? c.foes[0] : beside(c.from, c.foes[0]);
		const t = projectile(e, c.from, to, { color: '#a8c8ff', head: 'glyph', glyph: '♪', speed: 450, size: 8, wobble: 20, arc: 30 });
		if (c.success) rising(e, to, ['z', 'Z', 'z'], '#cfe0ff', 4, t, 20);
		else puff(e, to, t);
		return t;
	},
	chant: (e, c) => {
		rising(e, c.from, ['♪', '♫'], '#c58cff', 6, 0, 20);
		c.allies.forEach((a, i) => {
			e.burst(a, 8, { speed: 40, life: 900, delay: 300 + i * 80, size: 5, color: '#8fe0a0', ay: -160, neon: true });
			rising(e, a, ['+'], '#8fe0a0', 3, 300 + i * 80, 22);
			// Les maux (fumée sombre) s'envolent.
			e.burst(a, 5, { speed: 60, life: 800, delay: 380 + i * 80, size: 8, sizeEnd: 3, color: '#9a72c0', ay: -200, neon: true });
		});
		return 300;
	},
	ronde: (e, c) => {
		// Un air de danse : des notes dorées tournent autour de la créature, de plus en plus vite, et se referment en mur.
		const to = c.foes[0] ?? c.from;
		const t = projectile(e, c.from, to, { color: '#ffe28a', head: 'glyph', glyph: '♫', speed: 650, size: 8, wobble: 14, arc: 30 });
		const R = 105;
		e.draw({
			life: 1100,
			delay: t,
			draw(ctx, k) {
				const close = ease.out(Math.min(1, k * 1.6));
				const spin = k * k * Math.PI * 6;
				const fade = k < 0.8 ? 1 : (1 - k) / 0.2;
				ctx.globalAlpha = fade;
				ctx.font = '900 22px serif';
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				for (let i = 0; i < 12; i += 1) {
					const a = spin + (i * Math.PI) / 6;
					const r = R * (1.6 - 0.6 * close);
					ctx.shadowColor = '#ffc76b';
					ctx.shadowBlur = 14;
					ctx.fillStyle = i % 2 ? '#fff1b8' : '#ffd27a';
					ctx.fillText(i % 3 ? '♪' : '♫', to.x + Math.cos(a) * r, to.y + Math.sin(a) * r * 0.8);
				}
				ctx.beginPath();
				ctx.ellipse(to.x, to.y, R, R * 0.8, 0, 0, Math.PI * 2);
				glowStroke(ctx, '#ffd27a', 3 + 4 * close, 2.5);
			},
		});
		return t + 500;
	},
};

/* ---------------- Le côté bande dessinée ---------------- */

/** Couleur de l'éclair qui relie le mage ou le barde à sa cible (les sorts seulement). */
const LINK: Record<string, string> = {
	'rune-eclat': '#d08cff',
	'orbe-runique': '#ff7ae0',
	berceuse: '#9cc8ff',
};

/** Onomatopée et couleur de bulle de chaque compétence. */
const WORDS: Record<string, { word: string; fill: string; melee?: boolean }> = {
	frapper: { word: 'POW !', fill: '#ffd23f', melee: true },
	'coup-assommant': { word: 'BONK !', fill: '#ffd23f', melee: true },
	taillade: { word: 'SHLAK !', fill: '#ffb03f', melee: true },
	intervention: { word: 'HOP !', fill: '#ffe28a' },
	'double-attaque': { word: 'TCHAK-TCHAK !', fill: '#ff7a4a', melee: true },
	'onde-de-choc': { word: 'BOOOM !', fill: '#ffd23f', melee: true },
	bond: { word: 'HOP-TCHAK !', fill: '#ff9a5a', melee: true },
	'fureur-ours': { word: 'GRAOU !', fill: '#ff7a4a', melee: true },
	moquerie: { word: 'NANANÈRE !', fill: '#ff9a4a' },
	tourbillon: { word: 'WHOOSH !', fill: '#7fe3ff', melee: true },
	tir: { word: 'TCHAC !', fill: '#ffe28a' },
	salve: { word: 'TAC TAC TAC !', fill: '#ffe28a' },
	filet: { word: 'FLOP !', fill: '#e8dcb5' },
	'fleche-empoisonnee': { word: 'BLURP !', fill: '#8cff7a' },
	'fleche-visee': { word: 'PAF !!', fill: '#ffd23f' },
	'projectiles-runes': { word: 'PIOU PIOU !', fill: '#e0b8ff' },
	'rune-eclat': { word: 'KZZAM !', fill: '#d08cff' },
	'rune-ricochet': { word: 'PING-PONG !', fill: '#e0b8ff' },
	'orbe-runique': { word: 'BAOUM !', fill: '#ff9ae6' },
	deflagration: { word: 'WHAM !', fill: '#d08cff' },
	'bouclier-lune': { word: 'BLOING !', fill: '#bcd6ff' },
	'air-guerison': { word: 'AAAH !', fill: '#a8ffb4' },
	berceuse: { word: 'ZZZ…', fill: '#cfe0ff' },
	chant: { word: 'LA LA LAAA !', fill: '#b8f0c4' },
	ronde: { word: 'TRA-LA-LA !', fill: '#ffe28a' },
};

/**
 * La bulle de BD : une explosion en étoile, bord noir épais, avec l'onomatopée qui surgit en rebondissant.
 * Dessinée en « source-over » (pas en lumière additive) pour garder les contours noirs.
 */
export function kapow(eng: FxEngine, at: P, word: string, fill: string, delay = 0, k = 1) {
	const rot = (Math.random() - 0.5) * 0.5;
	// Un peu sur le côté et au-dessus, sauf tout en haut du plateau (on passe dessous).
	const side = Math.random() < 0.5 ? -1 : 1;
	const pos = { x: at.x + side * 34 * k, y: at.y + (at.y < 130 ? 34 : -44) * k };
	const spikes = Array.from({ length: 14 }, (_, i) => (i % 2 ? 0.58 : 1) * (0.88 + Math.random() * 0.24));
	eng.draw({
		life: 900,
		delay,
		draw(ctx, t) {
			// Surgit trop grand, rebondit, tient, puis s'éteint.
			const pop = t < 0.14 ? ease.out(t / 0.14) * 1.3 : t < 0.26 ? 1.3 - 0.3 * ease.inOut((t - 0.14) / 0.12) : 1;
			const alpha = t < 0.78 ? 1 : 1 - (t - 0.78) / 0.22;
			ctx.globalCompositeOperation = 'source-over';
			ctx.globalAlpha = Math.max(0, alpha);
			ctx.translate(pos.x, pos.y);
			ctx.rotate(rot);
			ctx.scale(pop * k, pop * k);
			const w = Math.max(70, word.length * 13);
			ctx.beginPath();
			spikes.forEach((m, i) => {
				const a = (i / spikes.length) * Math.PI * 2;
				ctx.lineTo(Math.cos(a) * (w / 2 + 10) * m, Math.sin(a) * 34 * m);
			});
			ctx.closePath();
			ctx.fillStyle = fill;
			ctx.fill();
			ctx.lineJoin = 'round';
			ctx.lineWidth = 5;
			ctx.strokeStyle = INK;
			ctx.stroke();
			ctx.font = `900 ${Math.min(26, 300 / Math.max(6, word.length))}px "Arial Black", Impact, "Helvetica Neue", sans-serif`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.lineWidth = 7;
			ctx.strokeStyle = INK;
			ctx.strokeText(word, 0, 1);
			ctx.fillStyle = '#fff';
			ctx.fillText(word, 0, 1);
		},
	});
}

/** Des traits de vitesse qui jaillissent autour de l'impact, comme dans une case de BD. */
export function speedLines(eng: FxEngine, at: P, delay = 0, color = '#ffffff') {
	const lines = Array.from({ length: 12 }, () => ({ a: Math.random() * Math.PI * 2, r: 0.8 + Math.random() * 0.5 }));
	eng.draw({
		life: 340,
		delay,
		draw(ctx, t) {
			ctx.globalCompositeOperation = 'source-over';
			ctx.globalAlpha = 1 - t * t;
			for (const l of lines) {
				const r0 = (44 + 50 * ease.out(t)) * l.r;
				const r1 = r0 + 34 * (1 - t);
				const wd = 0.07 * (1 - t * 0.5);
				// Un coin effilé : pointu vers l'impact, large vers l'extérieur.
				ctx.beginPath();
				ctx.moveTo(at.x + Math.cos(l.a) * r0, at.y + Math.sin(l.a) * r0);
				ctx.lineTo(at.x + Math.cos(l.a - wd) * r1, at.y + Math.sin(l.a - wd) * r1);
				ctx.lineTo(at.x + Math.cos(l.a + wd) * r1, at.y + Math.sin(l.a + wd) * r1);
				ctx.closePath();
				glowFill(ctx, color, 2.5);
			}
		},
	});
}

/** Joue l'effet d'une compétence (et sa bulle de BD) ; renvoie le moment de l'impact (ms réelles). */
export function playAbility(eng: FxEngine, ability: string, c: FxCall) {
	const fx = ABILITY_FX[ability];
	let t: number;
	if (!fx || (!c.foes.length && !c.allies.length && !['chant', 'tourbillon', 'deflagration'].includes(ability))) {
		impact(eng, c.foes[0] ?? c.allies[0] ?? c.from, STEEL, 0.8);
		t = 120;
	} else t = fx(eng, c);
	// Sorts : un éclair relie le héros à chaque cible, au moment où ça touche.
	const link = LINK[ability];
	if (c.success && link) for (const [i, f] of c.foes.slice(0, 3).entries()) zap(eng, c.from, f, link, Math.max(0, t - 60) + i * 60, 260, 6);
	const w = WORDS[ability];
	if (!c.success && c.foes[0]) kapow(eng, c.foes[0], 'RATÉ !', '#c9ced8', t, 0.75);
	if (!c.success || !w) return eng.real(t);
	// La bulle sur la cible principale (le cœur-sauvage pour le tourbillon, le barde pour un chant),
	// et de plus petites sur les autres cibles.
	const main = ['tourbillon', 'deflagration'].includes(ability) || (!c.foes.length && !c.allies.length) ? c.from : (c.foes[0] ?? c.allies[0]);
	const word = c.crit ? w.word.replace(/ ?!*$/, ' !!!') : w.word;
	kapow(eng, main, word, c.crit ? '#ff5a3c' : w.fill, t, c.crit ? 1.25 : 1);
	if (w.melee) for (const f of c.foes.slice(0, 3)) speedLines(eng, f, t);
	for (const f of c.foes.slice(['tourbillon', 'deflagration'].includes(ability) ? 0 : 1, 3)) kapow(eng, f, w.word.split(' ')[0], w.fill, t + 120, 0.7);
	return eng.real(t);
}

/** L'attaque d'une créature sur un héros : morsure pour les bêtes, griffes pour le reste. */
export function playFoeAttack(eng: FxEngine, foeName: string, from: P, to: P, hurt: boolean) {
	const beast = /loup|chien|ours|sanglier|bête/i.test(foeName);
	const t = beast ? bite(eng, to, '#ff5a3c') : claws(eng, from, to, '#c98bff');
	if (hurt) {
		impact(eng, to, ['#ffd2c8', '#ff5a3c', '#ff2d4a'], 1, t);
		speedLines(eng, to, t);
		kapow(eng, to, beast ? 'CROC !' : 'SCRATCH !', beast ? '#ff8a6a' : '#d9b0ff', t);
	} else {
		clang(eng, to, t);
		kapow(eng, to, 'CLANG !', '#d5dbe6', t, 0.85);
	}
	return eng.real(t);
}

/** Un coup encaissé (armure, bouclier) : étincelles grises. */
function clang(eng: FxEngine, at: P, delay: number) {
	eng.burst(at, 10, { speed: 240, life: 420, delay, size: 5, color: ['#e6ecf5', '#9fb0c8'], shape: 'spark', drag: 2, neon: true });
	burstStar(eng, at, '#c9d2e0', '#ffffff', 40, delay, 260);
}

/** Le sort d'une créature qui touche un héros : une boule magique (de braise pour le Loup) ; renvoie le moment de l'impact. */
export function playFoeSpell(eng: FxEngine, foeName: string, from: P, to: P, hurt: boolean) {
	const fire = /loup|braise|cendre/i.test(foeName);
	const colors = fire ? ['#fff2c4', '#ff8a3c', '#ff3d2a'] : ['#f0f4ff', '#a9b8e8', '#7d6bd6'];
	const t = projectile(eng, from, to, { color: colors[1], speed: 800, size: fire ? 14 : 10, wobble: 6, arc: 30, trail: colors[2] });
	impact(eng, to, colors, hurt ? 1.3 : 0.8, t);
	if (fire) eng.burst(to, 20, { speed: 260, life: 700, delay: t, size: 6, sizeEnd: 2, color: colors, ay: -160, neon: true });
	else if (!hurt) rising(eng, to, ['z', 'Z', 'z'], '#cfe0ff', 4, t, 20);
	return eng.real(t);
}

/** Cri de ralliement : des « ! » qui jaillissent de la créature. */
export function playRally(eng: FxEngine, at: P) {
	for (let i = 0; i < 3; i += 1) eng.add({ x: at.x, y: at.y, life: 600, delay: i * 120, size: 12, sizeEnd: 80, color: '#ffb03f', shape: 'ring', neon: true });
	rising(eng, at, ['!', '!', '!'], '#ffb03f', 5, 0, 26);
}

/** Œil pour œil : le coup revient sur la créature (un éclat doré) ; renvoie le moment (ms réelles) où elle perd ses PV. */
export function playRiposte(eng: FxEngine, at: P, from?: P) {
	// L'œil doré qui s'ouvre au-dessus du guerrier, puis le coup de bouclier qui part vers la créature.
	if (from) {
		eng.draw({
			life: 700,
			draw(ctx, t) {
				const open = t < 0.25 ? ease.out(t / 0.25) : t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
				const x = from.x;
				const y = from.y - 64 - 10 * ease.out(Math.min(1, t * 2));
				ctx.globalCompositeOperation = 'source-over';
				ctx.globalAlpha = open;
				ctx.beginPath();
				ctx.moveTo(x - 26, y);
				ctx.quadraticCurveTo(x, y - 22 * open, x + 26, y);
				ctx.quadraticCurveTo(x, y + 22 * open, x - 26, y);
				ctx.fillStyle = '#fff6dc';
				ctx.fill();
				ctx.lineWidth = 4;
				ctx.strokeStyle = INK;
				ctx.stroke();
				ctx.beginPath();
				ctx.arc(x, y, 9 * open, 0, Math.PI * 2);
				ctx.fillStyle = '#ffb03f';
				ctx.fill();
				ctx.beginPath();
				ctx.arc(x, y, 4 * open, 0, Math.PI * 2);
				ctx.fillStyle = INK;
				ctx.fill();
			},
		});
		slash(eng, at, '#ffc76b', angleTo(from, at) + Math.PI / 2, 140, 1.1);
	}
	impact(eng, at, STEEL, 1.2, 220);
	speedLines(eng, at, 220, '#ffe28a');
	kapow(eng, at, 'ŒIL POUR ŒIL !', '#ffc76b', 220, 0.9);
	return eng.real(220);
}

/** Le poison qui ronge une créature à son tour ; renvoie le moment (ms réelles) où elle perd ses PV. */
export function playPoison(eng: FxEngine, at: P) {
	return eng.real(poisonCloud(eng, at, 0, 1.1));
}

/** Victoire : une gerbe dorée qui jaillit de chaque héros debout. */
export function celebrate(eng: FxEngine, at: P) {
	eng.burst(at, 20, { speed: 320, angle: -Math.PI / 2, spread: Math.PI * 0.9, life: 1300, size: 5, sizeEnd: 3, color: ['#ffe28a', '#fff6dc', '#8fe0a0', '#ffb347', '#ff7aa8'], ay: 420, drag: 0.6, neon: true });
	for (let i = 0; i < 4; i += 1)
		eng.add({ x: at.x + (Math.random() - 0.5) * 40, y: at.y, vy: -120, life: 1100, delay: i * 120, size: 12, color: '#ffe28a', shape: 'star', vr: 4, neon: true });
}

/** Les compétences spectaculaires : l'écran tremble à l'impact, même sans coup critique. */
export const BIG_FX = new Set(['rune-ricochet', 'tourbillon', 'coup-assommant', 'rune-eclat', 'orbe-runique', 'deflagration', 'taillade', 'bond', 'fureur-ours', 'onde-de-choc', 'fleche-visee']);
