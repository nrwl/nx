import { useRouter } from 'next/router';
import { NextSeo } from 'next-seo';
import { Footer, Header } from '@nx/nx-dev/ui-common';
import { ContactLinks, HowCanWeHelp } from '@nx/nx-dev/ui-contact';

export function Contact(): JSX.Element {
  const router = useRouter();

  return (
    <>
      <NextSeo
        title="Contact us"
        description="There are many ways you can connect with the open-source Nx community. Let's connect together!"
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Contact us',
          description:
            "There are many ways you can connect with the open-source Nx community. Let's connect together!",
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
        }}
      />
      <Header />
      <main id="main" role="main" className="py-24 lg:py-32">
        <div>
          <HowCanWeHelp />
        </div>
        <div className="mt-32">
          <ContactLinks />
        </div>
      </main>
      <Footer />
    </>
  );
}

export default Contact;
