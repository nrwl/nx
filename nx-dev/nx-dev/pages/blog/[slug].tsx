import { GetStaticProps, GetStaticPaths } from 'next';
import { blogApi } from '../../lib/blog.api';
import { BlogPostDataEntry } from '@nx/nx-dev/data-access-documents/node-only';
import { NextSeo } from 'next-seo';
import { Footer, Header } from '@nx/nx-dev/ui-common';
import { BlogDetails } from '@nx/nx-dev/ui-blog';

interface BlogPostDetailProps {
  post: BlogPostDataEntry;
}

export default function BlogPostDetail({ post }: BlogPostDetailProps) {
  return (
    <>
      <NextSeo
        title={`${post.title} | Nx Blog`}
        description="Latest news from the Nx & Nx Cloud core team"
        openGraph={{
          url: 'https://nx.dev', // + router.asPath,
          title: post.title,
          description: post.description,
          images: [
            {
              url: post.cover_image
                ? `https://nx.dev${post.cover_image}`
                : 'https://nx.dev/socials/nx-media.png',
              width: 800,
              height: 421,
              alt: 'Nx: Smart, Fast and Extensible Build System',
              type: 'image/jpeg',
            },
          ],
          siteName: 'NxDev',
          type: 'website',
        }}
      />
      <Header />
      <BlogDetails post={post} />
      <Footer />
    </>
  );
}

export const getStaticProps: GetStaticProps = async (context) => {
  // optimize s.t. we don't read the FS multiple times; for now it's ok
  // const posts = await blogApi.getBlogPosts();
  // const post = posts.find((p) => p.slug === context.params?.slug);
  try {
    const post = await blogApi.getBlogPost(context.params?.slug as string);
    return { props: { post } };
  } catch (e) {
    return {
      notFound: true,
      props: {
        statusCode: 404,
      },
    };
  }
};

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await blogApi.getBlogPosts();

  const paths = posts.map((post) => ({
    params: { slug: post.slug },
  }));

  return { paths, fallback: 'blocking' };
};
