import type { Metadata } from 'next';
import { DefaultLayout } from '@nx/nx-dev/ui-common';
import { Hero, SquareDottedPattern, TermsAndDefinitions } from '@nx/nx-dev/ui-terms';

export const metadata: Metadata = {
  title: 'Nx Terms of Service',
  description:
    "These Terms of Service reflect the way Nx Cloud's business works, the laws that apply to our company.",
  openGraph: {
    url: 'https://nx.dev/terms',
    title: 'Nx Terms of Service',
    description:
      "These Terms of Service reflect the way Nx Cloud's business works, the laws that apply to our company.",
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

export default function TermsPage() {
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
            <Hero />
            <TermsAndDefinitions />
        </article>
      </div>
    </DefaultLayout>
  );
}
