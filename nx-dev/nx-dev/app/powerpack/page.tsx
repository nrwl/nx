import { ButtonLinkProps, DefaultLayout } from '@nx/nx-dev-ui-common';
import {
  CallToAction,
  Faq,
  GetStarted,
  Hero,
  PowerpackFeatures,
} from '@nx/nx-dev-ui-powerpack';

import type { Metadata } from 'next';
import { type ReactElement } from 'react';

export const metadata: Metadata = {
  title: 'Nx Powerpack',
  description:
    'Nx Powerpack is a suite of paid extensions for the Nx CLI specifically designed for enterprises.',
  alternates: {
    canonical: 'https://nx.dev/powerpack',
  },
  openGraph: {
    url: 'https://nx.dev/powerpack',
    title: 'Nx Powerpack',
    description:
      'Nx Powerpack is a suite of paid extensions for the Nx CLI specifically designed for enterprises.',
    images: [
      {
        url: 'https://nx.dev/socials/nx-powerpack-media.png',
        width: 800,
        height: 421,
        alt: 'Nx Powerpack: Advanced tools for enterprises',
        type: 'image/jpeg',
      },
    ],
    siteName: 'Nx',
    type: 'website',
  },
};

export default function NxPowerPackPage(): ReactElement {
  const headerCTAConfig: ButtonLinkProps[] = [
    {
      href: '/powerpack/trial',
      variant: 'primary',
      size: 'small',
      title: 'Request a free trial',
      children: 'Request a free trial',
    },
  ];

  return (
    <DefaultLayout headerCTAConfig={headerCTAConfig}>
      <Hero />

      <div className="mt-16 scroll-mt-16" id="features">
        <PowerpackFeatures />
      </div>

      <div className="mt-32 scroll-mt-32 lg:mt-56">
        <GetStarted />
      </div>

      <div className="mt-32 scroll-mt-32 lg:mt-56">
        <Faq />
      </div>

      <div className="mt-32 lg:mt-56">
        <CallToAction />
      </div>
    </DefaultLayout>
  );
}
