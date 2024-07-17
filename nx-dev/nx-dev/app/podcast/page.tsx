import { Metadata } from 'next';
import { blogApi } from '../../lib/blog.api';
import { Hero, PodcastList, Layout } from '@nx/nx-dev/ui-podcast';

export const metadata: Metadata = {
  title: 'Nx Podcast - Updates from the Nx & Nx Cloud team',
  description: 'Latest podcasts from the Nx & Nx Cloud core team',
  openGraph: {
    url: 'https://nx.dev/podcast',
    title: 'Nx Podcast - Updates from the Nx & Nx Cloud team',
    description:
      'Stay updated with the latest podcasts from the Nx & Nx Cloud team.',
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

async function getPodcasts() {
  return await blogApi.getPodcastBlogs();
}
export default async function Page() {
  const podcasts = await getPodcasts();
  return (
    <Layout>
      <Hero />
      <PodcastList podcasts={podcasts} />
    </Layout>
  );
}
