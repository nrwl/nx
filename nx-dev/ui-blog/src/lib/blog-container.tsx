import { BlogPostDataEntry } from '@nx/nx-dev/data-access-documents/node-only';
import { MoreBlogs } from './more-blogs';
import { FeaturedBlogs } from './featured-blogs';

export interface BlogContainerProps {
  blogPosts: BlogPostDataEntry[];
}

export function BlogContainer({ blogPosts }: BlogContainerProps) {
  const [blog1, blog2, blog3, blog4, blog5, ...restOfPosts] = blogPosts;
  return (
    <main id="main" role="main" className="w-full py-8">
      <div className="mx-auto mb-8 w-full max-w-[1088px] px-8">
        <header className="mx-auto mb-16">
          <h1
            id="blog-title"
            className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl dark:text-slate-100"
          >
            Blog
          </h1>
        </header>
        <FeaturedBlogs blogs={[blog1, blog2, blog3, blog4, blog5]} />
        {restOfPosts.length > 0 ? <MoreBlogs blogs={restOfPosts} /> : null}
      </div>
    </main>
  );
}
