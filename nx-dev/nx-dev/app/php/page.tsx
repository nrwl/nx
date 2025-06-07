import { DefaultLayout } from '@nx/nx-dev/ui-common';
import {
  CallToAction,
  Features,
  GettingStarted,
  Hero,
} from '@nx/nx-dev/ui-php';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nx For PHP',
  description:
    'Add Nx to your PHP project for distributed task execution, intelligent caching, and affected commands.',
  alternates: {
    canonical: 'https://nx.dev/php',
  },
  openGraph: {
    url: 'https://nx.dev/php',
    title: 'Nx For PHP',
    description:
      'Add Nx to your PHP project for distributed task execution, intelligent caching, and affected commands.',
    images: [
      {
        url: 'https://nx.dev/socials/nx-php-media.png',
        width: 800,
        height: 421,
        alt: 'Nx For PHP',
        type: 'image/jpeg',
      },
    ],
    siteName: 'Nx',
    type: 'website',
  },
};

export default function PHPPage(): JSX.Element {
  return (
    <DefaultLayout>
      <Hero />
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mt-16 scroll-mt-16 lg:mt-32" id="features">
          <Features />
        </div>
      </div>
      <div className="mt-16 scroll-mt-16 lg:mt-32">
        <GettingStarted />
      </div>
      <div className="overflow-hidden py-8 sm:py-8">
        <CallToAction />
      </div>
    </DefaultLayout>
  );
}
