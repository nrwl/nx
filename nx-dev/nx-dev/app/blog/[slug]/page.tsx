import type { Metadata, ResolvingMetadata } from 'next';
import { blogApi } from '../../../lib/blog.api';
import { BlogDetails } from '@nx/nx-dev/ui-blog';
import { DefaultLayout } from '@nx/nx-dev/ui-common';
import { tryNxCloudForFree } from '../../../lib/components/headerCtaConfigs';

interface BlogPostDetailProps {
  params: { slug: string };
}

export async function generateMetadata(
  { params: { slug } }: BlogPostDetailProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const post = await blogApi.getBlogPostBySlug(slug);
  const previousImages = (await parent).openGraph?.images ?? [];

  return {
    title: `${post.title} | Nx Blog`,
    description: post.description,
    alternates: {
      canonical: `https://nx.dev/blog/${slug}`,
    },
    openGraph: {
      url: `https://nx.dev/blog/${slug}`,
      title: post.title,
      description: post.description,
      images: [
        {
          url: post.ogImage,
          width: 800,
          height: 421,
          alt: 'Nx: Smart, Fast and Extensible Build System',
          type: `image/${post.ogImageType}`,
        },
        ...previousImages,
      ],
    },
  };
}

export async function generateStaticParams() {
  return (await blogApi.getBlogs()).map((post) => {
    return { slug: post.slug };
  });
}

export default async function BlogPostDetail({
  params: { slug },
}: BlogPostDetailProps) {
  const ctaHeaderConfig = [tryNxCloudForFree];
  const blog = await blogApi.getBlogPostBySlug(slug);
  const allPosts = await blogApi.getBlogs((p) => !!p.published);

  return blog ? (
    <>
      {/* This empty div is necessary as app router does not automatically scroll on route changes */}
      <div></div>
      <DefaultLayout headerCTAConfig={ctaHeaderConfig}>
        <BlogDetails post={blog} allPosts={allPosts} />
      </DefaultLayout>
    </>
  ) : null;
}
