import type { MediaMap } from '@/lib/media-types';

interface Props {
	media: MediaMap;
	image?: string;
	video?: string;
	alt: string;
	className?: string;
	/** Texte affiché si aucun fichier n'est encore généré. */
	placeholder?: string;
}

/** Vidéo si elle existe, sinon image, sinon un fond de brume animé. */
export function MediaView({ media, image, video, alt, className, placeholder }: Props) {
	const videoUrl = video ? media[video] : undefined;
	const imageUrl = image ? media[image] : undefined;
	const cls = ['media-view', className].filter(Boolean).join(' ');

	if (videoUrl) {
		return (
			<div className={cls}>
				<video
					key={videoUrl}
					className="media-view__el"
					src={videoUrl}
					poster={imageUrl}
					autoPlay
					muted
					loop
					playsInline
					aria-label={alt}
				/>
			</div>
		);
	}
	if (imageUrl) {
		return (
			<div className={cls}>
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img key={imageUrl} className="media-view__el" src={imageUrl} alt={alt} />
			</div>
		);
	}
	return (
		<div className={cls}>
			<div className="media-placeholder" role="img" aria-label={alt}>
				{placeholder ? <span className="media-placeholder__label">{placeholder}</span> : null}
			</div>
		</div>
	);
}
