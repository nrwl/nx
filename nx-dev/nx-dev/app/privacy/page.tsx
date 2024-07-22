import { DefaultLayout, SquareDottedPattern } from '@nx/nx-dev/ui-common';
import { Heading, Policies } from '@nx/nx-dev/ui-privacy';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description:
    'Our policies regarding the collection, use and disclosure of personal data when you use our Service and the choices you have associated with that data.',
  openGraph: {
    url: 'https://nx.dev/privacy',
    title: 'Privacy policy',
    description:
      'Our policies regarding the collection, use and disclosure of personal data when you use our Service and the choices you have associated with that data.',
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

export default function PrivacyPage() {
  return (
    <DefaultLayout>
      <div className="relative overflow-hidden">
        <div className="hidden lg:absolute lg:inset-y-0 lg:block lg:h-full lg:w-full lg:[overflow-anchor:none]">
          <div
            className="relative mx-auto h-full max-w-prose text-lg"
            aria-hidden="true"
          >
            <SquareDottedPattern />
          </div>
        </div>
        <article className="relative px-4 sm:px-6 lg:px-8">
          <Heading />
          <Policies />
        </article>
      </div>
    </DefaultLayout>
  );
}
