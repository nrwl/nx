'use client';
import {
  ChampionCard,
  ChampionPerks,
  Footer,
  Header,
  SectionHeading,
} from '@nx/nx-dev/ui-common';
import { ConnectWithUs } from '@nx/nx-dev/ui-community';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { champions } from '../lib/champions';

export function ChampionsList(): JSX.Element {
  return (
    <>
      {[...champions]
        .sort(() => 0.5 - Math.random())
        .map((data, index) => (
          <ChampionCard key={data.name} data={data} />
        ))}
    </>
  );
}

const DynamicChampionsList = dynamic(() => Promise.resolve(ChampionsList), {
  ssr: false,
  loading: () => <div></div>,
});

export default function Community(): JSX.Element {
  const router = useRouter();

  return (
    <>
      <NextSeo
        title="Nx Community"
        description="There are many ways you can connect with the open-source Nx community. The community is rich and dynamic offering Nx plugins and help on multiple platforms like GitHub, Discord and Twitter"
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Nx Community',
          description:
            'There are many ways you can connect with the open-source Nx community. The community is rich and dynamic offering Nx plugins and help on multiple platforms like GitHub, Discord and Twitter',
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
      <main id="main" role="main">
        <div className="w-full">
          <div
            id="connect-with-us"
            className="py-18 bg-slate-50 dark:bg-slate-800/40"
          >
            <ConnectWithUs />
          </div>
          <article id="nx-champions" className="relative">
            <div className="mx-auto max-w-7xl items-stretch px-4 py-12 sm:grid sm:grid-cols-1 sm:gap-8 sm:px-6 md:grid-cols-3 lg:px-8 lg:py-16">
              <div className="md:col-span-2">
                <header>
                  <SectionHeading as="h1" variant="subtitle" id="champions">
                    Get to know our
                  </SectionHeading>
                  <SectionHeading
                    as="p"
                    variant="title"
                    id="nx-champions"
                    className="mt-4"
                  >
                    Nx Champions
                  </SectionHeading>
                </header>
                <div className="mt-8 flex gap-16 font-normal">
                  <p className="max-w-xl text-lg text-slate-700 dark:text-slate-400">
                    These friendly people promote Nx in the community by
                    publishing content and sharing their expertise. They also
                    gather feedback from the community to help improve Nx.
                  </p>
                </div>
              </div>
              <DynamicChampionsList />
            </div>
          </article>
          <ChampionPerks />
        </div>
      </main>
      <Footer />
    </>
  );
}
