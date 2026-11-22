'use client';

import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { loginAction, signupAction, type FormState } from '@/app/actions/auth';

function Submit({ label }: { label: string }) {
	const { pending } = useFormStatus();
	return (
		<button type="submit" className="btn" disabled={pending}>
			{pending ? 'Un instant…' : label}
		</button>
	);
}

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
	const [state, action] = useFormState<FormState, FormData>(mode === 'login' ? loginAction : signupAction, {});
	return (
		<form action={action} className="card auth">
			<h1>{mode === 'login' ? 'Retour à la table' : 'Créer votre table'}</h1>
			{mode === 'signup' ? (
				<p>Un compte pour toute la famille : vos héros et vos aventures y seront sauvegardés.</p>
			) : null}
			{state.error ? (
				<p className="form-error" role="alert">
					{state.error}
				</p>
			) : null}
			{mode === 'signup' ? (
				<div className="field">
					<label className="field__label" htmlFor="displayName">
						Nom de la table
					</label>
					<input id="displayName" name="displayName" className="field__input" required placeholder="La famille Dupont" autoComplete="nickname" />
				</div>
			) : null}
			<div className="field">
				<label className="field__label" htmlFor="email">
					E-mail
				</label>
				<input id="email" name="email" type="email" className="field__input" required autoComplete="email" />
			</div>
			<div className="field">
				<label className="field__label" htmlFor="password">
					Mot de passe
				</label>
				<input
					id="password"
					name="password"
					type="password"
					className="field__input"
					required
					minLength={mode === 'signup' ? 8 : undefined}
					autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
				/>
				{mode === 'signup' ? <span className="field__hint">8 caractères minimum.</span> : null}
			</div>
			<Submit label={mode === 'login' ? 'Se connecter' : 'Créer le compte'} />
			<p className="auth__switch">
				{mode === 'login' ? (
					<>
						Pas encore de compte ? <Link href="/inscription">Créer une table</Link>
					</>
				) : (
					<>
						Déjà inscrits ? <Link href="/connexion">Se connecter</Link>
					</>
				)}
			</p>
		</form>
	);
}
