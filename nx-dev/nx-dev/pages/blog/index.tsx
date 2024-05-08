import { Footer, Header } from '@nx/nx-dev/ui-common';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
import { BlogPostDataEntry } from '@nx/nx-dev/data-access-documents/node-only';

import { blogApi } from '../../lib/blog.api';
import { BlogContainer } from '@nx/nx-dev/ui-blog';

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

export default function Blog({ blogposts }: BlogListProps): JSX.Element {
  const router = useRouter();

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
      <BlogContainer blogPosts={blogposts} />
      <Footer />
    </>
  );
}
