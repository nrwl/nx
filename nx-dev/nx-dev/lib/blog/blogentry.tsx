import { BlogPostDataEntry } from '@nx/nx-dev/data-access-documents/node-only';
import { BlogAuthors } from './authors';

export interface BlogEntryProps {
  blogpost: BlogPostDataEntry;
  showImage?: boolean;
}

export function BlogEntry({ blogpost, showImage }: BlogEntryProps) {
  return (
    <div className="h-full transition-all duration-300 ease-in-out rounded-lg outline-none  dark:bg-slate-900 hover:shadow-xl hover:focus-ring hover:ring-2 focus:outline-none">
      <a href={`/blog/${blogpost.slug}`}>
        {showImage && blogpost.frontmatter.cover_image && (
          <img
            className="rounded-t-lg"
            src={blogpost.frontmatter.cover_image}
            alt=""
          />
        )}
        <div className="p-4">
          <h5 className="mb-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            {blogpost.frontmatter.title}
          </h5>
          <div className="relative flex flex-col items-start justify-between w-full pt-2 space-y-10 md:flex-row md:items-center md:space-y-0">
            <BlogAuthors authors={blogpost.frontmatter.authors} />
          </div>
        </div>
      </a>
    </div>
  );
}
