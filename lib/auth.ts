import 'server-only';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from './db';
import { newId } from './ids';

export const SESSION_COOKIE = 'valombre_session';
const SESSION_DAYS = 60;

export interface User {
	id: string;
	email: string;
	displayName: string;
}

/* ---- Mots de passe (scrypt natif, pas de dépendance) ---- */

export function hashPassword(password: string): string {
	const salt = randomBytes(16).toString('hex');
	const hash = scryptSync(password, salt, 64).toString('hex');
	return `${salt}:${hash}`;
}

function checkPassword(password: string, stored: string): boolean {
	const [salt, hash] = stored.split(':');
	if (!salt || !hash) return false;
	const candidate = scryptSync(password, salt, 64);
	const expected = Buffer.from(hash, 'hex');
	return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

/* ---- Comptes ---- */

export function createUser(email: string, displayName: string, password: string): User {
	const id = newId('u');
	db()
		.prepare('INSERT INTO users (id, email, display_name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
		.run(id, email, displayName, hashPassword(password), Date.now());
	return { id, email, displayName };
}

export function findUserByEmail(email: string) {
	return db().prepare('SELECT id, email, display_name, password_hash FROM users WHERE email = ?').get(email) as
		| { id: string; email: string; display_name: string; password_hash: string }
		| undefined;
}

export function verifyCredentials(email: string, password: string): User | null {
	const row = findUserByEmail(email);
	if (!row || !checkPassword(password, row.password_hash)) return null;
	return { id: row.id, email: row.email, displayName: row.display_name };
}

/* ---- Sessions ---- */

export function startSession(userId: string) {
	const token = randomBytes(32).toString('hex');
	const expires = Date.now() + SESSION_DAYS * 24 * 3600 * 1000;
	db().prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expires);
	cookies().set(SESSION_COOKIE, token, {
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		path: '/',
		expires: new Date(expires),
	});
}

export function endSession() {
	const token = cookies().get(SESSION_COOKIE)?.value;
	if (token) db().prepare('DELETE FROM sessions WHERE token = ?').run(token);
	cookies().delete(SESSION_COOKIE);
}

export function currentUser(): User | null {
	const token = cookies().get(SESSION_COOKIE)?.value;
	if (!token) return null;
	const row = db()
		.prepare(
			`SELECT u.id, u.email, u.display_name, s.expires_at FROM sessions s
			 JOIN users u ON u.id = s.user_id WHERE s.token = ?`,
		)
		.get(token) as { id: string; email: string; display_name: string; expires_at: number } | undefined;
	if (!row || row.expires_at < Date.now()) return null;
	return { id: row.id, email: row.email, displayName: row.display_name };
}

export function requireUser(): User {
	const user = currentUser();
	if (!user) redirect('/connexion');
	return user;
}
