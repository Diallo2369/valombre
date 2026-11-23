'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface Props {
	/** Image de la scène (elle se brouille), et image du combat (elle apparaît). */
	from?: string;
	to?: string;
	/** Durée totale, en ms. */
	ms: number;
}

const VERT = `
attribute vec2 p;
varying vec2 uv;
void main() { uv = p * 0.5 + 0.5; uv.y = 1.0 - uv.y; gl_Position = vec4(p, 0.0, 1.0); }
`;

/**
 * Entrée en combat : l'image de la scène tourbillonne et se brouille (remous, couleurs qui se décalent,
 * grain), un éclair, puis l'image du combat se reforme et le tout s'efface.
 */
const FRAG = `
precision mediump float;
varying vec2 uv;
uniform sampler2D a;
uniform sampler2D b;
uniform vec2 ra;
uniform vec2 rb;
uniform float t;
uniform float seed;

float hash(vec2 q) { return fract(sin(dot(q, vec2(12.9898, 78.233)) + seed) * 43758.5453); }

/* Image « cover » : on recadre pour remplir l'écran sans déformer. */
vec2 cover(vec2 q, vec2 r) { return (q - 0.5) * r + 0.5; }

vec2 swirl(vec2 q, float k) {
	vec2 c = q - 0.5;
	float d = length(c);
	float ang = k * (1.0 - smoothstep(0.0, 0.75, d)) * 7.0;
	float s = sin(ang), co = cos(ang);
	c = mat2(co, -s, s, co) * c;
	return c * (1.0 - k * 0.35) + 0.5;
}

vec3 look(sampler2D tex, vec2 q, vec2 r, float k) {
	vec2 s = swirl(q, k);
	// Des bandes qui glissent, comme une image qui décroche.
	float band = step(0.82, hash(vec2(floor(q.y * 40.0), floor(t * 18.0))));
	s.x += band * k * 0.06 * (hash(vec2(q.y, t)) - 0.5);
	float ab = k * 0.025;
	vec3 col;
	col.r = texture2D(tex, cover(s + vec2(ab, 0.0), r)).r;
	col.g = texture2D(tex, cover(s, r)).g;
	col.b = texture2D(tex, cover(s - vec2(ab, 0.0), r)).b;
	return col;
}

void main() {
	// 0 → 0.55 : la scène se brouille ; 0.55 → 1 : le combat se reforme.
	float k1 = smoothstep(0.0, 0.55, t);
	float k2 = 1.0 - smoothstep(0.5, 0.95, t);
	float mixer = smoothstep(0.45, 0.62, t);
	vec3 A = look(a, uv, ra, k1);
	vec3 B = look(b, uv, rb, k2);
	vec3 col = mix(A, B, mixer);
	// Grain, assombrissement des bords, éclair au milieu.
	float grain = (hash(uv * 900.0 + t) - 0.5) * 0.25 * (k1 * k2);
	col += grain;
	float flash = exp(-pow((t - 0.52) * 14.0, 2.0));
	col += vec3(1.0, 0.85, 0.7) * flash * 0.9;
	float vig = smoothstep(0.95, 0.3, length(uv - 0.5));
	col *= mix(1.0, vig, 0.6 * k1);
	col.r += 0.12 * k1 * k2;
	gl_FragColor = vec4(col, 1.0);
}
`;

function load(url?: string) {
	return new Promise<HTMLImageElement | null>((resolve) => {
		if (!url) return resolve(null);
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => resolve(null);
		img.src = url;
	});
}

export function CombatIntro({ from, to, ms }: Props) {
	const ref = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = ref.current;
		if (!canvas) return;
		let raf = 0;
		let alive = true;
		const gl = canvas.getContext('webgl', { premultipliedAlpha: false });
		if (!gl) {
			canvas.style.display = 'none';
			return;
		}
		void Promise.all([load(from), load(to ?? from)]).then(([ia, ib]) => {
			if (!alive) return;
			const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
			canvas.width = Math.round(window.innerWidth * dpr);
			canvas.height = Math.round(window.innerHeight * dpr);
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
			if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
				canvas.style.display = 'none';
				return;
			}
			gl.useProgram(prog);
			const buf = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, buf);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
			const loc = gl.getAttribLocation(prog, 'p');
			gl.enableVertexAttribArray(loc);
			gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

			const screen = canvas.width / canvas.height;
			/** Rapport de recadrage « cover » d'une image sur l'écran. */
			const ratio = (img: HTMLImageElement | null): [number, number] => {
				if (!img) return [1, 1];
				const r = img.width / img.height;
				return r > screen ? [screen / r, 1] : [1, r / screen];
			};
			const tex = (unit: number, img: HTMLImageElement | null) => {
				const t = gl.createTexture();
				gl.activeTexture(gl.TEXTURE0 + unit);
				gl.bindTexture(gl.TEXTURE_2D, t);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
				if (img) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
				// Pas d'image : une nuit bleutée.
				else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([22, 28, 44, 255]));
			};
			tex(0, ia);
			tex(1, ib);
			gl.uniform1i(gl.getUniformLocation(prog, 'a'), 0);
			gl.uniform1i(gl.getUniformLocation(prog, 'b'), 1);
			gl.uniform2fv(gl.getUniformLocation(prog, 'ra'), ratio(ia));
			gl.uniform2fv(gl.getUniformLocation(prog, 'rb'), ratio(ib));
			gl.uniform1f(gl.getUniformLocation(prog, 'seed'), Math.random() * 10);
			const ut = gl.getUniformLocation(prog, 't');

			const start = performance.now();
			// Le shader occupe les 80 % du temps ; le reste, le canvas s'efface (CSS).
			const run = ms * 0.8;
			const frame = (now: number) => {
				if (!alive) return;
				const t = Math.min(1, (now - start) / run);
				gl.uniform1f(ut, t);
				gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
				if (t < 1) raf = requestAnimationFrame(frame);
				else canvas.classList.add('is-done');
			};
			raf = requestAnimationFrame(frame);
		});

		return () => {
			alive = false;
			cancelAnimationFrame(raf);
			gl.getExtension('WEBGL_lose_context')?.loseContext();
		};
	}, [from, to, ms]);

	if (typeof document === 'undefined') return null;
	return createPortal(<canvas ref={ref} className="combat-intro" aria-hidden="true" style={{ '--intro': `${ms}ms` } as React.CSSProperties} />, document.body);
}
