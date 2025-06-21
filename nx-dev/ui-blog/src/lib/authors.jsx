'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.BlogAuthors = BlogAuthors;
const tslib_1 = require('tslib');
const image_1 = tslib_1.__importDefault(require('next/image'));
const author_detail_1 = tslib_1.__importDefault(require('./author-detail'));
function BlogAuthors({ authors, showAuthorDetails = true }) {
  return (
    <div className="relative isolate flex items-center -space-x-2">
      {authors.map((author, index) => (
        <div key={index} className="group">
          <image_1.default
            alt={author.name}
            title={author.name}
            loading="lazy"
            width="48"
            height="48"
            decoding="async"
            src={`/documentation/blog/images/authors/${author.name}.jpeg`}
            className="relative inline-block h-6 w-6 rounded-full ring-1 ring-white grayscale dark:ring-slate-900"
          />
          {showAuthorDetails && <author_detail_1.default author={author} />}
        </div>
      ))}
    </div>
  );
}
