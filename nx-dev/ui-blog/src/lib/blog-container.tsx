'use client';
import { BlogPostDataEntry } from '@nx/nx-dev/data-access-documents/node-only';
import { MoreBlogs } from './more-blogs';
import { FeaturedBlogs } from './featured-blogs';
import { useEffect, useMemo, useState } from 'react';
import { Filters } from './filters';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ALL_TOPICS } from './topics';
import { sortFirstFivePosts } from './sort-featured-posts';
import {
  ComputerDesktopIcon,
  BookOpenIcon,
  MicrophoneIcon,
  CubeIcon,
  AcademicCapIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  ListBulletIcon,
  VideoCameraIcon,
  RssIcon,
  AtSymbolIcon,
} from '@heroicons/react/24/outline';

export interface BlogContainerProps {
  blogPosts: BlogPostDataEntry[];
  tags: string[];
}

export function BlogContainer({ blogPosts, tags }: BlogContainerProps) {
  const searchParams = useSearchParams();
  const [filteredList, setFilteredList] = useState(blogPosts);

  // Only show filters that have blog posts
  const filters = useMemo(() => {
    return [
      ALL_TOPICS[0],
      ...ALL_TOPICS.filter((filter) => tags.includes(filter.value)),
    ];
  }, [tags]);

  const {
    initialFirstFive,
    initialRest,
    initialSelectedFilterHeading,
    initialSelectedFilter,
  } = useMemo(
    () => initializeFilters(blogPosts, searchParams),
    [blogPosts, searchParams]
  );

  const [firstFiveBlogs, setFirstFiveBlogs] =
    useState<BlogPostDataEntry[]>(initialFirstFive);
  const [remainingBlogs, setRemainingBlogs] =
    useState<BlogPostDataEntry[]>(initialRest);
  const [selectedFilterHeading, setSelectedFilterHeading] = useState(
    initialSelectedFilterHeading
  );

  function updateBlogPosts() {
    const firstFive = sortFirstFivePosts(filteredList);
    setFirstFiveBlogs(firstFive);

    // Get the remaining blogs, sorted by date (unpinned posts after the first 5)
    const firstFiveSlugs = new Set(firstFive.map((post) => post.slug));
    const remaining = filteredList
      .filter((post) => !firstFiveSlugs.has(post.slug))
      .sort((a, b) => new Date(b.date).valueOf() - new Date(a.date).valueOf());
    setRemainingBlogs(remaining);
  }

  useEffect(() => updateBlogPosts(), [filteredList]);

  return (
    <main id="main" role="main" className="w-full py-8">
      <div className="mx-auto mb-8 w-full max-w-[1088px] px-8">
        <div className="mb-12 mt-20 flex items-center justify-between">
          <header>
            <h1
              id="blog-title"
              className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl dark:text-slate-100"
            >
              {selectedFilterHeading}
            </h1>
          </header>
          <div className="flex items-center justify-end md:justify-start">
            <Filters
              blogs={blogPosts}
              filters={filters}
              initialSelectedFilter={initialSelectedFilter}
              setFilteredList={setFilteredList}
              setSelectedFilterHeading={setSelectedFilterHeading}
            />
          </div>
        </div>
        <FeaturedBlogs blogs={firstFiveBlogs} />
        {!!remainingBlogs.length && (
          <>
            <div className="mx-auto mb-8 mt-20 flex items-center justify-between border-b-2 border-slate-300 pb-3 text-sm dark:border-slate-700">
              <h2 className="font-semibold">More blogs</h2>
              <div className="flex gap-2">
                <Link
                  href="/blog/rss.xml"
                  aria-label="RSS feed"
                  prefetch={false}
                >
                  <RssIcon className="h-5 w-5 text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200" />
                </Link>
                <Link
                  href="/blog/atom.xml"
                  aria-label="Atom feed"
                  prefetch={false}
                >
                  <AtSymbolIcon className="h-5 w-5 text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200" />
                </Link>
              </div>
            </div>
            <MoreBlogs blogs={remainingBlogs} />
          </>
        )}
      </div>
    </main>
  );
}

function initializeFilters(
  blogPosts: BlogPostDataEntry[],
  searchParams: URLSearchParams
) {
  const filterBy = searchParams.get('filterBy');

  const firstFive = sortFirstFivePosts(blogPosts);
  const firstFiveSlugs = new Set(firstFive.map((post) => post.slug));
  const remaining = blogPosts
    .filter((post) => !firstFiveSlugs.has(post.slug))
    .sort((a, b) => new Date(b.date).valueOf() - new Date(a.date).valueOf());

  const defaultState = {
    initialFirstFive: firstFive,
    initialRest: remaining,
    initialSelectedFilterHeading: 'All Blogs',
    initialSelectedFilter: 'All',
  };

  if (!filterBy) {
    return defaultState;
  }

  const result = blogPosts.filter((post) => post.tags.includes(filterBy));

  const initialFilter = ALL_TOPICS.find((filter) => filter.value === filterBy);

  const filteredFirstFive = sortFirstFivePosts(result);
  const filteredFirstFiveSlugs = new Set(
    filteredFirstFive.map((post) => post.slug)
  );
  const filteredRemaining = result
    .filter((post) => !filteredFirstFiveSlugs.has(post.slug))
    .sort((a, b) => new Date(b.date).valueOf() - new Date(a.date).valueOf());

  return {
    initialFirstFive: filteredFirstFive,
    initialRest: filteredRemaining,
    initialSelectedFilterHeading: initialFilter?.heading || 'All Blogs',
    initialSelectedFilter: initialFilter?.value || 'All',
  };
}
