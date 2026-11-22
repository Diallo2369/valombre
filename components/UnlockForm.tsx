'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { unlockCodeAction } from '@/app/actions/game';

function Submit() {
	const { pending } = useFormStatus();
	return (
		<button type="submit" className="btn btn--ghost" disabled={pending}>
			Débloquer
		</button>
	);
}

export function UnlockForm() {
	const [state, action] = useFormState(unlockCodeAction, {} as { ok?: boolean; message?: string });
	return (
		<form action={action} className="unlock">
			<label className="field__label" htmlFor="code">
				Vous avez un code de campagne ?
			</label>
			<div className="unlock__row">
				<input id="code" name="code" className="field__input" placeholder="XXXX-XX-XXXX" autoComplete="off" />
				<Submit />
			</div>
			{state.message ? (
				<p className={state.ok ? 'form-success' : 'form-error'} role="status">
					{state.message}
				</p>
			) : null}
		</form>
	);
}
