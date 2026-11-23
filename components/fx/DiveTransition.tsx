'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const VERT = `
attribute vec2 p;
varying vec2 uv;
void main() { uv = p * 0.5 + 0.5; uv.y = 1.0 - uv.y; gl_Position = vec4(p, 0.0, 1.0); }
`;

/**
 * On plonge dans l'image : elle se rapproche (zoom qui accélère), un flou de mouvement file vers le point visé.
 * - Une seule image : une lumière chaude monte, les bords se referment, puis la nuit (`night`) ou un éclat de lumière.
 * - Deux images (`two`) : la première (la carte) tient un instant, on zoome sur le point visé, puis elle se fond
 *   dans la seconde (la scène), qui se pose en se dézoomant légèrement.
 */
const FRAG = `
precision mediump float;
varying vec2 uv;
uniform sampler2D img;
uniform sampler2D img2;
uniform vec2 ratio;
uniform vec2 ratio2;
uniform vec2 focus;
uniform float t;
/* 1 : « réduire les animations » (pas de zoom ni de flou de mouvement). */
uniform float calm;
uniform float night;
uniform float two;

vec2 cover(vec2 q, vec2 r) { return (q - 0.5) * r + 0.5; }

void main() {
	// Avec deux images, la carte tient un instant avant qu'on plonge dedans.
	float zt = mix(t, smoothstep(0.18, 0.85, t), two);
	float k = zt * zt;
	float zoom = 1.0 + mix(3.0, 4.5, two) * k * (1.0 - calm);
	vec2 q = focus + (uv - focus) / zoom;
	// Flou de mouvement vers le point visé : plusieurs échantillons le long du rayon.
	vec3 col = vec3(0.0);
	float blur = 0.22 * zt * (1.0 - calm);
	for (int i = 0; i < 12; i++) {
		float s = float(i) / 11.0;
		vec2 at = focus + (q - focus) * (1.0 - blur * s);
		col += texture2D(img, cover(at, ratio)).rgb;
	}
	col /= 12.0;
	float d = length((uv - focus) * vec2(1.6, 1.0));
	float one = 1.0 - two;
	// Une seule image : la lumière chaude qui envahit l'image, les bords qui se referment, puis la nuit ou un éclat.
	col += one * vec3(1.0, 0.62, 0.28) * 0.45 * smoothstep(0.25, 0.85, t) * (1.0 - smoothstep(0.0, 0.9, d));
	col *= 1.0 - (one + two * 0.5) * smoothstep(0.15, 0.95, d) * smoothstep(0.1, 0.9, zt);
	col = mix(col, vec3(0.05, 0.066, 0.105), one * night * smoothstep(0.78, 1.0, t));
	col = mix(col, vec3(1.0, 0.86, 0.62), one * (1.0 - night) * smoothstep(0.8, 1.0, t) * 0.85);
	// Deux images : la scène apparaît dans le zoom, puis se pose (léger dézoom jusqu'à sa taille réelle).
	float zb = 1.0 + 0.3 * (1.0 - smoothstep(0.55, 1.0, t)) * (1.0 - calm);
	vec3 scene = texture2D(img2, cover(0.5 + (uv - 0.5) / zb, ratio2)).rgb;
	col = mix(col, scene, two * smoothstep(0.58, 0.86, t));
	gl_FragColor = vec4(col, 1.0);
}
`;

function load(url: string) {
	return new Promise<HTMLImageElement | null>((resolve) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => resolve(null);
		img.src = url;
	});
}

interface Props {
	/** L'image dans laquelle on plonge (la carte, ou la scène). */
	image: string;
	/** Si donnée : on finit fondu dans cette image (la scène qui apparaît). */
	to?: string;
	ms?: number;
	/** Durée du fondu d'apparition (ms). */
	fadeIn?: number;
	/** Point visé, en fraction de l'écran (0-1). */
	focus?: [number, number];
	/** Une seule image : finir dans la nuit (sinon dans un éclat de lumière chaude). */
	night?: boolean;
	onDone: () => void;
}

export function DiveTransition({ image, to, ms = 1300, fadeIn = 180, focus = [0.5, 0.5], night = true, onDone }: Props) {
	const ref = useRef<HTMLCanvasElement>(null);
	useEffect(() => {
		const canvas = ref.current;
		const gl = canvas?.getContext('webgl');
		if (!canvas || !gl) {
			onDone();
			return;
		}
		let raf = 0;
		let alive = true;
		void Promise.all([load(image), to ? load(to) : Promise.resolve(null)]).then(([a, b]) => {
			if (!alive) return;
			if (!a || (to && !b)) return onDone();
			const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
			// La taille affichée du canevas (comme la carte dessous, sans la barre de défilement) : l'image tombe pile dessus.
			canvas.width = Math.round(canvas.clientWidth * dpr);
			canvas.height = Math.round(canvas.clientHeight * dpr);
			gl.viewport(0, 0, canvas.width, canvas.height);
			const sh = (type: number, src: string) => {
				const s = gl.createShader(type)!;
				gl.shaderSource(s, src);
				gl.compileShader(s);
				return s;
			};
			const prog = gl.createProgram()!;
			gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
			gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
			gl.linkProgram(prog);
			if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return onDone();
			gl.useProgram(prog);
			gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
			const loc = gl.getAttribLocation(prog, 'p');
			gl.enableVertexAttribArray(loc);
			gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
			const screen = canvas.width / canvas.height;
			/** Rapport de recadrage « cover » d'une image sur l'écran. */
			const ratio = (im: HTMLImageElement) => {
				const r = im.width / im.height;
				return r > screen ? [screen / r, 1] : [1, r / screen];
			};
			const texture = (unit: number, im: HTMLImageElement) => {
				gl.activeTexture(gl.TEXTURE0 + unit);
				gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
			};
			texture(0, a);
			texture(1, b ?? a);
			gl.uniform1i(gl.getUniformLocation(prog, 'img'), 0);
			gl.uniform1i(gl.getUniformLocation(prog, 'img2'), 1);
			gl.uniform2fv(gl.getUniformLocation(prog, 'ratio'), ratio(a));
			gl.uniform2fv(gl.getUniformLocation(prog, 'ratio2'), ratio(b ?? a));
			gl.uniform2fv(gl.getUniformLocation(prog, 'focus'), focus);
			gl.uniform1f(gl.getUniformLocation(prog, 'night'), night ? 1 : 0);
			gl.uniform1f(gl.getUniformLocation(prog, 'two'), b ? 1 : 0);
			gl.uniform1f(gl.getUniformLocation(prog, 'calm'), window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 0);
			const ut = gl.getUniformLocation(prog, 't');
			const start = performance.now();
			const frame = (now: number) => {
				if (!alive) return;
				const t = Math.min(1, (now - start) / ms);
				gl.uniform1f(ut, t);
				gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
				if (t < 1) raf = requestAnimationFrame(frame);
				else {
					// Le canevas s'efface (CSS) pendant que la suite apparaît dessous.
					canvas.classList.add('is-done');
					onDone();
				}
			};
			raf = requestAnimationFrame(frame);
		});
		return () => {
			alive = false;
			cancelAnimationFrame(raf);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
	return createPortal(<canvas ref={ref} className="dive-transition" aria-hidden="true" style={{ '--fade': `${fadeIn}ms` } as React.CSSProperties} />, document.body);
}
