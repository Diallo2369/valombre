import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * Base SQLite locale (module natif de Node ≥ 22.13, aucune dépendance).
 * Fichier : data/valombre.db (ou VALOMBRE_DB).
 * Pour un hébergement sans disque persistant, il suffira de remplacer ce fichier
 * par un client Postgres/Turso en gardant les mêmes fonctions dans lib/repo.ts.
 */

const DB_PATH = process.env.VALOMBRE_DB ?? path.join(process.cwd(), 'data', 'valombre.db');

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
	id TEXT PRIMARY KEY,
	email TEXT NOT NULL UNIQUE,
	display_name TEXT NOT NULL,
	password_hash TEXT NOT NULL,
	created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
	token TEXT PRIMARY KEY,
	user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS unlocks (
	user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	campaign_id TEXT NOT NULL,
	unlocked_at INTEGER NOT NULL,
	PRIMARY KEY (user_id, campaign_id)
);

CREATE TABLE IF NOT EXISTS characters (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	data TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS adventures (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	campaign_id TEXT NOT NULL,
	name TEXT NOT NULL,
	party TEXT NOT NULL,
	state TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

-- Ce que le compte a déjà vu ou fait (le tutoriel du premier combat…).
CREATE TABLE IF NOT EXISTS user_flags (
	user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	flag TEXT NOT NULL,
	set_at INTEGER NOT NULL,
	PRIMARY KEY (user_id, flag)
);

CREATE INDEX IF NOT EXISTS adventures_user ON adventures(user_id);
CREATE INDEX IF NOT EXISTS characters_user ON characters(user_id);
`;

const globalForDb = globalThis as unknown as { __valombreDb?: DatabaseSync; __valombreSchema?: boolean };

/**
 * Le schéma à jour, même sur une connexion ouverte avant qu'on l'ait enrichi (serveur de dev qui tourne déjà) :
 * il ne fait qu'ajouter ce qui manque (CREATE … IF NOT EXISTS).
 */
export function ensureSchema() {
	if (globalForDb.__valombreSchema) return;
	db().exec(SCHEMA);
	globalForDb.__valombreSchema = true;
}

export function db(): DatabaseSync {
	if (!globalForDb.__valombreDb) {
		fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
		const database = new DatabaseSync(DB_PATH);
		database.exec(SCHEMA);
		globalForDb.__valombreDb = database;
	}
	return globalForDb.__valombreDb;
}
