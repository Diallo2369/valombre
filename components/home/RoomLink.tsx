'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const VERT = `
attribute vec2 p;
varying vec2 uv;
void main() { uv = p * 0.5 + 0.5; uv.y = 1.0 - uv.y; gl_Position = vec4(p, 0.0, 1.0); }
`;

/**
 * On plonge dans la pièce : l'image se rapproche de la table (zoom qui accélère), un flou de mouvement
 * file vers le point visé, la lumière des bougies monte, les bords s'assombrissent, puis tout se fond dans la nuit.
 */
const FRAG = `
precision mediump float;
varying vec2 uv;
uniform sampler2D img;
uniform vec2 ratio;
uniform vec2 focus;
uniform float t;
/* 1 : « réduire les animations » (pas de zoom ni de flou de mouvement, seulement la lumière et la nuit). */
uniform float calm;

vec2 cover(vec2 q) { return (q - 0.5) * ratio + 0.5; }

void main() {
	float k = t * t;
	float zoom = 1.0 + 3.0 * k * (1.0 - calm);
	vec2 q = focus + (uv - focus) / zoom;
	// Flou de mouvement vers le point visé : plusieurs échantillons le long du rayon.
	vec3 col = vec3(0.0);
	float blur = 0.22 * t * (1.0 - calm);
	for (int i = 0; i < 12; i++) {
		float s = float(i) / 11.0;
		vec2 at = focus + (q - focus) * (1.0 - blur * s);
		col += texture2D(img, cover(at)).rgb;
	}
	col /= 12.0;
	float d = length((uv - focus) * vec2(1.6, 1.0));
	// La lumière chaude des bougies qui envahit l'image.
	col += vec3(1.0, 0.62, 0.28) * 0.45 * smoothstep(0.25, 0.85, t) * (1.0 - smoothstep(0.0, 0.9, d));
	// Les bords qui se referment, puis la nuit.
	col *= 1.0 - smoothstep(0.15, 0.95, d) * smoothstep(0.1, 0.9, t);
	col = mix(col, vec3(0.05, 0.066, 0.105), smoothstep(0.78, 1.0, t));
	gl_FragColor = vec4(col, 1.0);
}
`;

function RoomTransition({ image, ms, onDone }: { image: string; ms: number; onDone: () => void }) {
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
		const img = new Image();
		img.onerror = () => onDone();
		img.onload = () => {
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
			if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return onDone();
			gl.useProgram(prog);
			gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
			const loc = gl.getAttribLocation(prog, 'p');
			gl.enableVertexAttribArray(loc);
			gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
			gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
			const screen = canvas.width / canvas.height;
			const r = img.width / img.height;
			gl.uniform2fv(gl.getUniformLocation(prog, 'ratio'), r > screen ? [screen / r, 1] : [1, r / screen]);
			// On vise le milieu de la table, un peu vers les bougies.
			gl.uniform2fv(gl.getUniformLocation(prog, 'focus'), [0.6, 0.45]);
			gl.uniform1f(gl.getUniformLocation(prog, 'calm'), window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 0);
			const ut = gl.getUniformLocation(prog, 't');
			const start = performance.now();
			const frame = (now: number) => {
				if (!alive) return;
				const t = Math.min(1, (now - start) / ms);
				gl.uniform1f(ut, t);
				gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
				if (t < 1) raf = requestAnimationFrame(frame);
				else onDone();
			};
			raf = requestAnimationFrame(frame);
		};
		img.src = image;
		return () => {
			alive = false;
			cancelAnimationFrame(raf);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
	return createPortal(<canvas ref={ref} className="room-transition" aria-hidden="true" />, document.body);
}

/**
 * Un lien de la page d'accueil qui « fait entrer dans la pièce » : au clic, la transition se joue,
 * puis on navigue. Ctrl/Cmd-clic et clic du milieu : lien normal. Avec « réduire les animations », la transition
 * garde la lumière et le fondu vers la nuit, sans zoom.
 */
export function RoomLink({ href, image, className, children, ms = 1300 }: { href: string; image?: string; className?: string; children: ReactNode; ms?: number }) {
	const router = useRouter();
	const [going, setGoing] = useState(false);
	return (
		<>
			<Link
				href={href}
				className={className}
				onClick={(e) => {
					if (!image || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
					e.preventDefault();
					setGoing(true);
				}}
			>
				{children}
			</Link>
			{going && image ? <RoomTransition image={image} ms={ms} onDone={() => router.push(href)} /> : null}
		</>
	);
}
