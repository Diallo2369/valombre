/** @type {import('next').NextConfig} */
const nextConfig = {
	distDir: process.env.NEXT_DIST_DIR || '.next',
	webpack: (config, { isServer }) => {
		// node:sqlite est un module natif de Node 22 : on le laisse hors du bundle serveur.
		if (isServer) config.externals.push({ 'node:sqlite': 'commonjs node:sqlite' });
		return config;
	},
};

export default nextConfig;
