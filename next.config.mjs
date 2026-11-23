/** @type {import('next').NextConfig} */
const nextConfig = {
	distDir: process.env.NEXT_DIST_DIR || '.next',
	// Les portraits choisis à la création voyagent avec le groupe (≈ 100 Ko par héros, jusqu'à 6 héros).
	experimental: { serverActions: { bodySizeLimit: '4mb' } },
	webpack: (config, { isServer }) => {
		// node:sqlite est un module natif de Node 22 : on le laisse hors du bundle serveur.
		if (isServer) config.externals.push({ 'node:sqlite': 'commonjs node:sqlite' });
		return config;
	},
};

export default nextConfig;
