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
        title="Nx Enterprise Trial"
        description="Accelerate your organization's journey to tighter collaboration, improved developer experience, and faster, more efficient workflows. Start your enterprise trial today and see the difference."
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Nx Enterprise Trial',
          description:
            "Accelerate your organization's journey to tighter collaboration, improved developer experience, and faster, more efficient workflows. Start your enterprise trial today and see the difference.",
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
          <TrialNxEnterprise />
        </div>
      </main>
      <Footer />
    </>
  );
}

export default EnterpriseTrial;
