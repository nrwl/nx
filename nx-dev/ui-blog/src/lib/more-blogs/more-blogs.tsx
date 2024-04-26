import Link from 'next/link';
import { cx } from '@nx/nx-dev/ui-primitives';
import { BlogPostDataEntry } from '@nx/nx-dev/data-access-documents/node-only';
import { BlogAuthors } from '../authors';
import { useState } from 'react';
import styles from './more-blogs.module.css';

export interface MoreBlogsProps {
  blogs: BlogPostDataEntry[];
}

export function MoreBlogs({ blogs }: MoreBlogsProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <>
      <div className="mx-auto mb-8 mt-20 border-b-2 border-slate-300 pb-3 text-sm dark:border-slate-700">
        <h2 className="font-semibold">More blogs</h2>
      </div>
      <div className="mx-auto">
        {blogs?.map((post, index) => {
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
              className={
                styles['layout'] +
                ' ' +
                cx(
                  'relative border-b border-slate-300 text-sm last:border-0 dark:border-slate-800',
                  'before:bg-slate-100 dark:before:bg-slate-800/50 ',
                  (hoveredIndex === index && index >= 0) ||
                    hoveredIndex === index + 1
                    ? 'border-slate-100 dark:border-slate-800/50'
                    : ''
                )
              }
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <span
                className={
                  styles['area-a'] +
                  ' text-balance font-medium text-slate-500 dark:text-white'
                }
              >
                {post.title}
              </span>
              <span className={styles['area-b']}>{tags.join(', ')}</span>
              <span className={styles['area-c']}>{formattedDate}</span>
              <span className={styles['area-d']}>
                <BlogAuthors authors={post.authors} />
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
