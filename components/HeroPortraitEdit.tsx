'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { setPortraitAction } from '@/app/actions/game';
import type { Character } from '@/engine/types';
import { PortraitPicker } from './PortraitPicker';

/** Au portail : changer l'image d'un héros, ou remettre le portrait de sa classe. */
export function HeroPortraitEdit({ hero }: { hero: Character }) {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();
	const save = (dataUrl: string | null) =>
		startTransition(async () => {
			const res = await setPortraitAction(hero.id, dataUrl);
			setError(res.error ?? null);
			router.refresh();
		});
	return (
		<>
			<PortraitPicker hasCustom={Boolean(hero.portrait)} busy={pending} onPick={(d) => save(d)} onReset={() => save(null)} />
			{error ? <p className="form-error">{error}</p> : null}
		</>
	);
}
