import { useRouter } from 'next/router';
import { NextSeo } from 'next-seo';
import { Footer, Header } from '@nx/nx-dev/ui-common';
import { TalkToOurEngineeringTeam } from '@nx/nx-dev/ui-contact';

export function EngineeringTeam(): JSX.Element {
  const router = useRouter();

  return (
    <>
      <NextSeo
        title="Talk to our Developer Productivity Engineers"
        description="Contact our Developer Productivity Engineers for demos, onboarding, and product questions. Share your requirements and challenges with us, and we will help you utilize Nx Enterprise to enhance your organization's product development."
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Talk to our Developer Productivity Engineers',
          description:
            "Contact our Developer Productivity Engineers for demos, onboarding, and product questions. Share your requirements and challenges with us, and we will help you utilize Nx Enterprise to enhance your organization's product development.",
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
          <TalkToOurEngineeringTeam />
        </div>
      </main>
      <Footer />
    </>
  );
}

export default EngineeringTeam;
