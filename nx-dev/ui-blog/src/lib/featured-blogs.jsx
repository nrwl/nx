'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.FeaturedBlogs = FeaturedBlogs;
const blog_entry_1 = require('./blog-entry');
function FeaturedBlogs({ blogs }) {
  return (
    <div className="mx-auto flex flex-col gap-4">
      <div className="grid grid-cols-6 gap-6">
        {blogs.map((blog, index) => (
          <div
            key={blog.title}
            className={`col-span-6 ${
              index <= 1 ? 'md:col-span-3' : 'sm:col-span-3'
            } ${index > 0 ? 'md:col-span-2' : ''}`}
          >
            <blog_entry_1.BlogEntry post={blog} />
          </div>
        ))}
      </div>
    </div>
  );
}
