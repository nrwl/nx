import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { Metadata, ResolvingMetadata } from 'next';
import Link from 'next/link';
import {
  data,
  getNextAndPreviousEpisodes,
  getPodcastDataBySlug,
} from '../podcast-data';
import { EpisodePlayer } from './episode-player';

export async function generateStaticParams() {
  return data;
}

export function generateMetadata(
  { params: { slug } },
  parent: ResolvingMetadata
): Metadata {
  const data = getPodcastDataBySlug(slug);
  const title = `The Nx Enterprise Software Podcast | ${data.title}`;
  const description = `A thoughtful discussion on building Enterprise Software.`;
  return {
    title,
    description,
    openGraph: {
      url: `https://nx.dev/podcast/${data.slug}`,
      title,
      description,
      images: [
        {
          url: '',
          width: 500,
          height: 500,
          alt: description,
          type: 'image/jpeg',
        },
      ],
    },
  };
}

export default function PodcastEpisodePage({
  params,
}: {
  params: { slug: string };
}) {
  const data = getPodcastDataBySlug(params.slug);
  const { previous, next } = getNextAndPreviousEpisodes(params.slug);
  return (
    <main id="main" role="main" className="w-full py-8">
      <div className="mx-auto mb-8 w-full max-w-[1088px] px-8">
        <h1 className="flex gap-2 text-xl font-semibold tracking-tight text-slate-900 md:text-2xl dark:text-slate-100">
          <Link
            className="flex w-20 shrink-0 items-center gap-2 text-slate-400 hover:text-slate-100"
            href="/podcast"
          >
            Podcast
          </Link>{' '}
          <span>|</span>
          <span>{data.title}</span>
        </h1>
        <h2 className="text-lg tracking-tight text-slate-900 md:text-xl dark:text-slate-100">
          {data.date.toLocaleDateString('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
          })}
        </h2>
        <div className="my-8 flex gap-4">
          <div className="grid basis-20 grid-cols-1 items-center justify-center">
            {previous ? (
              <Link
                href={`/podcast/${previous.slug}`}
                className="grid grid-cols-1 items-center justify-center"
              >
                <ChevronLeftIcon />
                <span className="text-center">previous episode</span>
              </Link>
            ) : (
              <></>
            )}
          </div>
          <EpisodePlayer data={data} />
          <div className="grid basis-20 grid-cols-1 items-center justify-center">
            {next ? (
              <Link
                href={`/podcast/${next.slug}`}
                className="grid grid-cols-1 items-center justify-center"
              >
                <ChevronRightIcon />
                <span className="text-center">next episode</span>
              </Link>
            ) : (
              <></>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
