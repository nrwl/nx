import { CallToAction, DefaultLayout } from '@nx/nx-dev-ui-common';

import type { Metadata } from 'next';
import { type ReactElement } from 'react';
import { contactButton } from '../../lib/components/headerCtaConfigs';
import { Faq, RemoteCacheSolutions } from '@nx/nx-dev-ui-remote-cache';

export const metadata: Metadata = {
  title: 'Nx - Remote Cache',
  description:
    'Free remote caching solutions for any team. Pick from Managed Remote Cache with Nx Cloud, Self-Hosted Cache Plugins, or Build Your Own with our OpenAPI specs.',
  alternates: {
    canonical: 'https://nx.dev/remote-cache',
  },
  openGraph: {
    url: 'https://nx.dev/remote-cache',
    title: 'Nx - Remote Cache',
    description:
      'Free remote caching solutions for any team. Pick from Managed Remote Cache with Nx Cloud, Self-Hosted Cache Plugins, or Build Your Own with our OpenAPI specs.',
    images: [
      {
        url: 'https://nx.dev/socials/nx-media.png',
        width: 800,
        height: 421,
        alt: 'Nx - Free remote caching solutions for any team.',
        type: 'image/jpeg',
      },
    ],
    siteName: 'Nx',
    type: 'website',
  },
};

export default function NxRemoteCachePage(): ReactElement {
  return (
    <DefaultLayout headerCTAConfig={[contactButton]}>
      <RemoteCacheSolutions />
      <div className="mt-32 lg:mt-56">
        <Faq />
      </div>
      <div className="mt-32 lg:mt-56">
        <CallToAction
          mainActionLinkText="Get started"
          mainActionLink="https://cloud.nx.app/get-started/?utm_source=nx-dev&utm_medium=remote-cache-call-to-action&utm_campaign=self-hosted-cache&utm_content=get-started"
          mainActionTitle="Get started with Nx Cloud"
        />
      </div>
    </DefaultLayout>
  );
}
