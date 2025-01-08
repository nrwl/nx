import { useRouter } from 'next/router';
import { NextSeo } from 'next-seo';
import { Footer, Header } from '@nx/nx-dev/ui-common';
import { TrialNxEnterprise } from '@nx/nx-dev/ui-enterprise';

export function EnterpriseTrial(): JSX.Element {
  const router = useRouter();

  return (
    <>
      <NextSeo
        title="Nx Enterprise Trial"
        description="We’re here to help you find the right plan and pricing for your needs and discuss how Nx Cloud Enterprise can drive better business outcomes for your organization."
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Nx Enterprise Trial',
          description:
            'We’re here to help you find the right plan and pricing for your needs and discuss how Nx Cloud Enterprise can drive better business outcomes for your organization.',
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
