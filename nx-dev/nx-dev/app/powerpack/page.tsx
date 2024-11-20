import { ButtonLinkProps, DefaultLayout } from '@nx/nx-dev/ui-common';
import {
  CallToAction,
  GetStarted,
  Hero,
  PowerpackFeatures,
} from '@nx/nx-dev/ui-powerpack';
import { contactButton } from '../../lib/components/headerCtaConfigs';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nx Powerpack',
  description:
    'Nx Powerpack is a suite of paid extensions for the Nx CLI specifically designed for enterprises.',
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

export default function NxPowerPackPage(): JSX.Element {
  const headerCTAConfig: ButtonLinkProps[] = [
    {
      href: 'https://cloud.nx.app/powerpack/purchase?licenseBusinessType=small&utm_source=nx.dev&utm_medium=referral&utm_campaign=nx-powerpackurl',
      variant: 'primary',
      size: 'small',
      title: 'Request a free trial',
      children: 'Request a free trial',
    },
  ];

  return (
    <DefaultLayout headerCTAConfig={headerCTAConfig}>
      <Hero />

      <div className="mt-32 scroll-mt-32 lg:mt-56" id="features">
        <PowerpackFeatures />
      </div>

      <div className="mt-32 scroll-mt-32 lg:mt-56">
        <GetStarted />
      </div>

      <div className="mt-32 lg:mt-56">
        <CallToAction />
      </div>
    </DefaultLayout>
  );
}
