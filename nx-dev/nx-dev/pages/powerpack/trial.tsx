import { useRouter } from 'next/router';
import { NextSeo } from 'next-seo';
import { Footer, Header } from '@nx/nx-dev/ui-common';
import { TrialNxPowerpack } from '@nx/nx-dev/ui-powerpack';
import { type ReactElement } from 'react';

export function PowerpackTrial(): ReactElement {
  const router = useRouter();

  return (
    <>
      <NextSeo
        title="Start Your Nx Powerpack Trial - Speed and Scale for Monorepos"
        description="Unlock self-hosted cache storage, enforce workspace conformance, and manage codeowners for your monorepos. Start your free Nx Powerpack trial today!"
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title:
            'Start Your Nx Powerpack Trial - Speed and Scale for Monorepos',
          description:
            'Unlock self-hosted cache storage, enforce workspace conformance, and manage codeowners for your monorepos. Start your free Nx Powerpack trial today!',
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
        }}
      />
      <Header />
      <main id="main" role="main" className="py-24 lg:py-32">
        <div>
          <TrialNxPowerpack />
        </div>
      </main>
      <Footer />
    </>
  );
}

export default PowerpackTrial;
