'use client';

import { useRef, useState } from 'react';

const SIZE = 512;

/** Recadre l'image au centre en carré de 512 px et la compresse (WebP, ou JPEG si le navigateur ne sait pas). */
export async function squarePortrait(file: File): Promise<string> {
	const url = URL.createObjectURL(file);
	try {
		const img = await new Promise<HTMLImageElement>((resolve, reject) => {
			const el = new Image();
			el.onload = () => resolve(el);
			el.onerror = () => reject(new Error('image illisible'));
			el.src = url;
		});
		const side = Math.min(img.naturalWidth, img.naturalHeight);
		const canvas = document.createElement('canvas');
		canvas.width = SIZE;
		canvas.height = SIZE;
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('canvas indisponible');
		// Un portrait a souvent la tête en haut : on cadre un peu au-dessus du centre.
		const sx = (img.naturalWidth - side) / 2;
		const sy = Math.max(0, (img.naturalHeight - side) * 0.3);
		ctx.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE);
		const webp = canvas.toDataURL('image/webp', 0.85);
		return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.88);
	} finally {
		URL.revokeObjectURL(url);
	}
}

interface Props {
	/** Une image personnalisée est déjà en place (affiche « Remettre le portrait de classe »). */
	hasCustom: boolean;
	onPick: (dataUrl: string) => void | Promise<void>;
	onReset: () => void | Promise<void>;
	busy?: boolean;
}

/** Boutons « Choisir une image » / « Remettre le portrait de classe ». */
export function PortraitPicker({ hasCustom, onPick, onReset, busy = false }: Props) {
	const input = useRef<HTMLInputElement>(null);
	const [error, setError] = useState<string | null>(null);
	const [working, setWorking] = useState(false);

	const onFile = async (file: File | undefined) => {
		if (!file) return;
		setError(null);
		if (!file.type.startsWith('image/')) {
			setError('Il faut choisir une image.');
			return;
		}
		setWorking(true);
		try {
			await onPick(await squarePortrait(file));
		} catch {
			setError('Cette image ne peut pas être lue. Essaie une photo en JPEG ou en PNG.');
		} finally {
			setWorking(false);
			if (input.current) input.current.value = '';
		}
	};

	return (
		<div className="portrait-picker">
			<input ref={input} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
			<button type="button" className="btn btn--small btn--ghost" disabled={busy || working} onClick={() => input.current?.click()}>
				🖼️ {working ? 'Préparation…' : hasCustom ? 'Changer l’image' : 'Choisir une autre image'}
			</button>
			{hasCustom ? (
				<button type="button" className="btn btn--small btn--ghost" disabled={busy || working} onClick={() => onReset()}>
					Remettre le portrait de classe
				</button>
			) : null}
			{error ? <p className="form-error">{error}</p> : null}
		</div>
	);
}
