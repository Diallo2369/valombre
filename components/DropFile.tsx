'use client';

import { useRouter } from 'next/navigation';
import { useId, useRef, useState } from 'react';
import type { MediaType } from '@/engine/types';

const ACCEPT: Record<MediaType, string> = {
	image: 'image/webp,image/jpeg,image/png',
	video: 'video/mp4,video/webm',
	music: 'audio/*',
	ambience: 'audio/*',
	sfx: 'audio/*',
};

/** Zone de dépôt d'un fichier généré (ChatGPT…) : glisser-déposer ou choisir, enregistré sous le bon nom. */
export function DropFile({ collection, id, type, present }: { collection: string; id: string; type: MediaType; present: boolean }) {
	const router = useRouter();
	const input = useRef<HTMLInputElement>(null);
	const inputId = useId();
	const [over, setOver] = useState(false);
	const [status, setStatus] = useState<{ tone: 'busy' | 'ok' | 'error'; text: string } | null>(null);

	const send = async (file: File | undefined) => {
		if (!file) return;
		setStatus({ tone: 'busy', text: `Envoi de ${file.name}…` });
		const body = new FormData();
		body.set('collection', collection);
		body.set('id', id);
		body.set('file', file);
		try {
			const res = await fetch('/atelier/depot', { method: 'POST', body });
			const data = (await res.json()) as { ok?: boolean; error?: string; file?: string };
			if (!res.ok || !data.ok) throw new Error(data.error ?? 'Envoi impossible.');
			setStatus({ tone: 'ok', text: `✓ Enregistré : ${data.file}` });
			router.refresh();
		} catch (e) {
			setStatus({ tone: 'error', text: e instanceof Error ? e.message : 'Envoi impossible.' });
		}
	};

	return (
		<div
			className={`drop${over ? ' is-over' : ''}`}
			onDragOver={(e) => {
				e.preventDefault();
				setOver(true);
			}}
			onDragLeave={() => setOver(false)}
			onDrop={(e) => {
				e.preventDefault();
				setOver(false);
				void send(e.dataTransfer.files[0]);
			}}
		>
			<input ref={input} id={inputId} type="file" accept={ACCEPT[type]} className="drop__input" onChange={(e) => void send(e.target.files?.[0])} />
			<label htmlFor={inputId} className="btn btn--small btn--ghost">
				{present ? '↻ Remplacer le fichier' : '⬆ Déposer le fichier'}
			</label>
			<span className="drop__hint">ou glissez-le ici</span>
			<p className={`drop__status${status ? ` is-${status.tone}` : ''}`} role="status" aria-live="polite">
				{status?.text}
			</p>
		</div>
	);
}
