import { DefaultLayout } from '@nx/nx-dev/ui-common';
import { Hero, PartnersList } from '@nx/nx-dev/ui-partners';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
import { contactButton } from '../lib/components/headerCtaConfigs';

export function Partners(): JSX.Element {
  const router = useRouter();

  return (
    <>
      <NextSeo
        title="Our Partners"
        description="Partner"
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Partners',
          description: 'Partner ',
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
      <DefaultLayout headerCTAConfig={[contactButton]}>
        <div>
          <Hero />
        </div>
        <div className="mt-16">
          <PartnersList />
        </div>
      </DefaultLayout>
    </>
  );
}

export default Partners;
