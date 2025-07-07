import { useRouter } from 'next/router';
import { NextSeo } from 'next-seo';
import { Footer, Header } from '@nx/nx-dev/ui-common';
import { TrialNxEnterprise } from '@nx/nx-dev/ui-enterprise';
import { type ReactElement } from 'react';

export function EnterpriseTrial(): ReactElement {
  const router = useRouter();

  return (
    <>
      <NextSeo
        title="Try Nx Enterprise - Scalable CI Solutions for Your Team"
        description="Request a free Nx Enterprise trial to experience advanced CI features and premium support, designed to help your team ship faster and more reliably."
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Try Nx Enterprise - Scalable CI Solutions for Your Team',
          description:
            'Request a free Nx Enterprise trial to experience advanced CI features and premium support, designed to help your team ship faster and more reliably.',
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
          <TrialNxEnterprise />
        </div>
      </main>
      <Footer />
    </>
  );
}

export default EnterpriseTrial;
