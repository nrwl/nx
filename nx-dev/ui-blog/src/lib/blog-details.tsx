import Link from 'next/link';
import { BlogPostDataEntry } from '@nx/nx-dev/data-access-documents/node-only';
import Image from 'next/image';
import { BlogAuthors } from './authors';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';
import { renderMarkdown } from '@nx/nx-dev/ui-markdoc';
import { EpisodePlayer } from './episode-player';
import { YouTube } from '@nx/nx-dev/ui-common';

export interface BlogDetailsProps {
  post: BlogPostDataEntry;
}

export async function generateMetadata({ post }: BlogDetailsProps) {
  return {
    title: post.title,
    description: post.description,
    openGraph: {
      images: [
        {
          url: post.cover_image
            ? `https://nx.dev${post.cover_image}`
            : 'https://nx.dev/socials/nx-media.png',
          width: 800,
          height: 421,
          alt: 'Nx: Smart, Fast and Extensible Build System',
          type: 'image/jpeg',
        },
      ],
    },
  };
}

export function BlogDetails({ post }: BlogDetailsProps) {
  const { node } = renderMarkdown(post.content, {
    filePath: post.filePath ?? '',
    headingClass: 'scroll-mt-20',
  });

  const formattedDate = new Date(post.date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <main id="main" role="main" className="w-full py-8">
      <div className="mx-auto mb-8 flex max-w-screen-xl justify-between px-4 lg:px-8">
        <Link
          href="/blog"
          className="flex w-20 shrink-0 items-center gap-2 text-slate-400 hover:text-slate-800 dark:text-slate-600 dark:hover:text-slate-200"
          prefetch={false}
        >
          <ChevronLeftIcon className="h-3 w-3" />
          Blog
        </Link>
        <div className="flex max-w-sm flex-1 grow items-center justify-end gap-2">
          <BlogAuthors authors={post.authors} />
          <span className="text-sm text-slate-400 dark:text-slate-600">
            {formattedDate}
          </span>
        </div>
      </div>
      <div id="content-wrapper">
        <header className="mx-auto mb-16 mt-8 max-w-3xl px-4 lg:px-0">
          <h1 className="text-center text-4xl font-semibold text-slate-900 dark:text-white">
            {post.title}
          </h1>
        </header>
        {post.podcastYoutubeId && post.podcastSpotifyId ? (
          <div className="mx-auto mb-16 w-full max-w-screen-md">
            <EpisodePlayer
              podcastYoutubeId={post.podcastYoutubeId}
              podcastSpotifyId={post.podcastSpotifyId}
              amazonUrl={post.podcastAmazonUrl}
              appleUrl={post.podcastAppleUrl}
              iHeartUrl={post.podcastIHeartUrl}
            />
          </div>
        ) : post.youtubeUrl ? (
          <div className="mx-auto mb-16 w-full max-w-screen-md">
            <YouTube
              src={post.youtubeUrl}
              title={post.title}
              caption={post.description}
            />
          </div>
        ) : (
          post.cover_image && (
            <div className="mx-auto mb-16 w-full max-w-screen-md">
              <Image
                className="w-full object-cover md:rounded-md"
                src={post.cover_image}
                alt={post.title}
                width={1400}
                height={735}
              />
            </div>
          )
        )}
        <div className="mx-auto min-w-0 max-w-3xl flex-auto px-4 pb-24 lg:px-0 lg:pb-16">
          <div className="relative">
            <div
              data-document="main"
              className="prose prose-lg prose-slate dark:prose-invert w-full max-w-none 2xl:max-w-4xl"
            >
              {node}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
