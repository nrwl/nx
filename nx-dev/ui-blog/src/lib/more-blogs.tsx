'use client';
import Link from 'next/link';
import { BlogPostDataEntry } from '@nx/nx-dev/data-access-documents/node-only';
import { BlogAuthors } from './authors';
import {
  ComputerDesktopIcon,
  BookOpenIcon,
  MicrophoneIcon,
  CubeIcon,
  AcademicCapIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { Filters } from './filters';
import { useState } from 'react';

export interface MoreBlogsProps {
  blogs: BlogPostDataEntry[];
}

const filters = [
  {
    label: 'All',
    icon: XCircleIcon,
    value: 'All',
  },
  {
    label: 'Stories',
    icon: BookOpenIcon,
    value: 'customer story',
  },
  {
    label: 'Webinars',
    icon: ComputerDesktopIcon,
    value: 'webinar',
  },
  {
    label: 'Podcasts',
    icon: MicrophoneIcon,
    value: 'podcast',
  },
  {
    label: 'Releases',
    icon: CubeIcon,
    value: 'release',
  },
  {
    label: 'Talks',
    icon: ChatBubbleOvalLeftEllipsisIcon,
    value: 'talk',
  },
  {
    label: 'Tutorials',
    icon: AcademicCapIcon,
    value: 'tutorial',
  },
];

export function MoreBlogs({ blogs }: MoreBlogsProps) {
  const [filteredList, setFilteredList] = useState(blogs);

  return (
    <>
      <div className="mx-auto mb-8 mt-20 border-b-2 border-slate-300 pb-3 text-sm dark:border-slate-700">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">More blogs</h2>
          <Filters blogs={blogs} setFilteredList={setFilteredList} />
        </div>
      </div>
      <div className="mx-auto">
        {filteredList?.map((post) => {
          const formattedDate = new Date(post.date).toLocaleDateString(
            'en-US',
            {
              month: 'short',
              day: '2-digit',
              year: 'numeric',
            }
          );
          const tags = post.tags.map(
            (tag) => `${tag.substring(0, 1).toUpperCase()}${tag.substring(1)}`
          );
          return (
            <Link
              href={`/blog/${post.slug}`}
              key={post.slug}
              className="relative flex items-center gap-6 border-b border-slate-200 py-5 text-sm before:absolute before:inset-x-[-16px] before:inset-y-[-2px] before:z-[-1] before:rounded-xl before:bg-slate-200 before:opacity-0 last:border-0 before:hover:opacity-100 dark:border-slate-800 dark:before:bg-slate-800/50"
              prefetch={false}
            >
              <span className="w-1/2 flex-none text-balance font-medium text-slate-500 sm:w-5/12 dark:text-white">
                {post.title}
              </span>
              <span className="w-1/2 flex-none sm:w-3/12">
                {tags.join(', ')}
              </span>
              <span className="hidden w-2/12 flex-none sm:inline-block">
                {formattedDate}
              </span>
              <span className="hidden flex-1 overflow-hidden sm:inline-block">
                <BlogAuthors authors={post.authors} showAuthorDetails={false} />
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
