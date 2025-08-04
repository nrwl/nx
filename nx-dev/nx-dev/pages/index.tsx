import { CallToAction, DefaultLayout } from '@nx/nx-dev-ui-common';
import { NextSeo } from 'next-seo';
import {
  CiForMonorepos,
  Hero,
  HetznerCloudTestimonial,
  MonorepoAiSupport,
  SmarterToolsForMonorepos,
  Statistics,
  TeamAndCommunity,
  WorkBetterAchieveMoreShipQuicker,
  Problem,
  Solution,
  FeaturesWhileCoding,
  FeaturesWhileRunningCI,
  FeaturesWhileScalingYourOrganization,
  WrapUpCta,
  CallToActionJuriGraphic,
  Features,
} from '@nx/nx-dev-ui-home';
import { contactButton } from '../lib/header-cta.configs';

export default function Index(): JSX.Element {
  const headerCTAConfig = [contactButton];

  return (
    <>
      <NextSeo
        title="Nx: Smart Repos · Fast Builds"
        description="Build system, optimized for monorepos, with plugins for popular frameworks and tools and advanced CI capabilities including caching and distribution."
        openGraph={{
          url: 'https://nx.dev',
          title: 'Nx: Smart Repos · Fast Builds',
          description:
            'An AI-first build platform that connects everything from your editor to CI. Helping you deliver fast, without breaking things.',
          images: [
            {
              url: 'https://nx.dev/socials/nx-media.png',
              width: 1200,
              height: 600,
              alt: 'Nx: Smart Repos · Fast Builds',
              type: 'image/png',
            },
          ],
          siteName: 'Nx',
          type: 'website',
        }}
      />
      <h1 className="sr-only">Build system with advanced CI capabilities.</h1>
      <DefaultLayout isHome headerCTAConfig={headerCTAConfig}>
        <Hero />
        <div className="mt-16 lg:mt-40">
          <Statistics />
        </div>
        <div className="mt-32 lg:mt-56">
          <Problem />
        </div>
        <div className="bg-white/50 bg-[url(/images/home/wave.svg)] bg-cover bg-center py-32 bg-blend-soft-light lg:py-56 dark:bg-slate-900/50 dark:bg-[url(/images/home/wave-dark.svg)] dark:bg-blend-darken">
          <Solution />
        </div>

        <Features />

        <div className="mt-32 lg:mt-40">
          <HetznerCloudTestimonial />
        </div>
        <div className="mt-32 lg:mt-56">
          <TeamAndCommunity />
        </div>
        <div className="mb-32 mt-32 lg:mt-56">
          <CallToAction />
        </div>
      </DefaultLayout>
    </>
  );
}
