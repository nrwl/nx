import { useRouter } from 'next/router';
import { NextSeo } from 'next-seo';
import {
  Layout,
  Hero,
  TrustedBy,
  FasterAndCheaper,
  UnderstandWorkspace,
  EnhancedWithAi,
  AutomatedAgentsManagement,
  AgentNumberOverTime,
  Statistics,
  CallToAction,
} from '@nx/nx-dev/ui-cloud';

export default function NxCloud() {
  const router = useRouter();

  return (
    <>
      <NextSeo
        title="Nx Cloud"
        description="Nx Cloud is the end-to-end solution for smart, efficient and
          maintainable CI."
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Nx Cloud',
          description:
            'Nx Cloud is the end-to-end solution for smart, efficient and maintainable CI',
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
      <Layout>
        <div>
          <Hero />
          <TrustedBy />
        </div>
        <div className="mt-32 lg:mt-56">
          <FasterAndCheaper />
        </div>
        <div className="mt-32 lg:mt-56">
          <UnderstandWorkspace />
        </div>
        <div className="mt-32 lg:mt-56">
          <EnhancedWithAi />
        </div>
        <div className="mt-32 lg:mt-56">
          <AutomatedAgentsManagement />
        </div>
        <div className="mt-32 lg:mt-56">
          <AgentNumberOverTime />
        </div>
        <div className="mt-32 lg:mt-56">
          <Statistics />
        </div>
        <div className="mt-32 lg:mt-56">
          <CallToAction />
        </div>
      </Layout>
    </>
  );
}
