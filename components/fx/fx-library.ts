/**
 * Les effets de combat : une dizaine de familles (entaille, projectile, tourbillon, rayon, bulle, notes…),
 * réglées par compétence. Chaque effet renvoie le moment (ms) où il touche sa cible : c'est là que les
 * cœurs tombent et que le jeton tremble.
 */
import { ease, lerp, star, type FxEngine, type P } from './fx-engine';

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

/** L'impact : un éclair, une onde, une gerbe d'étincelles. */
export function impact(eng: FxEngine, at: P, colors: string[], power = 1, delay = 0) {
	eng.add({ x: at.x, y: at.y, life: 260, delay, size: 34 * power, sizeEnd: 52 * power, color: colors[0] });
	eng.add({ x: at.x, y: at.y, life: 420, delay, size: 12, sizeEnd: 62 * power, color: colors[1] ?? colors[0], shape: 'ring' });
	eng.burst(at, Math.round(14 * power), { speed: 320 * power, life: 420, delay, size: 3.5, color: colors, shape: 'spark', drag: 2.5 });
}

/** Le coup tombe à côté : un petit nuage gris. */
function puff(eng: FxEngine, at: P, delay = 0) {
	eng.burst(at, 10, { speed: 90, life: 600, delay, size: 9, sizeEnd: 18, color: 'rgba(200,205,215,0.35)', drag: 3 });
}

/** Une entaille en arc de cercle, qui balaie la cible. */
export function slash(eng: FxEngine, at: P, color: string, angle: number, delay = 0, k = 1, life = 320) {
	const R = 52 * k;
	const c = { x: at.x - Math.cos(angle) * R * 0.45, y: at.y - Math.sin(angle) * R * 0.45 };
	const a0 = angle - 1.25;
	const a1 = angle + 1.25;
	eng.draw({
		life,
		delay,
		draw(ctx, t) {
			const head = ease.out(Math.min(1, t * 1.7));
			const tail = Math.max(0, (t - 0.3) / 0.7);
			const N = 20;
			ctx.lineCap = 'round';
			ctx.shadowColor = color;
			ctx.shadowBlur = 14;
			for (const [w, col] of [
				[8 * k, color],
				[3 * k, '#ffffff'],
			] as const) {
				ctx.strokeStyle = col;
				for (let i = 0; i < N; i += 1) {
					const u1 = tail + ((head - tail) * i) / N;
					const u2 = tail + ((head - tail) * (i + 1)) / N;
					const b1 = a0 + (a1 - a0) * u1;
					const b2 = a0 + (a1 - a0) * u2;
					ctx.globalAlpha = 1 - t * 0.6;
					ctx.lineWidth = w * Math.sin((Math.PI * (i + 0.5)) / N);
					ctx.beginPath();
					ctx.moveTo(c.x + Math.cos(b1) * R, c.y + Math.sin(b1) * R);
					ctx.lineTo(c.x + Math.cos(b2) * R, c.y + Math.sin(b2) * R);
					ctx.stroke();
				}
			}
		},
	});
}

/** Un trait droit qui se dessine puis s'efface (griffes, rayons). */
function streak(eng: FxEngine, a: P, b: P, color: string, width: number, delay = 0, life = 260) {
	eng.draw({
		life,
		delay,
		draw(ctx, t) {
			const head = ease.out(Math.min(1, t * 2));
			const tail = Math.max(0, (t - 0.35) / 0.65);
			const p = lerp(a, b, tail);
			const q = lerp(a, b, head);
			ctx.lineCap = 'round';
			ctx.shadowColor = color;
			ctx.shadowBlur = 12;
			ctx.strokeStyle = color;
			ctx.lineWidth = width;
			ctx.beginPath();
			ctx.moveTo(p.x, p.y);
			ctx.lineTo(q.x, q.y);
			ctx.stroke();
			ctx.strokeStyle = '#fff';
			ctx.lineWidth = width * 0.35;
			ctx.stroke();
		},
	});
}

interface ProjectileOpts {
	color: string;
	head?: 'arrow' | 'orb' | 'glyph' | 'net';
	glyph?: string;
	speed?: number;
	arc?: number;
	size?: number;
	delay?: number;
	wobble?: number;
	trail?: string;
}

/** Un projectile qui vole d'un point à un autre (flèche, orbe, note…). Renvoie sa durée de vol. */
export function projectile(eng: FxEngine, from: P, to: P, o: ProjectileOpts) {
	const { color, head = 'orb', speed = 900, arc = 0, size = 8, delay = 0, wobble = 0, trail = color } = o;
	const life = Math.max(160, (dist(from, to) / speed) * 1000);
	const a = angleTo(from, to);
	let last: P = from;
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
			e.add({ x: p.x, y: p.y, life: 280, size: size * 0.8, sizeEnd: 1, color: trail, alpha: 0.7 });
			ctx.shadowColor = color;
			ctx.shadowBlur = 16;
			ctx.fillStyle = color;
			ctx.strokeStyle = color;
			if (head === 'arrow') {
				ctx.translate(p.x, p.y);
				ctx.rotate(dir);
				ctx.lineCap = 'round';
				ctx.lineWidth = 3;
				ctx.beginPath();
				ctx.moveTo(-26, 0);
				ctx.lineTo(4, 0);
				ctx.stroke();
				ctx.fillStyle = '#fff';
				ctx.beginPath();
				ctx.moveTo(10, 0);
				ctx.lineTo(0, -5);
				ctx.lineTo(0, 5);
				ctx.closePath();
				ctx.fill();
			} else if (head === 'glyph') {
				ctx.font = `${size * 3}px serif`;
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillText(o.glyph ?? '♪', p.x, p.y);
			} else if (head === 'net') {
				ctx.translate(p.x, p.y);
				ctx.rotate(t * 6);
				ctx.lineWidth = 1.5;
				for (let i = -2; i <= 2; i += 1) {
					ctx.beginPath();
					ctx.moveTo(i * 5, -12);
					ctx.lineTo(i * 5, 12);
					ctx.moveTo(-12, i * 5);
					ctx.lineTo(12, i * 5);
					ctx.stroke();
				}
			} else {
				const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 1.8);
				g.addColorStop(0, '#ffffff');
				g.addColorStop(0.35, color);
				g.addColorStop(1, 'rgba(0,0,0,0)');
				ctx.fillStyle = g;
				ctx.beginPath();
				ctx.arc(p.x, p.y, size * 1.8, 0, Math.PI * 2);
				ctx.fill();
			}
		},
	});
	return delay + life;
}

/** Des étoiles qui tournent au-dessus d'une tête (sonné). */
function dizzy(eng: FxEngine, at: P, delay: number, color = '#ffe28a') {
	eng.draw({
		life: 1100,
		delay,
		draw(ctx, t) {
			ctx.fillStyle = color;
			ctx.shadowColor = color;
			ctx.shadowBlur = 10;
			ctx.globalAlpha = t < 0.8 ? 1 : (1 - t) / 0.2;
			for (let i = 0; i < 3; i += 1) {
				const a = t * Math.PI * 4 + (i * Math.PI * 2) / 3;
				star(ctx, at.x + Math.cos(a) * 30, at.y - 46 + Math.sin(a) * 9, 7, a);
			}
		},
	});
}

/** Une bulle protectrice qui se gonfle autour d'un jeton. */
function bubble(eng: FxEngine, at: P, color: string, delay = 0) {
	eng.draw({
		life: 900,
		delay,
		draw(ctx, t) {
			const r = 50 * ease.out(Math.min(1, t * 2.2));
			ctx.globalAlpha = t < 0.7 ? 1 : (1 - t) / 0.3;
			ctx.fillStyle = color.replace(')', ' / 18%)');
			ctx.strokeStyle = color;
			ctx.shadowColor = color;
			ctx.shadowBlur = 18;
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.arc(at.x, at.y, r, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
			ctx.strokeStyle = '#fff';
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.arc(at.x, at.y, r * 0.86, t * 8, t * 8 + 0.9);
			ctx.stroke();
		},
	});
}

/** Des symboles qui montent et s'envolent (notes, « z », « + »). */
function rising(eng: FxEngine, at: P, glyphs: string[], color: string, n: number, delay = 0, size = 18) {
	for (let i = 0; i < n; i += 1)
		eng.add({
			x: at.x + (Math.random() - 0.5) * 50,
			y: at.y + 10,
			vx: (Math.random() - 0.5) * 40,
			vy: -70 - Math.random() * 60,
			life: 900,
			delay: delay + i * 70,
			size,
			color,
			shape: 'glyph',
			glyph: glyphs[i % glyphs.length],
			vr: (Math.random() - 0.5) * 2,
		});
}

/** Les griffes d'une créature : trois traits parallèles. */
function claws(eng: FxEngine, from: P, at: P, color: string) {
	const a = angleTo(from, at) + Math.PI / 2.6;
	const dx = Math.cos(a) * 34;
	const dy = Math.sin(a) * 34;
	const nx = -Math.sin(a) * 13;
	const ny = Math.cos(a) * 13;
	for (let i = -1; i <= 1; i += 1)
		streak(eng, { x: at.x - dx + nx * i, y: at.y - dy + ny * i }, { x: at.x + dx + nx * i, y: at.y + dy + ny * i }, color, 5, (i + 1) * 45);
	return 160;
}

/** Une morsure : deux arcs qui se referment. */
function bite(eng: FxEngine, at: P, color: string) {
	eng.draw({
		life: 340,
		draw(ctx, t) {
			const close = ease.in(Math.min(1, t * 1.6));
			const gap = 34 * (1 - close) + 4;
			ctx.strokeStyle = color;
			ctx.shadowColor = color;
			ctx.shadowBlur = 14;
			ctx.lineWidth = 5;
			ctx.globalAlpha = 1 - Math.max(0, t - 0.6) / 0.4;
			ctx.beginPath();
			ctx.arc(at.x, at.y - gap, 30, 0.2 * Math.PI, 0.8 * Math.PI);
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(at.x, at.y + gap, 30, 1.2 * Math.PI, 1.8 * Math.PI);
			ctx.stroke();
		},
	});
	return 220;
}

/* ---------------- Les compétences ---------------- */

const STEEL = ['#fff6dc', '#ffc76b', '#ff8a3c'];
const FURY = ['#ffd2a8', '#ff6a3c', '#ff3d5a'];
const ARROW = ['#fff4cf', '#ffd27a'];
const MOON = 'rgb(170 205 255)';

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

	/* Danseur de guerre */
	'double-attaque': (e, c) => {
		const t = melee(e, c, FURY, 1, -0.5);
		melee(e, { ...c, crit: false }, FURY, 0.75, 2.6, 200);
		return t;
	},
	moquerie: (e, c) => {
		const to = c.foes[0] ?? c.from;
		for (let i = 0; i < 3; i += 1) e.add({ x: c.from.x, y: c.from.y, life: 600, delay: i * 120, size: 10, sizeEnd: 70, color: '#ff9a4a', shape: 'ring' });
		const t = projectile(e, c.from, to, { color: '#ff7a3c', head: 'glyph', glyph: '!', speed: 800, arc: 40, size: 9 });
		if (c.success) rising(e, to, ['!'], '#ff6a3c', 4, t, 24);
		else puff(e, to, t);
		return t;
	},
	tourbillon: (e, c) => {
		e.draw({
			life: 700,
			draw(ctx, t) {
				const r = 70 + 50 * ease.out(t);
				ctx.lineCap = 'round';
				ctx.shadowColor = '#ff6a3c';
				ctx.shadowBlur = 16;
				ctx.globalAlpha = 1 - t * 0.8;
				for (let k = 0; k < 3; k += 1) {
					const a = t * Math.PI * 5 + (k * Math.PI * 2) / 3;
					ctx.strokeStyle = k % 2 ? '#ffd2a8' : '#ff6a3c';
					ctx.lineWidth = 7 * (1 - t * 0.5);
					ctx.beginPath();
					ctx.arc(c.from.x, c.from.y, r, a, a + 1.3);
					ctx.stroke();
				}
			},
		});
		e.burst(c.from, 18, { speed: 260, life: 600, size: 3, color: FURY, shape: 'spark', drag: 1.5 });
		c.foes.forEach((f, i) => (c.success ? impact(e, f, FURY, 1, 260 + i * 60) : puff(e, f, 260)));
		return 260;
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
				ctx.strokeStyle = '#ffe28a';
				ctx.lineWidth = 2;
				ctx.globalAlpha = 1 - t * 0.3;
				ctx.beginPath();
				ctx.arc(to.x, to.y, r, 0, Math.PI * 2);
				ctx.moveTo(to.x - r - 8, to.y);
				ctx.lineTo(to.x - r + 8, to.y);
				ctx.moveTo(to.x + r - 8, to.y);
				ctx.lineTo(to.x + r + 8, to.y);
				ctx.stroke();
			},
		});
		const end = c.success ? to : beside(c.from, to);
		const t = projectile(e, c.from, end, { color: '#ffe28a', head: 'arrow', speed: 1800, size: 6, delay: 360, trail: '#fff1b8' });
		if (c.success) impact(e, to, ['#ffffff', '#ffe28a', '#ffb347'], 1.8, t);
		else puff(e, end, t);
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
		e.draw({
			life: 900,
			delay: t,
			draw(ctx, k) {
				const r = 50 * ease.out(Math.min(1, k * 3));
				ctx.strokeStyle = '#e8dcb5';
				ctx.lineWidth = 1.6;
				ctx.globalAlpha = k < 0.7 ? 0.9 : (1 - k) / 0.3 * 0.9;
				ctx.save();
				ctx.beginPath();
				ctx.arc(to.x, to.y, r, 0, Math.PI * 2);
				ctx.clip();
				for (let i = -5; i <= 5; i += 1) {
					ctx.beginPath();
					ctx.moveTo(to.x + i * 10 - r, to.y - r);
					ctx.lineTo(to.x + i * 10 + r, to.y + r);
					ctx.moveTo(to.x + i * 10 + r, to.y - r);
					ctx.lineTo(to.x + i * 10 - r, to.y + r);
					ctx.stroke();
				}
				ctx.restore();
				ctx.beginPath();
				ctx.arc(to.x, to.y, r, 0, Math.PI * 2);
				ctx.stroke();
			},
		});
		return t;
	},
	'fleche-empoisonnee': (e, c) => {
		const to = c.foes[0];
		const t = shot(e, c.from, to, c, '#8cff7a', 0, ['#d6ffcc', '#6fdc5a']);
		if (c.success)
			for (let i = 0; i < 12; i += 1)
				e.add({ x: to.x + (Math.random() - 0.5) * 50, y: to.y + 10, vy: -40 - Math.random() * 40, life: 900, delay: t + i * 50, size: 5, sizeEnd: 9, color: '#6fdc5a', shape: 'ring' });
		return t;
	},

	/* Mage */
	'trait-lumiere': (e, c) => {
		const to = c.success ? c.foes[0] : beside(c.from, c.foes[0]);
		e.draw({
			life: 460,
			draw(ctx, t) {
				const w = 14 * Math.sin(Math.PI * Math.min(1, t * 1.3));
				ctx.lineCap = 'round';
				ctx.shadowColor = '#bcd6ff';
				ctx.shadowBlur = 24;
				ctx.strokeStyle = '#9cc2ff';
				ctx.lineWidth = w;
				ctx.beginPath();
				ctx.moveTo(c.from.x, c.from.y);
				ctx.lineTo(to.x, to.y);
				ctx.stroke();
				ctx.strokeStyle = '#ffffff';
				ctx.lineWidth = w * 0.35;
				ctx.stroke();
			},
		});
		if (c.success) impact(e, to, ['#ffffff', '#9cc2ff', '#d6e6ff'], 1.1, 120);
		else puff(e, to, 120);
		return 120;
	},
	etincelle: (e, c) => {
		const to = c.success ? c.foes[0] : beside(c.from, c.foes[0]);
		const t = projectile(e, c.from, to, { color: '#ffb347', speed: 1300, size: 10, wobble: 6 });
		if (c.success) {
			impact(e, to, ['#fff2c4', '#ffb347', '#ff6a3c'], 1.5, t);
			e.burst(to, 24, { speed: 380, life: 650, delay: t, size: 2.5, color: ['#ffe28a', '#ff8a3c'], shape: 'spark', ay: 300, drag: 1 });
		} else puff(e, to, t);
		return t;
	},
	'pluie-etoiles': (e, c) => {
		let last = 0;
		c.foes.forEach((f, j) => {
			for (let i = 0; i < 6; i += 1) {
				const delay = j * 80 + i * 70;
				const x = f.x + (Math.random() - 0.5) * 60;
				e.add({ x, y: f.y - 170, vy: 560, life: 300, delay, size: 9, color: i % 2 ? '#ffe28a' : '#cfe0ff', shape: 'star', vr: 6 });
				if (c.success) e.burst({ x, y: f.y }, 5, { speed: 140, life: 300, delay: delay + 300, size: 2.5, color: '#ffe28a', shape: 'spark' });
				last = Math.max(last, delay + 300);
			}
			if (c.success) impact(e, f, ['#ffffff', '#ffe28a', '#cfe0ff'], 0.9, j * 80 + 300);
			else puff(e, f, j * 80 + 300);
		});
		return c.foes.length ? 300 : last;
	},
	'bouclier-lune': (e, c) => {
		const to = c.allies[0] ?? c.from;
		const t = to === c.from ? 0 : projectile(e, c.from, to, { color: MOON, speed: 700, arc: 30, size: 8 });
		bubble(e, to, MOON, t);
		return t;
	},
	lueur: (e, c) => {
		const to = c.foes[0];
		const t = projectile(e, c.from, c.success ? to : beside(c.from, to), { color: '#ffffff', speed: 1000, size: 6 });
		if (!c.success) return t;
		e.add({ x: to.x, y: to.y, life: 420, delay: t, size: 70, sizeEnd: 110, color: '#ffffff' });
		e.draw({
			life: 520,
			delay: t,
			draw(ctx, k) {
				ctx.strokeStyle = '#fff7d6';
				ctx.lineWidth = 3;
				ctx.globalAlpha = 1 - k;
				for (let i = 0; i < 12; i += 1) {
					const a = (i * Math.PI) / 6 + k;
					ctx.beginPath();
					ctx.moveTo(to.x + Math.cos(a) * 20, to.y + Math.sin(a) * 20);
					ctx.lineTo(to.x + Math.cos(a) * (40 + 60 * k), to.y + Math.sin(a) * (40 + 60 * k));
					ctx.stroke();
				}
			},
		});
		return t;
	},

	/* Barde */
	'note-percante': (e, c) => {
		const to = c.success ? c.foes[0] : beside(c.from, c.foes[0]);
		const t = projectile(e, c.from, to, { color: '#d9a8ff', head: 'glyph', glyph: '♫', speed: 800, size: 8, wobble: 14 });
		if (c.success) {
			impact(e, to, ['#f3e0ff', '#c58cff'], 1, t);
			for (let i = 0; i < 3; i += 1) e.add({ x: to.x, y: to.y, life: 500, delay: t + i * 90, size: 14, sizeEnd: 70, color: '#c58cff', shape: 'ring' });
		} else puff(e, to, t);
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
			e.burst(a, 10, { speed: 40, life: 900, delay: 300 + i * 80, size: 4, color: '#8fe0a0', ay: -160 });
			rising(e, a, ['+'], '#8fe0a0', 3, 300 + i * 80, 22);
		});
		return 300;
	},
	delivrance: (e, c) => {
		rising(e, c.from, ['♪', '♫'], '#ffe28a', 5, 0, 20);
		c.allies.forEach((a, i) => {
			// Le mal (fumée sombre) s'envole, une lumière dorée le remplace.
			e.burst(a, 12, { speed: 60, life: 800, delay: 250 + i * 80, size: 8, sizeEnd: 14, color: 'rgba(150,110,190,0.6)', ay: -200 });
			e.burst(a, 10, { speed: 120, life: 600, delay: 400 + i * 80, size: 3, color: '#ffe28a', shape: 'spark' });
		});
		return 300;
	},
};

/** Joue l'effet d'une compétence ; renvoie le moment de l'impact (ms). */
export function playAbility(eng: FxEngine, ability: string, c: FxCall) {
	const fx = ABILITY_FX[ability];
	if (!fx || (!c.foes.length && !c.allies.length && !['chant', 'delivrance', 'tourbillon'].includes(ability))) {
		impact(eng, c.foes[0] ?? c.allies[0] ?? c.from, STEEL, 0.8);
		return 120;
	}
	return fx(eng, c);
}

/** L'attaque d'une créature sur un héros : morsure pour les bêtes, griffes pour le reste. */
export function playFoeAttack(eng: FxEngine, foeName: string, from: P, to: P, hurt: boolean) {
	const beast = /loup|chien|ours|sanglier|bête/i.test(foeName);
	const t = beast ? bite(eng, to, '#ff5a3c') : claws(eng, from, to, '#c98bff');
	if (hurt) impact(eng, to, ['#ffd2c8', '#ff5a3c', '#ff2d4a'], 1, t);
	else clang(eng, to, t);
	return t;
}

/** Un coup encaissé (armure, bouclier) : étincelles grises. */
function clang(eng: FxEngine, at: P, delay: number) {
	eng.burst(at, 12, { speed: 220, life: 380, delay, size: 3, color: ['#e6ecf5', '#9fb0c8'], shape: 'spark', drag: 2 });
}

/** Le poison qui ronge une créature à son tour. */
export function playPoison(eng: FxEngine, at: P) {
	for (let i = 0; i < 10; i += 1)
		eng.add({ x: at.x + (Math.random() - 0.5) * 50, y: at.y + 14, vy: -50 - Math.random() * 40, life: 800, delay: i * 50, size: 5, sizeEnd: 10, color: '#6fdc5a', shape: 'ring' });
	return 300;
}
