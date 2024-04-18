import Link from 'next/link';
import { Footer, Header, SectionHeading } from '@nx/nx-dev/ui-common';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
import { BlogPostDataEntry } from '@nx/nx-dev/data-access-documents/node-only';

import { blogApi } from '../../lib/blog.api';
import { BlogAuthors, BlogEntry } from '@nx/nx-dev/ui-blog';

interface BlogListProps {
  blogposts: BlogPostDataEntry[];
}

export function getStaticProps(): { props: BlogListProps } {
  const blogposts = blogApi.getBlogPosts();
  return {
    props: {
      blogposts,
    },
  };
}

export default function Blog(props: BlogListProps): JSX.Element {
  const router = useRouter();
  const [blog1, blog2, blog3, blog4, blog5, ...restOfPosts] = props.blogposts;

  return (
    <>
      <NextSeo
        title="Nx Blog - Updates from the Nx & Nx Cloud team"
        description="Latest news from the Nx & Nx Cloud core team"
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Nx Blog - Updates from the Nx & Nx Cloud team',
          description:
            'Stay updated with the latest news, articles, and updates from the Nx & Nx Cloud team.',
          images: [
            {
              url: 'https://nx.dev/socials/nx-media.png',
              width: 800,
              height: 421,
              alt: 'Nx: Smart Monorepos · Fast CI',
              type: 'image/jpeg',
            },
          ],
          siteName: 'NxDev',
          type: 'website',
        }}
      />
      <Header />
      <main id="main" role="main" className="w-full py-8">
        <div className="max-w-screen-xl mx-auto mb-8 px-4 lg:px-8">
          <header className="mx-auto mb-16">
            <SectionHeading as="h1" variant="display" id="blog-title">
              Blog
            </SectionHeading>
          </header>
          <div className="mx-auto flex flex-col gap-4">
            <div className="grid grid-cols-6 gap-4">
              <div className="col-span-6 md:col-span-3">
                {blog1 && <BlogEntry post={blog1} />}
              </div>
              <div className="col-span-6 sm:col-span-3 md:col-span-3">
                {blog2 && <BlogEntry post={blog2} />}
              </div>
              <div className="col-span-6 sm:col-span-3 md:col-span-2">
                {blog3 && <BlogEntry post={blog3} />}
              </div>
              <div className="col-span-6 sm:col-span-3 md:col-span-2">
                {blog4 && <BlogEntry post={blog4} />}
              </div>
              <div className="col-span-6 sm:col-span-3 md:col-span-2">
                {blog5 && <BlogEntry post={blog5} />}
              </div>
            </div>
          </div>
          {restOfPosts.length > 0 ? (
            <>
              <div className="mx-auto mt-16 mb-8">
                <h2 className="text-3xl font-semibold">More Posts</h2>
              </div>
              <div className="mx-auto">
                {restOfPosts?.map((post) => {
                  const formattedDate = new Date(post.date).toLocaleDateString(
                    'en-US',
                    {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    }
                  );
                  return (
                    <Link
                      href={`/blog/${post.slug}`}
                      key={post.slug}
                      className="flex mb-4 pb-2 border-b last:border-0 border-slate-300 dark:border-slate-700 hover:text-slate-500 dark:hover:text-white"
                    >
                      <span className="font-semibold w-[400px]">
                        {post.title}
                      </span>
                      <span className="text-slate-500 flex-1">
                        {formattedDate}
                      </span>
                      <span className="flex-none">
                        <BlogAuthors authors={post.authors} />
                      </span>
                    </Link>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
      </main>
      <Footer />
    </>
  );
}
