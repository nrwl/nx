import { PodcastDataEntry } from '@nx/nx-dev/data-access-documents/node-only';
import { PodcastListItem } from './podcast-list-item';

export interface PodcastListProps {
  podcasts: PodcastDataEntry[];
}

export function PodcastList({ podcasts }: PodcastListProps): JSX.Element {
  return podcasts.length < 1 ? (
    <div>
      <h2 className="mt-32 text-center text-xl font-semibold text-slate-500 sm:text-2xl xl:mb-24 dark:text-white ">
        No podcasts as yet but stay tuned!
      </h2>
    </div>
  ) : (
    <div className="mx-auto max-w-7xl px-8">
      <div className="mb-8 mt-20 border-b-2 border-slate-300 pb-3 text-sm dark:border-slate-700">
        <h2 className="font-semibold">Podcasts</h2>
      </div>
      <div>
        {podcasts?.map((post, index) => (
          <PodcastListItem key={post.slug} podcast={post} episode={index + 1} />
        ))}
      </div>
    </div>
  );
}
