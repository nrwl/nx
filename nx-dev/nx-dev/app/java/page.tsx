import { DefaultLayout } from '@nx/nx-dev/ui-common';
import {
  CallToAction,
  Features,
  FeatureSections,
  GettingStarted,
  Hero,
  Resources,
} from '@nx/nx-dev/ui-gradle';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nx For Java',
  description:
    'Add Nx to your Java project for distributed task execution, intelligent caching, and affected commands.',
  alternates: {
    canonical: 'https://nx.dev/java',
  },
  openGraph: {
    url: 'https://nx.dev/java',
    title: 'Nx For Java',
    description:
      'Add Nx to your Java project for distributed task execution, intelligent caching, and affected commands.',
    images: [
      {
        url: 'https://nx.dev/socials/nx-gradle-media.png',
        width: 800,
        height: 421,
        alt: 'Nx For Java',
        type: 'image/jpeg',
      },
    ],
    siteName: 'Nx',
    type: 'website',
  },
};

export default function JavaPage(): JSX.Element {
  return (
    <DefaultLayout>
      <Hero />

      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mt-16 scroll-mt-16 lg:mt-32" id="features">
          <Features />
        </div>

        {/* <div className="mt-16 scroll-mt-16 lg:mt-32" id="resources"> */}
        {/*   <Resources /> */}
        {/* </div> */}
      </div>

      {/* <div className="mt-16 scroll-mt-16 lg:mt-32" id="feature-sections"> */}
      {/*   <FeatureSections /> */}
      {/* </div> */}

      <div className="mt-16 scroll-mt-16 lg:mt-32">
        <GettingStarted />
      </div>
      <div className="overflow-hidden py-8 sm:py-8">
        <CallToAction />
      </div>
    </DefaultLayout>
  );
}
