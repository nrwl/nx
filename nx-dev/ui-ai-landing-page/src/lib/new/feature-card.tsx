import { ReactElement, ReactNode } from 'react';
import Image from 'next/image';
import { PlayButton } from './play-button';

type VideoFeature = {
  type: 'video';
  videoUrl: string;
  onPlayClick?: (videoUrl: string) => void;
};

type LinkFeature = {
  type?: 'link';
  videoUrl?: never;
  onPlayClick?: never;
};

interface BaseFeatureCardProps {
  isAvailable: boolean;
  id: string;
  title: string;
  subtitle: string;
  description: ReactNode;
  imageUrl: string;
}

export type FeatureCardProps = BaseFeatureCardProps &
  (VideoFeature | LinkFeature);

export function FeatureCard({
  isAvailable,
  id,
  title,
  subtitle,
  description,
  type = 'link',
  imageUrl,
  videoUrl,
  onPlayClick,
}: FeatureCardProps): ReactElement {
  const handlePlayClick = () => {
    if (type === 'video' && videoUrl && onPlayClick) {
      onPlayClick(videoUrl);
    } else if (type === 'video' && !videoUrl) {
      console.warn(
        `Video type specified for ${title} but no videoUrl provided`
      );
    }
  };

  return (
    <div key={id} className="flex flex-col">
      <dt className="text-base/7 font-semibold">
        <div className="relative mb-6 aspect-video max-h-52 w-full overflow-hidden rounded-xl bg-slate-200 dark:bg-slate-700/60">
          <Image
            src={imageUrl}
            alt={`Thumbnail for ${title}`}
            width={1280}
            height={720}
            loading="lazy"
            unoptimized
          />
          {type === 'video' && videoUrl && onPlayClick ? (
            <div className="absolute inset-0 grid h-full w-full items-center justify-center">
              <PlayButton onClick={handlePlayClick} />
            </div>
          ) : null}

          {!isAvailable && (
            <span className="absolute bottom-2 right-2 inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/30">
              Coming soon
            </span>
          )}
        </div>
        {title}
        <div className="text-xs/7 font-normal italic opacity-80">
          {subtitle}
        </div>
      </dt>
      <dd className="mt-1 flex flex-auto flex-col text-base/7">
        {description}
      </dd>
    </div>
  );
}
