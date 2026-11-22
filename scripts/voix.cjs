#!/usr/bin/env node
/* eslint-disable */
/**
 * Génération des voix avec l'API ElevenLabs.
 *
 *   npm run voix -- etat                       crédits restants, voix créées, répliques à faire
 *   npm run voix -- casting [pnj…]             3 essais de voix par personnage (d'après sa fiche de casting)
 *   npm run voix -- choisir <pnj> <n>          garde l'essai n comme voix définitive du personnage
 *   npm run voix -- attribuer <pnj> <voice_id> utilise une voix choisie dans la bibliothèque ElevenLabs
 *   npm run voix -- adopter <pnj> <n>          adopte le candidat n de data/voix-bibliotheque/<pnj>/ (bibliothèque ElevenLabs)
 *   npm run voix -- generer [options]          génère les répliques manquantes ou périmées
 *        --pnj berthe,tilo   seulement ces personnages
 *        --max 10            s'arrêter après 10 répliques (pour un essai)
 *        --refaire id1,id2   régénérer ces répliques même si elles existent
 *   npm run voix -- son <id> [--essais 2] [--duree 120]
 *                                             essais d'une musique, ambiance ou bruitage de l'atelier → data/essais-sons/<id>/
 *   npm run voix -- garder <id> <n> [<n2>…]   installe l'essai n dans public/medias/… (plusieurs : joués à la suite)
 *   Option commune : --campagne <id> (par défaut brumes-de-valombre)
 *
 * Clé : variable ELEVENLABS_API_KEY, ou ligne ELEVENLABS_API_KEY=… dans .env.local (jamais commitée).
 * Réglages et identifiants des voix : campaigns/<campagne>/voix.json
 * Essais de casting : data/voix-essais/<campagne>/<pnj>/essai-<n>.mp3
 * Répliques : public/medias/<campagne>/voix/<id>.mp3 + manifest.json (empreinte du texte enregistré)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const API = 'api.elevenlabs.io';

/* ------------------------------------------------------------------ */
/* Arguments                                                            */
/* ------------------------------------------------------------------ */

const argv = process.argv.slice(2);
const command = argv[0];
const positional = [];
const opts = {};
for (let i = 1; i < argv.length; i++) {
	if (argv[i].startsWith('--')) opts[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
	else positional.push(argv[i]);
}
const CAMPAIGN_ID = opts.campagne || 'brumes-de-valombre';
const list = (v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

/* ------------------------------------------------------------------ */
/* Chargement du scénario (TypeScript transpilé à la volée)            */
/* ------------------------------------------------------------------ */

function loadProject() {
	const ts = require(path.join(ROOT, 'node_modules', 'typescript'));
	const out = fs.mkdtempSync(path.join(os.tmpdir(), 'valombre-voix-'));
	const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
	for (const dir of ['engine', 'campaigns']) {
		for (const f of walk(path.join(ROOT, dir)).filter((f) => f.endsWith('.ts'))) {
			const rel = path.relative(ROOT, f);
			const up = '../'.repeat(rel.split(path.sep).length - 1) || './';
			const src = fs.readFileSync(f, 'utf8').replace(/from '@\/([^']+)'/g, (_, p) => `from '${up}${p}'`);
			const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
			const dest = path.join(out, rel.replace(/\.ts$/, '.js'));
			fs.mkdirSync(path.dirname(dest), { recursive: true });
			fs.writeFileSync(dest, js);
		}
	}
	const { getCampaign } = require(path.join(out, 'campaigns', 'index.js'));
	const voices = require(path.join(out, 'engine', 'voices.js'));
	const { VOICE_DIRECTION, COMMON_MEDIA, COMMON_STYLE } = require(path.join(out, 'campaigns', 'commun', 'media.js'));
	fs.rmSync(out, { recursive: true, force: true });
	const campaign = getCampaign(CAMPAIGN_ID);
	if (!campaign) fail(`Campagne inconnue : ${CAMPAIGN_ID}`);
	return { campaign, voices, VOICE_DIRECTION, COMMON_MEDIA, COMMON_STYLE };
}

/* ------------------------------------------------------------------ */
/* Fichiers                                                             */
/* ------------------------------------------------------------------ */

const CONFIG_FILE = path.join(ROOT, 'campaigns', CAMPAIGN_ID, 'voix.json');
const VOICE_DIR = path.join(ROOT, 'public', 'medias', CAMPAIGN_ID, 'voix');
const MANIFEST_FILE = path.join(VOICE_DIR, 'manifest.json');
const TRIALS_DIR = path.join(ROOT, 'data', 'voix-essais', CAMPAIGN_ID);

const DEFAULT_CONFIG = {
	model: 'eleven_v4',
	designModel: 'eleven_ttv_v3',
	outputFormat: 'mp3_44100_128',
	settings: { stability: 0.5, similarity_boost: 0.75, style: 0.25, use_speaker_boost: true, speed: 1 },
	/** Réglages propres à un personnage, fusionnés avec `settings`. */
	perNpc: {},
	/** pnj → voice_id ElevenLabs. */
	voices: {},
};

const readJson = (file, fallback) => {
	try {
		return JSON.parse(fs.readFileSync(file, 'utf8'));
	} catch {
		return fallback;
	}
};
const writeJson = (file, data) => {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file + '.tmp', JSON.stringify(data, null, '\t') + '\n');
	fs.renameSync(file + '.tmp', file);
};
const loadConfig = () => {
	const c = readJson(CONFIG_FILE, {});
	return { ...DEFAULT_CONFIG, ...c, settings: { ...DEFAULT_CONFIG.settings, ...c.settings }, perNpc: c.perNpc || {}, voices: c.voices || {} };
};

function apiKey() {
	if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim();
	const envFile = path.join(ROOT, '.env.local');
	const env = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
	const m = env.match(/^\s*ELEVENLABS_API_KEY\s*=\s*["']?([^"'\s]+)/m);
	if (!m) fail('Clé absente : ajoutez la ligne ELEVENLABS_API_KEY=… dans valombre/.env.local');
	return m[1];
}

/* ------------------------------------------------------------------ */
/* Appels HTTP                                                          */
/* ------------------------------------------------------------------ */

class ApiError extends Error {
	constructor(status, body) {
		super(`HTTP ${status} : ${body.slice(0, 400)}`);
		this.status = status;
	}
}

function request(method, pathname, body, key) {
	return new Promise((resolve, reject) => {
		const data = body ? Buffer.from(JSON.stringify(body)) : null;
		const req = https.request(
			{
				host: API,
				path: pathname,
				method,
				headers: { 'xi-api-key': key, Accept: '*/*', ...(data ? { 'Content-Type': 'application/json', 'Content-Length': data.length } : {}) },
				timeout: 120000,
			},
			(res) => {
				const chunks = [];
				res.on('data', (c) => chunks.push(c));
				res.on('end', () => {
					const buf = Buffer.concat(chunks);
					if (res.statusCode >= 200 && res.statusCode < 300) resolve(buf);
					else reject(new ApiError(res.statusCode, buf.toString('utf8')));
				});
			},
		);
		req.on('timeout', () => req.destroy(new Error('délai dépassé')));
		req.on('error', reject);
		if (data) req.write(data);
		req.end();
	});
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Réessaie sur les erreurs passagères (file d'attente pleine, serveur occupé, réseau). */
async function withRetry(fn) {
	for (let attempt = 1; ; attempt++) {
		try {
			return await fn();
		} catch (e) {
			const transient = !(e instanceof ApiError) || e.status === 429 || e.status === 409 || e.status >= 500;
			if (!transient || attempt >= 5) throw e;
			await sleep(1500 * 2 ** (attempt - 1));
		}
	}
}

const json = (buf) => JSON.parse(buf.toString('utf8'));

/** Crédits restants, ou un nombre infini si la clé n'a pas le droit « Utilisateur : lire ». */
async function credits(key) {
	let s;
	try {
		s = json(await request('GET', '/v1/user/subscription', null, key));
	} catch (e) {
		if (e instanceof ApiError && e.status === 401 && /user_read/.test(e.message)) {
			if (!credits.warned) console.log('ℹ La clé ne peut pas lire les crédits (droit « Utilisateur : lire ») : pas de contrôle avant génération.');
			credits.warned = true;
			return { tier: '?', used: 0, limit: Infinity, left: Infinity };
		}
		throw e;
	}
	return { tier: s.tier, used: s.character_count, limit: s.character_limit, left: s.character_limit - s.character_count, reset: s.next_character_count_reset_unix };
}

/* ------------------------------------------------------------------ */
/* Outils                                                               */
/* ------------------------------------------------------------------ */

function fail(msg) {
	console.error(`\n✗ ${msg}\n`);
	process.exit(1);
}

const spoken = (t) => t.replace(/[«»]/g, '').replace(/\s+/g, ' ').trim();

/** Répliques à faire, avec la réplique précédente et suivante de la même scène (pour l'intonation). */
function plan(campaign, voices, manifest, { only, redo, config }) {
	const lines = voices.voiceLines(campaign);
	const files = fs.existsSync(VOICE_DIR) ? fs.readdirSync(VOICE_DIR) : [];
	const exists = (id) => files.some((f) => f.startsWith(id + '.') && f !== 'manifest.json');
	return lines
		.map((l, i) => {
			const prev = lines[i - 1] && lines[i - 1].sceneId === l.sceneId ? lines[i - 1] : null;
			const next = lines[i + 1] && lines[i + 1].sceneId === l.sceneId ? lines[i + 1] : null;
			const hash = voices.voiceHash(l.who, l.text);
			const m = manifest[l.id];
			let reason = null;
			if (redo.includes(l.id)) reason = 'demandée';
			else if (!exists(l.id)) reason = 'manquante';
			else if (m && m.hash !== hash) reason = 'texte modifié';
			else if (m && config.voices[l.who] && m.voice !== config.voices[l.who]) reason = 'nouvelle voix';
			return { ...l, hash, prev, next, reason };
		})
		.filter((l) => l.reason && (!only.length || only.includes(l.who)));
}

/* ------------------------------------------------------------------ */
/* Commandes                                                            */
/* ------------------------------------------------------------------ */

async function cmdEtat() {
	const { campaign, voices } = loadProject();
	const config = loadConfig();
	const manifest = readJson(MANIFEST_FILE, {});
	const todo = plan(campaign, voices, manifest, { only: [], redo: [], config });
	const all = voices.voiceLines(campaign);
	console.log(`\n${campaign.title} — ${all.length} répliques, ${all.length - todo.length} prêtes, ${todo.length} à faire (${todo.reduce((a, l) => a + spoken(l.text).length, 0)} caractères).`);
	console.log('\nVoix des personnages :');
	for (const npc of Object.values(campaign.npcs)) {
		const n = all.filter((l) => l.who === npc.id).length;
		if (!n) continue;
		const trials = fs.existsSync(path.join(TRIALS_DIR, npc.id)) ? fs.readdirSync(path.join(TRIALS_DIR, npc.id)).filter((f) => f.endsWith('.mp3')).length : 0;
		const state = config.voices[npc.id] ? '✓ voix choisie' : trials ? `${trials} essais à écouter` : '— pas encore de voix';
		console.log(`  ${npc.id.padEnd(11)} ${String(n).padStart(3)} répliques   ${state}`);
	}
	const key = apiKey();
	const c = await credits(key);
	console.log(`\nAbonnement ${c.tier} : ${c.left} caractères restants sur ${c.limit}.\n`);
}

async function cmdCasting() {
	const { campaign, voices, VOICE_DIRECTION } = loadProject();
	const key = apiKey();
	const config = loadConfig();
	const all = voices.voiceLines(campaign);
	const targets = positional.length ? positional : Object.keys(campaign.npcs).filter((id) => !config.voices[id] && all.some((l) => l.who === id));
	if (!targets.length) return console.log('Tous les personnages ont déjà une voix. Pour en refaire une : npm run voix -- casting <pnj>');
	for (const id of targets) {
		const npc = campaign.npcs[id];
		if (!npc) fail(`Personnage inconnu : ${id}`);
		// Texte d'essai : ses propres répliques (entre 100 et 1000 caractères, imposé par l'API).
		let sample = '';
		for (const l of all.filter((x) => x.who === id)) {
			if (sample.length > 400) break;
			sample += (sample ? ' ' : '') + spoken(l.text);
		}
		sample = sample.slice(0, 950);
		const description = `${npc.casting || npc.role} Langue : français de France, accent naturel.`;
		process.stdout.write(`🎙  ${npc.name}… `);
		const res = json(
			await withRetry(() =>
				request(
					'POST',
					`/v1/text-to-voice/design?output_format=mp3_44100_128`,
					{
						voice_description: description,
						model_id: config.designModel,
						...(sample.length >= 100 ? { text: sample } : { auto_generate_text: true }),
					},
					key,
				),
			),
		);
		const dir = path.join(TRIALS_DIR, id);
		// Les essais s'ajoutent à la suite des précédents (numéros jamais réutilisés : pas de confusion à l'écoute).
		fs.mkdirSync(dir, { recursive: true });
		const prev = readJson(path.join(dir, 'essais.json'), { previews: [] });
		const first = prev.previews.reduce((m, p) => Math.max(m, p.n), 0) + 1;
		const fresh = res.previews.map((p, i) => ({ n: first + i, generated_voice_id: p.generated_voice_id, description }));
		res.previews.forEach((p, i) => fs.writeFileSync(path.join(dir, `essai-${first + i}.mp3`), Buffer.from(p.audio_base_64, 'base64')));
		writeJson(path.join(dir, 'essais.json'), { description, text: res.text, previews: [...prev.previews.map((p) => ({ description: prev.description, ...p })), ...fresh] });
		console.log(`essais ${first} à ${first + fresh.length - 1} → ${path.relative(ROOT, dir)}/`);
	}
	console.log('\nÉcoutez les essais, puis : npm run voix -- choisir <pnj> <numéro>\n');
}

async function cmdChoisir() {
	const [id, n] = positional;
	if (!id || !n) fail('Usage : npm run voix -- choisir <pnj> <numéro>');
	const { campaign } = loadProject();
	const npc = campaign.npcs[id];
	if (!npc) fail(`Personnage inconnu : ${id}`);
	const trials = readJson(path.join(TRIALS_DIR, id, 'essais.json'), null);
	if (!trials) fail(`Pas d'essais pour ${id} : lancez d'abord npm run voix -- casting ${id}`);
	const pick = trials.previews.find((p) => p.n === Number(n));
	if (!pick) fail(`Essai ${n} introuvable (essais disponibles : ${trials.previews.map((p) => p.n).join(', ')})`);
	const key = apiKey();
	const res = json(
		await withRetry(() =>
			request(
				'POST',
				'/v1/text-to-voice',
				{
					voice_name: `Valombre — ${npc.name}`,
					voice_description: (pick.description || trials.description).slice(0, 1000),
					generated_voice_id: pick.generated_voice_id,
					played_not_selected_voice_ids: trials.previews.filter((p) => p !== pick).map((p) => p.generated_voice_id),
					labels: { projet: 'valombre', personnage: id },
				},
				key,
			),
		),
	);
	const config = loadConfig();
	const previous = config.voices[id];
	config.voices[id] = res.voice_id;
	writeJson(CONFIG_FILE, config);
	console.log(`✓ ${npc.name} : voix ${res.voice_id} enregistrée dans ${path.relative(ROOT, CONFIG_FILE)}`);
	if (previous && previous !== res.voice_id) console.log('  Les répliques faites avec l’ancienne voix seront refaites au prochain « generer ».');
}

async function cmdAttribuer() {
	const [id, voiceId] = positional;
	if (!id || !voiceId) fail('Usage : npm run voix -- attribuer <pnj> <voice_id>');
	const { campaign } = loadProject();
	const npc = campaign.npcs[id];
	if (!npc) fail(`Personnage inconnu : ${id} (${Object.keys(campaign.npcs).join(', ')})`);
	const key = apiKey();
	try {
		const v = json(await request('GET', `/v1/voices/${encodeURIComponent(voiceId)}`, null, key));
		console.log(`Voix trouvée : « ${v.name} »`);
	} catch (e) {
		if (e instanceof ApiError && (e.status === 404 || e.status === 400)) fail(`Voix ${voiceId} introuvable : ajoutez-la d'abord à « Mes voix » sur ElevenLabs.`);
		console.log(`ℹ Vérification impossible (${e.message.slice(0, 80)}…) : la voix est enregistrée quand même.`);
	}
	const config = loadConfig();
	const previous = config.voices[id];
	config.voices[id] = voiceId;
	writeJson(CONFIG_FILE, config);
	console.log(`✓ ${npc.name} → ${voiceId}`);
	if (previous && previous !== voiceId) console.log('  Les répliques faites avec l’ancienne voix seront refaites au prochain « generer ».');
}

async function cmdAdopter() {
	const [id, n] = positional;
	if (!id || !n) fail('Usage : npm run voix -- adopter <pnj> <numéro>');
	const index = readJson(path.join(ROOT, 'data', 'voix-bibliotheque', 'candidats.json'), {});
	const c = (index[id] || []).find((x) => x.n === Number(n));
	if (!c) fail(`Candidat ${n} introuvable pour ${id} (voir data/voix-bibliotheque/${id}/).`);
	const { campaign } = loadProject();
	const key = apiKey();
	await withRetry(() =>
		request('POST', `/v1/voices/add/${c.owner}/${c.voice_id}`, { new_name: `Valombre — ${campaign.npcs[id].name} (${c.name.split(/[-–]/)[0].trim()})` }, key),
	).catch((e) => {
		// Déjà dans « Mes voix » : pas grave.
		if (!(e instanceof ApiError && e.status === 400)) throw e;
	});
	positional.splice(0, positional.length, id, c.voice_id);
	await cmdAttribuer();
}

async function cmdGenerer() {
	const { campaign, voices } = loadProject();
	const key = apiKey();
	const config = loadConfig();
	const manifest = readJson(MANIFEST_FILE, {});
	const only = list(opts.pnj);
	const redo = list(opts.refaire);
	let todo = plan(campaign, voices, manifest, { only, redo, config });

	const noVoice = [...new Set(todo.map((l) => l.who))].filter((who) => !config.voices[who]);
	if (noVoice.length) {
		console.log(`⚠ Pas encore de voix pour : ${noVoice.join(', ')} (leurs répliques sont ignorées). → npm run voix -- casting`);
		todo = todo.filter((l) => config.voices[l.who]);
	}
	if (opts.max) todo = todo.slice(0, Number(opts.max));
	if (!todo.length) return console.log('✓ Rien à générer.');

	const chars = todo.reduce((a, l) => a + spoken(l.text).length, 0);
	const c = await credits(key);
	console.log(`${todo.length} répliques, ${chars} caractères.${Number.isFinite(c.left) ? ` Crédits restants : ${c.left}.` : ''}`);
	if (chars > c.left) fail(`Pas assez de crédits (${chars} nécessaires, ${c.left} restants). Limitez avec --pnj ou --max.`);

	fs.mkdirSync(VOICE_DIR, { recursive: true });
	const withLang = config.model !== 'eleven_multilingual_v2';
	let done = 0;
	let stop = null;
	const queue = [...todo];

	const worker = async () => {
		while (queue.length && !stop) {
			const l = queue.shift();
			const voiceId = config.voices[l.who];
			const body = {
				text: spoken(l.text),
				model_id: config.model,
				voice_settings: { ...config.settings, ...(config.perNpc[l.who] || {}) },
				...(withLang ? { language_code: 'fr' } : {}),
				...(l.prev ? { previous_text: spoken(l.prev.text) } : {}),
				...(l.next ? { next_text: spoken(l.next.text) } : {}),
			};
			try {
				const audio = await withRetry(() => request('POST', `/v1/text-to-speech/${voiceId}?output_format=${config.outputFormat}`, body, key));
				for (const f of fs.readdirSync(VOICE_DIR)) if (f.startsWith(l.id + '.')) fs.rmSync(path.join(VOICE_DIR, f));
				fs.writeFileSync(path.join(VOICE_DIR, `${l.id}.mp3`), audio);
				manifest[l.id] = { hash: l.hash, voice: voiceId, model: config.model, at: new Date().toISOString() };
				writeJson(MANIFEST_FILE, manifest);
				done++;
				console.log(`  ✓ ${String(done).padStart(3)}/${todo.length}  ${l.id}  (${l.who}${l.reason !== 'manquante' ? `, ${l.reason}` : ''})`);
			} catch (e) {
				if (e instanceof ApiError && [401, 402, 403].includes(e.status)) stop = e;
				else console.log(`  ✗ ${l.id} : ${e.message}`);
			}
		}
	};
	// 3 requêtes en parallèle : sous la limite du forfait Creator, sans engorger la file.
	await Promise.all([worker(), worker(), worker()]);
	if (stop) fail(`Arrêt : ${stop.message}`);
	const after = await credits(key).catch(() => null);
	console.log(`\n✓ ${done}/${todo.length} répliques générées.${after && Number.isFinite(after.left) ? ` Crédits restants : ${after.left}.` : ''}\n`);
}

/* ------------------------------------------------------------------ */
/* Musiques, ambiances, bruitages                                       */
/* ------------------------------------------------------------------ */

const SOUND_TRIALS_DIR = path.join(ROOT, 'data', 'essais-sons');

function findAsset(id) {
	const p = loadProject();
	const own = p.campaign.media.find((a) => a.id === id);
	if (own) return { asset: own, style: p.campaign.style, collection: p.campaign.id };
	const common = p.COMMON_MEDIA.find((a) => a.id === id);
	if (common) return { asset: common, style: p.COMMON_STYLE, collection: 'commun' };
	fail(`Média inconnu : ${id} (voir la page /atelier)`);
}

async function cmdSon() {
	const [id] = positional;
	if (!id) fail('Usage : npm run voix -- son <id> [--essais 2] [--duree 120]');
	const { asset, style } = findAsset(id);
	if (!['music', 'ambience', 'sfx'].includes(asset.type)) fail(`${id} n’est pas un son (type ${asset.type}).`);
	const key = apiKey();
	const n = Math.max(1, Math.min(4, Number(opts.essais) || 2));
	const dir = path.join(SOUND_TRIALS_DIR, id);
	fs.mkdirSync(dir, { recursive: true });
	const start = fs.readdirSync(dir).filter((f) => f.endsWith('.mp3')).length;
	for (let i = 1; i <= n; i++) {
		process.stdout.write(`🎵 ${asset.title} — essai ${start + i}… `);
		let audio;
		if (asset.type === 'music') {
			const seconds = Number(opts.duree) || 120;
			audio = await withRetry(() =>
				request(
					'POST',
					'/v1/music?output_format=mp3_44100_128',
					{
						prompt: `${asset.prompt}\n\n${style.music}`.slice(0, 2000),
						music_length_ms: Math.round(Math.max(10, Math.min(300, seconds)) * 1000),
						model_id: opts.modele || 'music_v2_5',
						force_instrumental: true,
					},
					key,
				),
			);
		} else {
			// Ambiance : boucle de 30 s (maximum de l'API) ; bruitage : durée laissée au modèle.
			audio = await withRetry(() =>
				request(
					'POST',
					'/v1/sound-generation?output_format=mp3_44100_128',
					{
						text: (asset.promptEn || `${asset.prompt} ${style[asset.type]}`).slice(0, 1000),
						model_id: opts.modele || 'eleven_text_to_sound_v2',
						...(asset.type === 'ambience' ? { loop: true, duration_seconds: 30 } : opts.duree ? { duration_seconds: Number(opts.duree) } : {}),
						prompt_influence: asset.promptEn ? 0.7 : 0.5,
					},
					key,
				),
			);
		}
		const file = path.join(dir, `essai-${start + i}.mp3`);
		fs.writeFileSync(file, audio);
		console.log(path.relative(ROOT, file));
	}
	console.log(`\nÉcoutez, puis : npm run voix -- garder ${id} <numéro>\n`);
}

/** garder <id> <n> [<n2>…] : le premier essai devient <id>.mp3, les suivants <id>-2.mp3, <id>-3.mp3… (joués à la suite). */
function cmdGarder() {
	const [id, ...picks] = positional;
	if (!id || !picks.length) fail('Usage : npm run voix -- garder <id> <numéro> [<numéro>…]');
	const { collection } = findAsset(id);
	const srcs = picks.map((n) => path.join(SOUND_TRIALS_DIR, id, `essai-${n}.mp3`));
	for (const src of srcs) if (!fs.existsSync(src)) fail(`Essai introuvable : ${path.relative(ROOT, src)}`);
	const destDir = path.join(ROOT, 'public', 'medias', collection);
	fs.mkdirSync(destDir, { recursive: true });
	const mine = new RegExp(`^${id.replace(/[-]/g, '\\-')}(-[2-9])?\\.[a-z0-9]+$`);
	for (const f of fs.readdirSync(destDir)) if (mine.test(f)) fs.rmSync(path.join(destDir, f));
	srcs.forEach((src, i) => {
		const name = i === 0 ? `${id}.mp3` : `${id}-${i + 1}.mp3`;
		fs.copyFileSync(src, path.join(destDir, name));
		console.log(`✓ public/medias/${collection}/${name}  (essai ${picks[i]})`);
	});
}

const COMMANDS = { etat: cmdEtat, casting: cmdCasting, choisir: cmdChoisir, attribuer: cmdAttribuer, adopter: cmdAdopter, generer: cmdGenerer, son: cmdSon, garder: async () => cmdGarder() };
if (!COMMANDS[command]) {
	const src = fs.readFileSync(__filename, 'utf8');
	console.log(src.slice(src.indexOf('/**') + 3, src.indexOf('*/', src.indexOf('/**'))).replace(/^ \* ?/gm, ''));
	process.exit(command ? 1 : 0);
}
COMMANDS[command]().catch((e) => fail(e.message));
