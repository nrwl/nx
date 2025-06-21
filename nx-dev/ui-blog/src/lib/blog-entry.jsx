'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.BlogEntry = BlogEntry;
const tslib_1 = require('tslib');
const link_1 = tslib_1.__importDefault(require('next/link'));
const authors_1 = require('./authors');
const image_1 = tslib_1.__importDefault(require('next/image'));
function BlogEntry({ post, overrideLink }) {
  return (
    <div className="relative flex h-full transform-gpu flex-col overflow-hidden rounded-2xl border border-slate-200 shadow transition-all duration-300 ease-in-out hover:scale-[1.02] hover:shadow-lg dark:border-slate-800">
      {post.cover_image && (
        <div className="aspect-[1.7] w-full">
          <image_1.default
            quality={100}
            className="h-full w-full object-cover"
            src={post.cover_image}
            alt={post.title}
            width={1400}
            height={735}
          />
        </div>
      )}
      <div className="flex flex-col gap-1 p-4">
        <authors_1.BlogAuthors authors={post.authors} />
        <link_1.default
          href={overrideLink ? overrideLink : `/blog/${post.slug}`}
          title={post.title}
          className="text-balance text-lg font-semibold text-slate-900 dark:text-white"
          prefetch={false}
        >
          <span className="absolute inset-0" aria-hidden="true" />
          {post.title}
        </link_1.default>
      </div>
    </div>
  );
}
