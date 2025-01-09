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
        title="Powerpack Trial"
        description="Get started with your Nx Powerpack trial! Unlock a suite of enterprise-grade extensions for the Nx CLI, designed to optimize your development workflows and boost team productivity. Let us help you find the right plan for your needs."
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Powerpack Trial',
          description:
            'Get started with your Nx Powerpack trial! Unlock a suite of enterprise-grade extensions for the Nx CLI, designed to optimize your development workflows and boost team productivity. Let us help you find the right plan for your needs.',
          images: [
            {
              url: 'https://nx.dev/socials/nx-media.png',
              width: 800,
              height: 421,
              alt: 'Nx: Smart Monorepos · Fast CI',
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
