import {
  MakeADifference,
  WhyJoinNx,
  CurrentOpenings,
  WhatWeOffer,
} from '@nx/nx-dev/ui-careers';
import { DefaultLayout } from '@nx/nx-dev/ui-common';

import { fetchJobsList } from '@nx/nx-dev/data-access-careers/node-only';
import { Metadata } from 'next';

async function getData() {
  return await fetchJobsList();
}

export const metadata: Metadata = {
  title: 'Nx: Careers',
  alternates: {
    canonical: 'https://nx.dev/careers',
  },
  description:
    'Make a difference. We build tools helping companies scale and modernize their development practices.',
  openGraph: {
    url: 'https://nx.dev/careers',
    title: 'Nx: Careers',
    description:
      'Make a difference. We build tools helping companies scale and modernize their development practices.',
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

export default async function CareersPage() {
  const jobs = await getData();
  return (
    <DefaultLayout>
      <MakeADifference />
      <div className="mt-32 lg:mt-56">
        <WhyJoinNx />
      </div>
      <div className="mt-32 lg:mt-56">
        <CurrentOpenings jobs={jobs} />
      </div>
      <div className="mt-32 lg:mt-56">
        <WhatWeOffer />
      </div>
    </DefaultLayout>
  );
}
