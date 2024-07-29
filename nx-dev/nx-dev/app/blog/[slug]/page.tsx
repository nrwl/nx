import type { Metadata, ResolvingMetadata } from 'next';
import { blogApi } from '../../../lib/blog.api';
import { BlogDetails } from '@nx/nx-dev/ui-blog';
import { DefaultLayout } from '@nx/nx-dev/ui-common';
import { parse } from 'path';
interface BlogPostDetailProps {
  params: { slug: string };
}

export async function generateMetadata(
  { params: { slug } }: BlogPostDetailProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const post = await blogApi.getBlogPostBySlug(slug);
  const previousImages = (await parent).openGraph?.images ?? [];

  const postCoverImage = post?.cover_image || 'nx-media';
  const ogImage = `${parse(postCoverImage).name}.png`;

  return {
    title: `${post.title} | Nx Blog`,
    description: 'Latest news from the Nx & Nx Cloud core team',
    openGraph: {
      url: `https://nx.dev/blog/${slug}`,
      title: post.title,
      description: post.description,
      images: [
        {
          url: ogImage,
          width: 800,
          height: 421,
          alt: 'Nx: Smart, Fast and Extensible Build System',
          type: 'image/png',
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
  const blog = await blogApi.getBlogPostBySlug(slug);
  return blog ? (
    <>
      {/* This empty div is necessary as app router does not automatically scroll on route changes */}
      <div></div>
      <DefaultLayout>
        <BlogDetails post={blog} />
      </DefaultLayout>
    </>
  ) : null;
}
