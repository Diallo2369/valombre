/**
 * Petit moteur d'effets en Canvas 2D, posé en transparence sur le plateau de combat.
 * Les coordonnées sont celles du plateau (unités du viewBox : BOARD_W × BOARD_H) : le moteur
 * les met à l'échelle du canvas. Il ne tourne (requestAnimationFrame) que tant qu'un effet est en cours.
 */

export interface P {
	x: number;
	y: number;
}

/** Une particule : un point qui bouge, grossit ou rétrécit, et s'éteint. */
export interface Particle {
	x: number;
	y: number;
	vx?: number;
	vy?: number;
	/** Accélération (gravité, poussée). */
	ax?: number;
	ay?: number;
	/** Freinage par seconde (0 : aucun, 0.9 : très fort). */
	drag?: number;
	/** Durée de vie et retard avant d'apparaître, en ms. */
	life: number;
	delay?: number;
	size: number;
	sizeEnd?: number;
	color: string;
	alpha?: number;
	/** « twinkle » : une étincelle de lumière à 4 branches, façon reflet. */
	shape?: 'dot' | 'spark' | 'star' | 'ring' | 'glyph' | 'twinkle';
	glyph?: string;
	rot?: number;
	vr?: number;
	age?: number;
	/** Style néon : forme pleine et brillante, avec un halo coloré et un cœur blanc (sauf si core vaut false). */
	neon?: boolean;
	core?: boolean;
}

/** L'encre des contours BD (bulles d'onomatopées). */
export const INK = '#16111c';

/** Un dessin libre, animé de t = 0 à t = 1 sur sa durée. */
export interface Draw {
	life: number;
	delay?: number;
	age?: number;
	draw: (ctx: CanvasRenderingContext2D, t: number, eng: FxEngine) => void;
}

export class FxEngine {
	private ctx: CanvasRenderingContext2D;
	private particles: Particle[] = [];
	private draws: Draw[] = [];
	private raf = 0;
	private last = 0;
	/** Unités du plateau → pixels du canvas. */
	scale = 1;
	/**
	 * Vitesse des effets (1 : temps réel). Plus lent, façon jeu de tactique : on a le temps de voir chaque coup.
	 * Les durées écrites dans les effets sont en « temps d'effet » ; real() les convertit en vraies ms.
	 */
	speed = 0.6;

	/** Convertit une durée d'effet en millisecondes réelles. */
	real(ms: number) {
		return Math.round(ms / this.speed);
	}

	constructor(
		private canvas: HTMLCanvasElement,
		private boardW: number,
		private boardH: number,
	) {
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Canvas 2D indisponible');
		this.ctx = ctx;
		this.resize();
	}

	/** À appeler quand le plateau change de taille. */
	resize() {
		// Taille de mise en page (offsetWidth), pas getBoundingClientRect : la table est penchée en 3D,
		// et la boîte projetée ne correspond plus aux coordonnées du plateau.
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		this.canvas.width = Math.max(1, Math.round(this.canvas.offsetWidth * dpr));
		this.canvas.height = Math.max(1, Math.round(this.canvas.offsetHeight * dpr));
		this.scale = this.canvas.width / this.boardW;
	}

	add(p: Particle) {
		this.particles.push({ age: 0, alpha: 1, vx: 0, vy: 0, ax: 0, ay: 0, drag: 0, rot: 0, vr: 0, shape: 'dot', ...p });
		this.start();
	}

	draw(d: Draw) {
		this.draws.push({ age: 0, ...d });
		this.start();
	}

	/** Une gerbe de particules autour d'un point. */
	burst(at: P, n: number, opts: Omit<Partial<Particle>, 'color'> & { speed: number; spread?: number; angle?: number; color: string | string[] }) {
		const { speed, spread = Math.PI * 2, angle = 0, color, ...rest } = opts;
		for (let i = 0; i < n; i += 1) {
			const a = angle - spread / 2 + Math.random() * spread;
			const v = speed * (0.4 + Math.random() * 0.8);
			this.add({
				x: at.x,
				y: at.y,
				vx: Math.cos(a) * v,
				vy: Math.sin(a) * v,
				life: 500,
				size: 3,
				...rest,
				color: Array.isArray(color) ? color[i % color.length] : color,
			});
		}
	}

	clear() {
		this.particles = [];
		this.draws = [];
		cancelAnimationFrame(this.raf);
		this.raf = 0;
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
	}

	private start() {
		if (this.raf) return;
		this.last = performance.now();
		this.raf = requestAnimationFrame(this.tick);
	}

	private tick = (now: number) => {
		const dt = Math.min(50, now - this.last) * this.speed;
		this.last = now;
		const { ctx } = this;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
		// Les couleurs s'additionnent : ça brille.
		ctx.globalCompositeOperation = 'lighter';

		this.draws = this.draws.filter((d) => {
			d.age = (d.age ?? 0) + dt;
			const local = d.age - (d.delay ?? 0);
			if (local < 0) return true;
			if (local > d.life) return false;
			ctx.save();
			d.draw(ctx, local / d.life, this);
			ctx.restore();
			return true;
		});

		const s = dt / 1000;
		this.particles = this.particles.filter((p) => {
			p.age = (p.age ?? 0) + dt;
			const local = p.age - (p.delay ?? 0);
			if (local < 0) return true;
			if (local > p.life) return false;
			const t = local / p.life;
			p.vx = (p.vx! + p.ax! * s) * (1 - p.drag! * s);
			p.vy = (p.vy! + p.ay! * s) * (1 - p.drag! * s);
			p.x += p.vx * s;
			p.y += p.vy * s;
			p.rot! += p.vr! * s;
			const size = p.size + ((p.sizeEnd ?? p.size) - p.size) * t;
			const alpha = p.alpha! * (t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85);
			ctx.globalAlpha = Math.max(0, alpha);
			ctx.fillStyle = p.color;
			ctx.strokeStyle = p.color;
			if (p.neon || p.shape === 'twinkle') {
				neonParticle(ctx, p, size);
				return true;
			}
			switch (p.shape) {
				case 'spark': {
					const len = Math.hypot(p.vx, p.vy) * 0.05 + size;
					const a = Math.atan2(p.vy, p.vx);
					ctx.lineWidth = size * 0.6;
					ctx.lineCap = 'round';
					ctx.beginPath();
					ctx.moveTo(p.x, p.y);
					ctx.lineTo(p.x - Math.cos(a) * len, p.y - Math.sin(a) * len);
					ctx.stroke();
					break;
				}
				case 'star':
					star(ctx, p.x, p.y, size, p.rot!);
					break;
				case 'ring':
					ctx.lineWidth = Math.max(0.5, size * 0.12);
					ctx.beginPath();
					ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
					ctx.stroke();
					break;
				case 'glyph':
					ctx.save();
					ctx.translate(p.x, p.y);
					ctx.rotate(p.rot!);
					ctx.font = `${size}px serif`;
					ctx.textAlign = 'center';
					ctx.textBaseline = 'middle';
					ctx.fillText(p.glyph ?? '♥', 0, 0);
					ctx.restore();
					break;
				default: {
					const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size);
					g.addColorStop(0, p.color);
					g.addColorStop(1, 'rgba(0,0,0,0)');
					ctx.fillStyle = g;
					ctx.beginPath();
					ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
					ctx.fill();
				}
			}
			return true;
		});
		ctx.globalAlpha = 1;

		if (this.particles.length || this.draws.length) this.raf = requestAnimationFrame(this.tick);
		else {
			this.raf = 0;
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		}
	};

	get size() {
		return { w: this.boardW, h: this.boardH };
	}
}

/** Le chemin d'une étoile à cinq branches (sans la remplir). */
export function starPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot = 0) {
	ctx.beginPath();
	for (let i = 0; i < 10; i += 1) {
		const a = rot + (i * Math.PI) / 5 - Math.PI / 2;
		const rr = i % 2 ? r * 0.45 : r;
		ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
	}
	ctx.closePath();
}

/** Une étoile à cinq branches. */
export function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot = 0) {
	starPath(ctx, x, y, r, rot);
	ctx.fill();
}

/** Remplit le chemin courant en lumière : halo coloré, puis un fin liseré blanc. */
export function glowFill(ctx: CanvasRenderingContext2D, fill: string, line = 3.5) {
	const op = ctx.globalCompositeOperation;
	ctx.globalCompositeOperation = 'lighter';
	ctx.lineJoin = 'round';
	ctx.shadowColor = fill;
	ctx.shadowBlur = 18;
	ctx.fillStyle = fill;
	ctx.fill();
	ctx.shadowBlur = 0;
	ctx.lineWidth = Math.max(1, line * 0.5);
	ctx.strokeStyle = 'rgba(255,255,255,0.85)';
	ctx.stroke();
	ctx.globalCompositeOperation = op;
}

/** Trace le chemin courant en néon : un large halo, le trait coloré, puis un cœur blanc. */
export function glowStroke(ctx: CanvasRenderingContext2D, color: string, width: number, halo = 3) {
	const op = ctx.globalCompositeOperation;
	const a = ctx.globalAlpha;
	ctx.globalCompositeOperation = 'lighter';
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	ctx.shadowColor = color;
	ctx.strokeStyle = color;
	if (halo > 0) {
		ctx.shadowBlur = width * 2.5;
		ctx.globalAlpha = a * 0.45;
		ctx.lineWidth = width * 1.9;
		ctx.stroke();
	}
	ctx.globalAlpha = a;
	ctx.shadowBlur = width;
	ctx.lineWidth = width;
	ctx.stroke();
	ctx.shadowBlur = 0;
	ctx.strokeStyle = '#ffffff';
	ctx.lineWidth = Math.max(1, width * 0.38);
	ctx.stroke();
	ctx.globalCompositeOperation = op;
}

/** Une étincelle à 4 branches (deux fuseaux croisés), avec un petit halo. */
export function twinkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, color: string) {
	const g = ctx.createRadialGradient(x, y, 0, x, y, r * 0.8);
	g.addColorStop(0, color);
	g.addColorStop(1, 'rgba(0,0,0,0)');
	ctx.fillStyle = g;
	ctx.beginPath();
	ctx.arc(x, y, r * 0.8, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = '#ffffff';
	for (const a of [rot, rot + Math.PI / 2]) {
		const c = Math.cos(a);
		const s = Math.sin(a);
		const w = r * 0.13;
		ctx.beginPath();
		ctx.moveTo(x + c * r, y + s * r);
		ctx.lineTo(x - s * w, y + c * w);
		ctx.lineTo(x - c * r, y - s * r);
		ctx.lineTo(x + s * w, y - c * w);
		ctx.closePath();
		ctx.fill();
	}
}

/** Une particule en style néon (dessinée en lumière additive, comme le reste du moteur). */
function neonParticle(ctx: CanvasRenderingContext2D, p: Particle, size: number) {
	switch (p.shape) {
		case 'twinkle':
			twinkle(ctx, p.x, p.y, size, p.rot!, p.color);
			break;
		case 'spark': {
			const len = Math.hypot(p.vx!, p.vy!) * 0.05 + size;
			const a = Math.atan2(p.vy!, p.vx!);
			ctx.beginPath();
			ctx.moveTo(p.x, p.y);
			ctx.lineTo(p.x - Math.cos(a) * len, p.y - Math.sin(a) * len);
			glowStroke(ctx, p.color, size * 0.8, 0);
			break;
		}
		case 'star':
			starPath(ctx, p.x, p.y, size, p.rot!);
			glowFill(ctx, p.color, 2);
			break;
		case 'ring':
			ctx.beginPath();
			ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
			glowStroke(ctx, p.color, Math.max(3, size * 0.1), 2);
			break;
		case 'glyph':
			ctx.save();
			ctx.translate(p.x, p.y);
			ctx.rotate(p.rot!);
			ctx.font = `900 ${size}px "Arial Black", Impact, sans-serif`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.shadowColor = p.color;
			ctx.shadowBlur = 14;
			ctx.fillText(p.glyph ?? '♥', 0, 0);
			ctx.shadowBlur = 0;
			ctx.lineWidth = 1.2;
			ctx.strokeStyle = 'rgba(255,255,255,0.9)';
			ctx.strokeText(p.glyph ?? '♥', 0, 0);
			ctx.restore();
			break;
		default: {
			const r = Math.max(0.5, size);
			const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.4);
			g.addColorStop(0, p.color);
			g.addColorStop(1, 'rgba(0,0,0,0)');
			ctx.fillStyle = g;
			ctx.beginPath();
			ctx.arc(p.x, p.y, r * 2.4, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillStyle = p.color;
			ctx.beginPath();
			ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
			ctx.fill();
			if (p.core !== false) {
				ctx.fillStyle = '#ffffff';
				ctx.beginPath();
				ctx.arc(p.x, p.y, r * 0.45, 0, Math.PI * 2);
				ctx.fill();
			}
		}
	}
}

export const ease = {
	out: (t: number) => 1 - (1 - t) ** 3,
	in: (t: number) => t * t * t,
	inOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
};

export const lerp = (a: P, b: P, t: number): P => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
