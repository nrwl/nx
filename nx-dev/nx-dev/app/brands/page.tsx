import { DefaultLayout } from '@nx/nx-dev/ui-common';
import {
  Hero,
  LernaBrand,
  NxBrand,
  NxCloudBrand,
  NxConsoleBrand,
} from '@nx/nx-dev/ui-brands';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Brands & Guidelines',
  description:
    'We’ve created the following guidelines for 3rd party use of our logos, content, and trademarks.',
  openGraph: {
    url: 'https://nx.dev/brands',
    title: 'Brands & Guidelines',
    description:
      'We’ve created the following guidelines for 3rd party use of our logos, content, and trademarks.',
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

export default function BrandsPage() {
  return (
    <DefaultLayout>
      <Hero />
      <div className="mt-32 lg:mt-56">
        <NxBrand />
      </div>
      <div className="mt-32 lg:mt-56">
        <NxCloudBrand />
      </div>
      <div className="mt-32 lg:mt-56">
        <NxConsoleBrand />
      </div>
      <div className="mt-32 lg:mt-56">
        <LernaBrand />
      </div>
    </DefaultLayout>
  );
}
