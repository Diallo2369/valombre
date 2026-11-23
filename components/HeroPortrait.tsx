import { classPortrait, className } from '@/engine/rules';
import type { Character } from '@/engine/types';
import type { MediaMap } from '@/lib/media-types';
import { MediaView } from './MediaView';

interface Props {
	character: Pick<Character, 'classId' | 'gender' | 'portrait'>;
	media: MediaMap;
	className?: string;
	alt?: string;
}

/** Portrait d'un héros : l'image choisie par le joueur s'il y en a une, sinon le portrait de sa classe. */
export function HeroPortrait({ character, media, className: cls, alt = '' }: Props) {
	if (character.portrait) {
		return (
			<div className={['media-view', cls].filter(Boolean).join(' ')}>
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img className="media-view__el" src={character.portrait} alt={alt} />
			</div>
		);
	}
	return <MediaView className={cls} media={media} image={classPortrait(character)} alt={alt} placeholder={className(character)} />;
}
