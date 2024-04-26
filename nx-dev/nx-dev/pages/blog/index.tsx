import { Footer, Header } from '@nx/nx-dev/ui-common';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
import { BlogPostDataEntry } from '@nx/nx-dev/data-access-documents/node-only';

import { blogApi } from '../../lib/blog.api';
import { BlogEntry, MoreBlogs } from '@nx/nx-dev/ui-blog';

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
        <div className="mx-auto mb-8 w-full max-w-[1088px] px-8">
          <header className="mx-auto mb-16">
            <h1
              id="blog-title"
              className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl dark:text-slate-100"
            >
              Blog
            </h1>
          </header>
          <div className="mx-auto flex flex-col gap-4">
            <div className="grid grid-cols-6 gap-6">
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
          {restOfPosts.length > 0 ? <MoreBlogs blogs={restOfPosts} /> : null}
        </div>
      </main>
      <Footer />
    </>
  );
}
