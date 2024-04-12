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
        title="Nx Blog"
        description="Latest news from the Nx & Nx Cloud core team"
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Nx Blog',
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
        <div className="max-w-screen-xl mx-auto mb-8 px-4 sm:px-8">
          <header className="mx-auto mb-16">
            <SectionHeading as="h1" variant="display" id="blog-title">
              Blog
            </SectionHeading>
          </header>
          <div className="mx-auto flex flex-col gap-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 basis-full md:basis-[48%]">
                <BlogEntry blogpost={blog1} showImage={true} />
              </div>
              <div className="flex-1 basis-full md:basis-[48%]">
                <BlogEntry blogpost={blog2} showImage={true} />
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 basis-full md:basis-[31%]">
                <BlogEntry blogpost={blog3} showImage={true} />
              </div>
              <div className="flex-1 basis-full md:basis-[31%]">
                <BlogEntry blogpost={blog4} showImage={true} />
              </div>
              <div className="flex-1 basis-full md:basis-[31%]">
                <BlogEntry blogpost={blog5} showImage={true} />
              </div>
            </div>
          </div>
          <div className="mx-auto mt-16 mb-8">
            <h2 className="text-3xl font-semibold">More Posts</h2>
          </div>
          <div className="mx-auto">
            {restOfPosts?.map((post) => {
              const formattedDate = new Date(
                post.frontmatter.date
              ).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });
              return (
                <Link
                  href={`/blog/${post.slug}`}
                  key={post.slug}
                  className="flex mb-4 pb-2 border-b last:border-0 border-slate-300 dark:border-slate-700 hover:text-slate-500 dark:hover:text-white"
                >
                  <span className="font-semibold w-[400px]">
                    {post.frontmatter.title}
                  </span>
                  <span className="text-slate-500 flex-1">{formattedDate}</span>
                  <span className="flex-none">
                    <BlogAuthors authors={post.frontmatter.authors} />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
