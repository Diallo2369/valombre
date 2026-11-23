'use client';

import { useEffect, useRef } from 'react';
import type { Light } from '@/engine/types';

/**
 * Lumières vivantes posées par-dessus l'image fixe d'une scène : feu qui vacille, lanterne qui tremble, bougie,
 * brume qui glisse, éclairs, lueur magique qui respire. Un seul canevas, fusionné en « screen »
 * (il ne fait qu'éclairer l'image, jamais l'assombrir).
 * Avec « réduire les animations » activé dans le système, on dessine une lueur fixe, sans mouvement.
 */

const DEFAULT_COLOR: Record<Light['kind'], string> = {
	feu: '255,140,50',
	lanterne: '255,185,100',
	bougie: '255,200,120',
	magie: '150,190,255',
	brume: '200,208,222',
	eclair: '235,240,255',
	pluie: '190,205,225',
};

/** Bruit lisse et irrégulier (somme de sinus décalés) : un feu ne vacille jamais en rythme. */
const flicker = (t: number, seed: number, speed: number) =>
	0.5 +
	0.25 * Math.sin(t * 2.1 * speed + seed) +
	0.15 * Math.sin(t * 5.3 * speed + seed * 2.7) +
	0.1 * Math.sin(t * 11.7 * speed + seed * 5.1);

/** Une goutte de pluie qui tombe, ou un petit éclat quand elle touche le sol. */
interface Drop {
	x: number;
	y: number;
	len: number;
	speed: number;
	/** Hauteur (0 à 1) où elle s'écrase : la pluie tombe sur toute l'image, pas seulement en bas. */
	ground: number;
}

interface Splash {
	x: number;
	y: number;
	life: number;
}

interface Ember {
	x: number;
	y: number;
	vy: number;
	vx: number;
	life: number;
}

export function LightLayer({ lights }: { lights: Light[] }) {
	const canvas = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const el = canvas.current;
		const ctx = el?.getContext('2d');
		if (!el || !ctx || !lights.length) return;
		const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		let w = 0;
		let h = 0;
		const resize = () => {
			const r = el.getBoundingClientRect();
			const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
			w = r.width;
			h = r.height;
			el.width = Math.round(w * dpr);
			el.height = Math.round(h * dpr);
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		};
		resize();
		const ro = new ResizeObserver(resize);
		ro.observe(el);

		const embers: Ember[] = [];
		const mists = lights.some((l) => l.kind === 'brume')
			? Array.from({ length: 5 }, (_, i) => ({ x: Math.random(), y: 0.35 + Math.random() * 0.55, r: 0.25 + Math.random() * 0.25, v: 0.004 + Math.random() * 0.006, seed: i * 1.7 }))
			: [];
		// Pluie : des traits fins qui tombent en biais, et de petits éclats là où les gouttes s'écrasent.
		const rain = lights.find((l) => l.kind === 'pluie');
		const drops: Drop[] = [];
		const splashes: Splash[] = [];
		const newDrop = (anywhere: boolean): Drop => ({
			x: Math.random() * 1.2 - 0.1,
			y: anywhere ? Math.random() : -0.05 - Math.random() * 0.1,
			len: 0.025 + Math.random() * 0.035,
			speed: 1.1 + Math.random() * 0.7,
			ground: 0.55 + Math.random() * 0.45,
		});
		if (rain) for (let i = 0; i < Math.round(160 * (rain.intensity ?? 1)); i += 1) drops.push(newDrop(true));
		let flash = 0;
		let nextFlash = performance.now() + 3000 + Math.random() * 6000;

		const glow = (x: number, y: number, radius: number, color: string, alpha: number) => {
			const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
			g.addColorStop(0, `rgba(${color},${alpha})`);
			g.addColorStop(0.4, `rgba(${color},${alpha * 0.45})`);
			g.addColorStop(1, `rgba(${color},0)`);
			ctx.fillStyle = g;
			ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
		};

		let raf = 0;
		let last = performance.now();
		const draw = (now: number) => {
			const t = now / 1000;
			const dt = Math.min(0.05, (now - last) / 1000);
			last = now;
			ctx.clearRect(0, 0, w, h);

			lights.forEach((l, i) => {
				const color = l.color ?? DEFAULT_COLOR[l.kind];
				const k = l.intensity ?? 1;
				const x = ((l.x ?? 50) / 100) * w;
				const y = ((l.y ?? 50) / 100) * h;
				const radius = (l.size ?? 0.3) * Math.max(w, h);

				if (l.kind === 'feu') {
					const f = still ? 0.75 : flicker(t, i * 3.1, 1.4);
					glow(x, y, radius * (0.85 + 0.2 * f), color, 0.4 * k * (0.45 + 0.55 * f));
					// Une lueur douce sur toute la pièce, qui suit le feu : les murs « respirent » avec lui.
					ctx.fillStyle = `rgba(${color},${0.08 * k * f})`;
					ctx.fillRect(0, 0, w, h);
					if (!still && Math.random() < 0.06 * k)
						embers.push({ x: x + (Math.random() - 0.5) * radius * 0.4, y, vy: -(20 + Math.random() * 30), vx: (Math.random() - 0.5) * 12, life: 1 });
				} else if (l.kind === 'bougie') {
					// Une flamme de bougie : vive, nerveuse, avec de petits creux comme un courant d'air.
					const f = still ? 0.8 : flicker(t, i * 4.7, 2.4) * (0.75 + 0.25 * flicker(t, i * 1.3, 0.35));
					glow(x, y, radius * (0.85 + 0.25 * f), color, 0.42 * k * (0.45 + 0.55 * f));
				} else if (l.kind === 'lanterne') {
					const f = still ? 0.8 : flicker(t, i * 2.3, 0.9);
					glow(x, y, radius * (0.95 + 0.06 * f), color, 0.34 * k * (0.75 + 0.25 * f));
				} else if (l.kind === 'magie') {
					const p = still ? 0.6 : 0.5 + 0.5 * Math.sin(t * 1.4 + i);
					glow(x, y, radius * (0.85 + 0.2 * p), color, 0.3 * k * (0.5 + 0.5 * p));
				} else if (l.kind === 'eclair' && !still) {
					if (now > nextFlash) {
						flash = 1;
						// Parfois un double éclair, juste après le premier.
						nextFlash = now + (Math.random() < 0.3 ? 180 : 5000 + Math.random() * 8000);
					}
					if (flash > 0) {
						ctx.fillStyle = `rgba(${color},${0.55 * k * flash})`;
						ctx.fillRect(0, 0, w, h);
						flash = Math.max(0, flash - dt * 4);
					}
				}
			});

			// Brume qui glisse lentement devant l'image.
			for (const m of mists) {
				if (!still) m.x += m.v * dt * 6;
				if (m.x - m.r > 1.2) m.x = -m.r;
				const k = lights.find((l) => l.kind === 'brume')?.intensity ?? 1;
				const breath = still ? 0.7 : 0.6 + 0.4 * Math.sin(t * 0.3 + m.seed);
				glow(m.x * w, m.y * h, m.r * w, DEFAULT_COLOR.brume, 0.1 * k * breath);
			}

			// La pluie.
			if (rain && !still) {
				const color = rain.color ?? DEFAULT_COLOR.pluie;
				const wind = ((rain.x ?? 12) * Math.PI) / 180;
				const dx = Math.sin(wind);
				const dy = Math.cos(wind);
				ctx.lineCap = 'round';
				ctx.lineWidth = 1.1;
				for (const d of drops) {
					d.y += d.speed * dt * dy;
					d.x += d.speed * dt * dx;
					if (d.y > d.ground) {
						if (Math.random() < 0.35) splashes.push({ x: d.x, y: d.y, life: 1 });
						Object.assign(d, newDrop(false));
						continue;
					}
					ctx.strokeStyle = `rgba(${color},${0.22 + 0.25 * (d.speed - 1.1)})`;
					ctx.beginPath();
					ctx.moveTo(d.x * w, d.y * h);
					ctx.lineTo((d.x - dx * d.len) * w, (d.y - dy * d.len) * h);
					ctx.stroke();
				}
				for (let j = splashes.length - 1; j >= 0; j--) {
					const s = splashes[j];
					s.life -= dt * 5;
					if (s.life <= 0) {
						splashes.splice(j, 1);
						continue;
					}
					ctx.strokeStyle = `rgba(${color},${0.45 * s.life})`;
					ctx.beginPath();
					ctx.ellipse(s.x * w, s.y * h, (1 - s.life) * 7 + 1, (1 - s.life) * 2.2 + 0.5, 0, Math.PI, Math.PI * 2);
					ctx.stroke();
				}
			}

			// Braises qui montent du feu.
			for (let j = embers.length - 1; j >= 0; j--) {
				const e = embers[j];
				e.x += e.vx * dt;
				e.y += e.vy * dt;
				e.life -= dt * 0.6;
				if (e.life <= 0) {
					embers.splice(j, 1);
					continue;
				}
				ctx.fillStyle = `rgba(255,170,80,${0.8 * e.life})`;
				ctx.beginPath();
				ctx.arc(e.x, e.y, 1.4, 0, Math.PI * 2);
				ctx.fill();
			}

			if (!still) raf = requestAnimationFrame(draw);
		};
		raf = requestAnimationFrame(draw);

		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
		};
	}, [lights]);

	if (!lights.length) return null;
	return <canvas ref={canvas} className="light-layer" aria-hidden="true" />;
}
