'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.MoreBlogs = MoreBlogs;
const tslib_1 = require('tslib');
const link_1 = tslib_1.__importDefault(require('next/link'));
const authors_1 = require('./authors');
function MoreBlogs({ blogs }) {
  return (
    <>
      <div className="mx-auto">
        {blogs?.map((post) => {
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
            <link_1.default
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
                <authors_1.BlogAuthors
                  authors={post.authors}
                  showAuthorDetails={false}
                />
              </span>
            </link_1.default>
          );
        })}
      </div>
    </>
  );
}
