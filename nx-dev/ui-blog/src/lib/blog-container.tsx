'use client';
import { BlogPostDataEntry } from '@nx/nx-dev/data-access-documents/node-only';
import { MoreBlogs } from './more-blogs';
import { FeaturedBlogs } from './featured-blogs';
import { useEffect, useState } from 'react';
import { Filters } from './filters';

export interface BlogContainerProps {
  blogPosts: BlogPostDataEntry[];
}

export function BlogContainer({ blogPosts }: BlogContainerProps) {
  const [filteredList, setFilteredList] = useState(blogPosts);

  // We always initialize with at least 5 blog posts so this should be safe
  const [firstFivePost, setFirstFivePost] = useState<BlogPostDataEntry[]>(
    blogPosts.slice(0, 5)
  );
  const [restOfPosts, setRestOfPosts] = useState<BlogPostDataEntry[]>(
    blogPosts.slice(5)
  );
  const [selectedFilterHeading, setSelectedFilterHeading] =
    useState('All Blogs');

  function updateBlogPosts() {
    setFirstFivePost(
      filteredList.slice(0, filteredList.length > 5 ? 5 : filteredList.length)
    );
    setRestOfPosts(filteredList.length > 5 ? filteredList.slice(5) : []);
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
              setFilteredList={setFilteredList}
              setSelectedFilterHeading={setSelectedFilterHeading}
            />
          </div>
        </div>
        <FeaturedBlogs blogs={firstFivePost} />
        {restOfPosts.length > 0 ? <MoreBlogs blogs={restOfPosts} /> : null}
      </div>
    </main>
  );
}
