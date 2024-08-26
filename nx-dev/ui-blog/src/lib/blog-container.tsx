'use client';
import { BlogPostDataEntry } from '@nx/nx-dev/data-access-documents/node-only';
import { MoreBlogs } from './more-blogs';
import { FeaturedBlogs } from './featured-blogs';
import { useEffect, useMemo, useState } from 'react';
import { Filters } from './filters';
import { useSearchParams } from 'next/navigation';
import {
  ComputerDesktopIcon,
  BookOpenIcon,
  MicrophoneIcon,
  CubeIcon,
  AcademicCapIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  ListBulletIcon,
  VideoCameraIcon,
} from '@heroicons/react/24/outline';

export interface BlogContainerProps {
  blogPosts: BlogPostDataEntry[];
  tags: string[];
}

let ALL_TOPICS = [
  {
    label: 'All',
    icon: ListBulletIcon,
    value: 'All',
    heading: 'All Blogs',
  },
  {
    label: 'Stories',
    icon: BookOpenIcon,
    value: 'customer story',
    heading: 'Customer Stories',
  },
  {
    label: 'Webinars',
    icon: ComputerDesktopIcon,
    value: 'webinar',
    heading: 'Webinars',
  },
  {
    label: 'Podcasts',
    icon: MicrophoneIcon,
    value: 'podcast',
    heading: 'Podcasts',
  },
  {
    label: 'Releases',
    icon: CubeIcon,
    value: 'release',
    heading: 'Release Blogs',
  },
  {
    label: 'Talks',
    icon: ChatBubbleOvalLeftEllipsisIcon,
    value: 'talk',
    heading: 'Talks',
  },
  {
    label: 'Tutorials',
    icon: AcademicCapIcon,
    value: 'tutorial',
    heading: 'Tutorials',
  },
  {
    label: 'Livestreams',
    icon: VideoCameraIcon,
    value: 'livestream',
    heading: 'Livestreams',
  },
];

// first five blog posts contain potentially pinned plus the last published ones. They
// should be sorted by date (not just all pinned first)
export function sortFirstFivePosts(
  posts: BlogPostDataEntry[]
): BlogPostDataEntry[] {
  return posts
    .slice(0, 5)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
    setFirstFiveBlogs(sortFirstFivePosts(filteredList));
    setRemainingBlogs(filteredList.length > 5 ? filteredList.slice(5) : []);
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
        {!!remainingBlogs.length && <MoreBlogs blogs={remainingBlogs} />}
      </div>
    </main>
  );
}

function initializeFilters(
  blogPosts: BlogPostDataEntry[],
  searchParams: URLSearchParams
) {
  const filterBy = searchParams.get('filterBy');

  const defaultState = {
    initialFirstFive: sortFirstFivePosts(blogPosts),
    initialRest: blogPosts.slice(5),
    initialSelectedFilterHeading: 'All Blogs',
    initialSelectedFilter: 'All',
  };

  if (!filterBy) {
    return defaultState;
  }

  const result = blogPosts.filter((post) => post.tags.includes(filterBy));

  const initialFilter = ALL_TOPICS.find((filter) => filter.value === filterBy);

  return {
    initialFirstFive: sortFirstFivePosts(result),
    initialRest: result.length > 5 ? result.slice(5) : [],
    initialSelectedFilterHeading: initialFilter?.heading || 'All Blogs',
    initialSelectedFilter: initialFilter?.value || 'All',
  };
}
