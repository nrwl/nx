import { BlogPostDataEntry } from '@nx/nx-dev/data-access-documents/node-only';
import { BlogEntry } from './blog-entry';

interface FeaturedBlogsProps {
  blogs: BlogPostDataEntry[];
}

export function FeaturedBlogs({ blogs }: FeaturedBlogsProps) {
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
            <BlogEntry post={blog} />
          </div>
        ))}
      </div>
    </div>
  );
}
