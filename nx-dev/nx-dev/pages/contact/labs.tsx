import { useRouter } from 'next/router';
import { NextSeo } from 'next-seo';
import { Footer, Header } from '@nx/nx-dev/ui-common';
import { NxLabsContact } from '@nx/nx-dev/ui-contact';
import { type ReactElement } from 'react';

export function ContactNxLabs(): ReactElement {
  const router = useRouter();

  return (
    <>
      <NextSeo
        title="Contact Nx Labs"
        description="Accelerate Your Nx Adoption with Expert Guidance"
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Contact Nx Labs',
          description: 'Accelerate Your Nx Adoption with Expert Guidance',
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
          <NxLabsContact />
        </div>
      </main>
      <Footer />
    </>
  );
}

export default ContactNxLabs;
