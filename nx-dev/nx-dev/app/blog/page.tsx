import type { Metadata } from 'next';
import { blogApi } from '../../lib/blog.api';
import { BlogContainer } from '@nx/nx-dev/ui-blog';
import { DefaultLayout } from '@nx/nx-dev/ui-common';
import { Suspense } from 'react';
import {
  requestFreeTrial,
  tryNxCloudForFree,
} from '../../lib/components/headerCtaConfigs';

export const metadata: Metadata = {
  title: 'Nx Blog - Updates from the Nx & Nx Cloud team',
  description: 'Latest news from the Nx & Nx Cloud core team',
  alternates: {
    canonical: 'https://nx.dev/blog',
  },
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
        alt: 'Nx: Smart Repos · Fast Builds',
        type: 'image/jpeg',
      },
    ],
    siteName: 'Nx',
    type: 'website',
  },
};
async function getBlogs() {
  return await blogApi.getBlogs((p) => !!p.published);
}

async function getBlogTags() {
  return await blogApi.getBlogTags();
}

export default async function BlogIndex() {
  const ctaHeaderConfig = [tryNxCloudForFree];

  const blogs = await getBlogs();
  const tags = await getBlogTags();
  return (
    <Suspense>
      <DefaultLayout headerCTAConfig={ctaHeaderConfig}>
        <BlogContainer blogPosts={blogs} tags={tags} />
      </DefaultLayout>
    </Suspense>
  );
}
