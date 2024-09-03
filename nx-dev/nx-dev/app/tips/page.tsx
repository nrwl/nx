import { tipsApi } from '../../lib/tips.api';
import { TipsContainer } from '@nx/nx-dev/ui-tips';
import { DefaultLayout } from '@nx/nx-dev/ui-common';
import type { Metadata } from 'next';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Nx Tips - Quick Insights for Nx Users',
  description: 'Helpful tips and tricks for using Nx',
  openGraph: {
    url: 'https://nx.dev/tips',
    title: 'Nx Tips - Quick Insights for Nx Users',
    description:
      'Discover useful tips and tricks to enhance your Nx development experience.',
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

async function getTips() {
  const tips = await tipsApi.getTips();
  return tips;
}

export default async function TipsIndex() {
  const tips = await getTips();

  return (
    <DefaultLayout>
      <TipsContainer tips={tips} />
    </DefaultLayout>
  );
}

// Optionally, add ISR
export const revalidate = 3600; // Revalidate every hour
