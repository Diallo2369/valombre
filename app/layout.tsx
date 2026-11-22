import type { Metadata, Viewport } from 'next';
import { Alegreya, Cinzel } from 'next/font/google';
import { COMMON_MEDIA } from '@/campaigns';
import { SiteMusic } from '@/components/SiteMusic';
import { scanMedia } from '@/lib/media';
import { mediaVariants } from '@/lib/media-types';
import '@/styles/globals.scss';

const cinzel = Cinzel({ subsets: ['latin'], weight: ['500', '700'], variable: '--font-cinzel', display: 'swap' });
const alegreya = Alegreya({ subsets: ['latin'], weight: ['400', '500', '700'], style: ['normal', 'italic'], variable: '--font-alegreya', display: 'swap' });

export const metadata: Metadata = {
	title: { default: 'Valombre — Contes à lancer de dés', template: '%s · Valombre' },
	description: 'Un jeu de rôle familial : créez vos héros aux dés, écoutez les personnages et partez à l’aventure ensemble.',
};

export const viewport: Viewport = { themeColor: '#0d111b' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="fr" className={`${cinzel.variable} ${alegreya.variable}`}>
			<body>
				{children}
				<SiteMusic urls={mediaVariants(scanMedia('commun', COMMON_MEDIA), 'mus-portail')} />
			</body>
		</html>
	);
}
