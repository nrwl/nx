import Link from 'next/link';
import { BlogPostDataEntry } from '@nx/nx-dev/data-access-documents/node-only';
import Image from 'next/image';
import { BlogAuthors } from './authors';
import { ChevronLeftIcon, ListBulletIcon } from '@heroicons/react/24/outline';
import { renderMarkdown } from '@nx/nx-dev/ui-markdoc';
import { EpisodePlayer } from './episode-player';
import { YouTube } from '@nx/nx-dev/ui-common';
import { FeaturedBlogs } from './featured-blogs';
import { MoreBlogs } from './more-blogs';
import { ALL_TOPICS, type Topic } from './topics';
import { Metrics } from '@nx/nx-dev/ui-markdoc';

export interface BlogDetailsProps {
  post: BlogPostDataEntry;
  allPosts: BlogPostDataEntry[];
}

export function BlogDetails({ post, allPosts }: BlogDetailsProps) {
  const { node } = renderMarkdown(post.content, {
    filePath: post.filePath ?? '',
    headingClass: 'scroll-mt-20',
  });

  const formattedDate = new Date(post.date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Find the primary topic of the current post
  const primaryTopic = ALL_TOPICS.find((topic: Topic) =>
    post.tags.includes(topic.value.toLowerCase())
  );

  const relatedPosts = allPosts
    .filter(
      (p) =>
        p.slug !== post.slug && // Exclude current post
        p.tags.some((tag) => post.tags.includes(tag)) // Include posts with matching tags
    )
    .slice(0, 5);

  return (
    <main id="main" role="main" className="w-full py-8">
      <div className="mx-auto max-w-screen-md">
        {/* Top navigation and author info */}
        <div className="mx-auto flex justify-between px-4">
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

        {/* Title */}
        <header className="mx-auto mb-16 mt-8 px-4">
          <h1 className="text-center text-4xl font-semibold text-slate-900 dark:text-white">
            {post.title}
          </h1>
        </header>

        {/* Media content (podcast, youtube, or image) */}
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
            <YouTube src={post.youtubeUrl} title={post.title} />
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
      </div>

      {/* Main grid layout */}
      <div className="mx-auto max-w-7xl px-4 lg:px-8" data-content-area>
        <div className="relative isolate grid grid-cols-1 gap-8 xl:grid-cols-[200px_minmax(0,1fr)_200px]">
          <div className="hidden min-h-full xl:block">
            {post.metrics && (
              <div className="sticky top-28 pr-4 pt-8">
                <Metrics metrics={post.metrics} variant="vertical" />
              </div>
            )}
          </div>

          {/* Middle column - main content */}
          <div className="w-full min-w-0 md:mx-auto md:max-w-screen-md">
            {post.metrics && (
              <div className="mb-8 xl:hidden">
                <Metrics metrics={post.metrics} variant="horizontal" />
              </div>
            )}
            <div
              data-document="main"
              className="prose prose-lg prose-slate dark:prose-invert w-full max-w-none"
            >
              {node}
            </div>
          </div>

          {/* Right column - for future sticky content */}
          <div className="hidden xl:block">
            <div className="sticky top-24">
              {/* Right sidebar content can go here */}
            </div>
          </div>
        </div>
      </div>

      {/* Related Posts Section */}
      {post.tags.length > 0 && relatedPosts.length > 0 && (
        <section className="mt-24 border-b border-t border-slate-200 bg-slate-50 py-24 sm:py-32 dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl lg:mx-0 lg:max-w-none">
              <h2 className="mb-8 flex items-center gap-3 text-2xl font-semibold text-slate-900 dark:text-white">
                {primaryTopic ? (
                  <>
                    <primaryTopic.icon className="h-7 w-7" />
                    More {primaryTopic.label}
                  </>
                ) : (
                  <>
                    <ListBulletIcon className="h-7 w-7" />
                    More Articles
                  </>
                )}
              </h2>
              {/* Show list view on small screens */}
              <div className="md:hidden">
                <MoreBlogs blogs={relatedPosts} />
              </div>
              {/* Show grid view on larger screens */}
              <div className="hidden md:block">
                <FeaturedBlogs blogs={relatedPosts} />
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
