'use server';

import { redirect } from 'next/navigation';
import { createUser, endSession, findUserByEmail, startSession, verifyCredentials } from '@/lib/auth';

export interface FormState {
	error?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signupAction(_prev: FormState, form: FormData): Promise<FormState> {
	const email = String(form.get('email') ?? '').trim().toLowerCase();
	const displayName = String(form.get('displayName') ?? '').trim();
	const password = String(form.get('password') ?? '');

	if (!EMAIL_RE.test(email)) return { error: 'Cette adresse e-mail ne semble pas valide.' };
	if (displayName.length < 2) return { error: 'Choisissez un nom de table d’au moins 2 lettres.' };
	if (password.length < 8) return { error: 'Le mot de passe doit faire au moins 8 caractères.' };
	if (findUserByEmail(email)) return { error: 'Un compte existe déjà avec cette adresse.' };

	const user = createUser(email, displayName, password);
	startSession(user.id);
	redirect('/portail');
}

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
	const email = String(form.get('email') ?? '').trim().toLowerCase();
	const password = String(form.get('password') ?? '');
	const user = verifyCredentials(email, password);
	if (!user) return { error: 'E-mail ou mot de passe incorrect.' };
	startSession(user.id);
	redirect('/portail');
}

export async function logoutAction() {
	endSession();
	redirect('/');
}
