import { Metadata } from 'next';
import { webinarApi } from '../../lib/webinar.api';
import { DefaultLayout } from '@nx/nx-dev/ui-common';
import { Hero, WebinarList } from '@nx/nx-dev/ui-webinar';

export const metadata: Metadata = {
  title: 'Nx Webinar - Updates from the Nx & Nx Cloud team',
  description: 'Latest webinars from the Nx & Nx Cloud core team',
  alternates: {
    canonical: 'https://nx.dev/webinar',
  },
  openGraph: {
    url: 'https://nx.dev/webinar',
    title: 'Nx Webinar - Updates from the Nx & Nx Cloud team',
    description:
      'Stay updated with the latest webinars from the Nx & Nx Cloud team.',
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

async function getWebinars() {
  return await webinarApi.getWebinarBlogs();
}
export default async function Page() {
  const webinars = await getWebinars();
  return (
    <DefaultLayout>
      <Hero />
      <WebinarList webinars={webinars} />
    </DefaultLayout>
  );
}
