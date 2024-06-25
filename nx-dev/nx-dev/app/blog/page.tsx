import type { Metadata } from 'next';
import { blogApi } from '../../lib/blog.api';
import { BlogContainer } from '@nx/nx-dev/ui-blog';

export const metadata: Metadata = {
  title: 'Nx Blog - Updates from the Nx & Nx Cloud team',
  description: 'Latest news from the Nx & Nx Cloud core team',
  openGraph: {
    url: 'https://nx.dev/blog',
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
  },
};
async function getBlogs() {
  return await blogApi.getBlogPosts();
}

export default async function BlogIndex() {
  const blogs = await getBlogs();
  return <BlogContainer blogPosts={blogs} />;
}
