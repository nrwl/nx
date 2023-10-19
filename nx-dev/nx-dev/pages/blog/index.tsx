import { Footer, Header, SectionHeading } from '@nx/nx-dev/ui-common';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
import { blogApi } from '../../lib/blog.api';
import { BlogEntry } from '../../lib/blog/blogentry';
import { BlogPostDataEntry } from '@nx/nx-dev/data-access-documents/node-only';

interface BlogListProps {
  blogposts: BlogPostDataEntry[];
}

export async function getStaticProps(): Promise<{ props: BlogListProps }> {
  const blogposts = await blogApi.getBlogPosts();

  return {
    props: {
      blogposts: blogposts.sort(
        (a, b) =>
          new Date(b.frontmatter.published).valueOf() -
          new Date(a.frontmatter.published).valueOf()
      ),
    },
  };
}

export default function Blog(props: BlogListProps): JSX.Element {
  const router = useRouter();
  const [blog1, blog2, blog3, blog4, blog5, ...allPosts] = props.blogposts;

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
      <main id="main" role="main">
        <div className="w-full">
          <div className="py-8 bg-slate-50 dark:bg-slate-800/40">
            <div className="max-w-screen-xl mx-auto">
              <article className="py-8 mx-auto text-center">
                <header>
                  <SectionHeading as="h1" variant="display" id="blog-title">
                    The Nx Blog
                  </SectionHeading>
                  <p className="pt-5 text-lg text-slate-700 dark:text-slate-400">
                    First Hand from the Nx Team
                  </p>
                </header>
              </article>
              <article className="mx-auto px-6 items-center">
                <div className="flex space-x-4">
                  <BlogEntry blogpost={blog1} showImage={true} />
                  <BlogEntry blogpost={blog2} showImage={true} />
                </div>
                <div className="flex space-x-4 pt-4">
                  <BlogEntry blogpost={blog3} showImage={true} />
                  <BlogEntry blogpost={blog4} showImage={true} />
                  <BlogEntry blogpost={blog5} showImage={true} />
                </div>
              </article>
              <div className="p-16">
                <hr />
              </div>
              <article className="mx-auto px-6 items-center">
                <div className="grid grid-rows-6 lg:grid-cols-3 md:grid-cols-2 grid-cols-1  gap-4">
                  <div className="row-span-6">
                    <BlogEntry blogpost={blog1} showImage={true} />
                  </div>
                  <div className="row-span-2">
                    <BlogEntry blogpost={blog2} />
                  </div>
                  <div className="row-span-4">
                    <BlogEntry blogpost={blog3} showImage={true} />
                  </div>
                  <div className="row-span-4">
                    <BlogEntry blogpost={blog4} showImage={true} />
                  </div>
                  <div className="row-span-2">
                    <BlogEntry blogpost={blog5} />
                  </div>
                </div>
              </article>

              <ul className="grid grid-rows-6 lg:grid-cols-3 md:grid-cols-2 grid-cols-1  gap-4">
                {allPosts &&
                  allPosts.map((post) => (
                    <li key={post.slug}>
                      <BlogEntry blogpost={post} />
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
