import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { PodcastData, data } from './podcast-data';

const title = 'The Nx Enterprise Software Podcast';
const description = 'A thoughtful discussion on building Enterprise Software.';

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    url: 'https://nx.dev/podcast',
    title,
    description,
    images: [
      {
        url: 'https://nx.dev/socials/nx-media.png',
        width: 800,
        height: 421,
        alt: description,
        type: 'image/jpeg',
      },
    ],
    siteName: 'NxDev',
    type: 'website',
  },
};

export default function PodcastIndex() {
  const [latestEpisode, ...rest] = data;

  return (
    <>
      <main id="main" role="main" className="w-full py-8">
        <div className="mx-auto mb-8 w-full max-w-[1088px] px-8">
          <header className="mx-auto mb-16">
            <h1
              id="blog-title"
              className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl dark:text-slate-100"
            >
              The Enterprise Software Podcast
            </h1>
            <h2 className="text-lg tracking-tight text-slate-900 md:text-xl dark:text-slate-100">
              A thoughtful discussion on building Enterprise Software.
            </h2>
          </header>
          <LatestEpisode episode={latestEpisode} />
          <FullList episodes={data} />
        </div>
      </main>
    </>
  );
}

function LatestEpisode({ episode }: { episode: PodcastData }) {
  return (
    <Link href={`/podcast/${episode.slug}`}>
      <article>
        <div className="w-full px-2">
          <div className="m-2 flex justify-between rounded-lg bg-gray-100 bg-gray-800 p-2">
            <div>
              <h2 className="text-lg font-medium text-black dark:text-white">
                Latest Episode:
              </h2>
              <h3 className="mt-12 text-3xl leading-tight text-black md:text-4xl dark:text-white">
                {episode.title}
              </h3>
              <div className="mt-6 text-xl font-medium text-slate-500">
                {episode.duration}
              </div>
            </div>
            <Image
              height="256"
              width="204"
              src={episode.squareImageUrl}
              alt={episode.title}
              className="hidden rounded-xl md:block"
            />
          </div>
        </div>
      </article>
    </Link>
  );
}

function FullList({ episodes }: { episodes: PodcastData[] }) {
  return (
    <>
      <div className="mx-auto mb-8 mt-20 border-b-2 border-slate-300 pb-3 text-sm dark:border-slate-700">
        <h2 className="font-semibold">All episodes:</h2>
      </div>
      <div className="mx-auto">
        {episodes?.map((episode) => {
          const formattedDate = episode.date.toLocaleDateString('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
          });
          return (
            <Link
              href={`/podcast/${episode.slug}`}
              key={episode.slug}
              className="relative flex items-center gap-6 border-b border-slate-200 py-5 text-sm before:absolute before:inset-x-[-16px] before:inset-y-[-2px] before:z-[-1] before:rounded-xl before:bg-slate-200 before:opacity-0 last:border-0 before:hover:opacity-100 dark:border-slate-800 dark:before:bg-slate-800/50"
            >
              <span className="w-1/2 flex-none text-balance font-medium text-slate-500 sm:w-5/12 dark:text-white">
                {episode.title}
              </span>
              <span className="hidden w-2/12 flex-none sm:inline-block">
                {formattedDate}
              </span>
              <span className="hidden flex-1 overflow-hidden sm:inline-block">
                {episode.duration}
              </span>
              <span className="hidden flex-1 overflow-hidden sm:inline-block">
                <Image
                  alt={episode.title}
                  title={episode.title}
                  width="48"
                  height="48"
                  src={episode.squareImageUrl}
                />
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
