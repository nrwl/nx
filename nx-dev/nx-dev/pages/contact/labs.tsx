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
        description="From expert training to hands-on engineering support, we meet teams where they are and help them move forward with confidence."
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Contact Nx Sales – Discover the Best Solution for Your Team',
          description:
            "Get in touch with Nx experts to learn how we can optimize your development workflow. Whether you're scaling up or seeking enhanced CI performance, our team is here to help.",
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
