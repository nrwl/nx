import {
  Footer,
  Header,
  SectionHeading,
  ChampionCard,
  Champion,
  ChampionPerks,
} from '@nx/nx-dev/ui-common';
import { ConnectWithUs } from '@nx/nx-dev/ui-community';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
import { champions1, champions2, champions3 } from '../lib/champions';

interface CommunityProps {}

export default function Community(props: CommunityProps): JSX.Element {
  const router = useRouter();

  return (
    <>
      <NextSeo
        title="Nx Community"
        description="There are many ways you can connect with the open-source Nx community. The community is rich and dynamic offering Nx plugins and help on multiple platforms like GitHub, Slack and Twitter"
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Nx Community',
          description:
            'There are many ways you can connect with the open-source Nx community. The community is rich and dynamic offering Nx plugins and help on multiple platforms like GitHub, Slack and Twitter',
          images: [
            {
              url: 'https://nx.dev/images/nx-media.webp',
              width: 800,
              height: 421,
              alt: 'Nx: Smart, Fast and Extensible Build System',
              type: 'image/jpeg',
            },
          ],
          siteName: 'NxDev',
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
            <div className="mx-auto max-w-7xl items-stretch py-12 px-4 sm:grid sm:grid-cols-1 sm:gap-8 sm:px-6 md:grid-cols-3 lg:py-16 lg:px-8">
              <div className="md:col-span-2">
                <header>
                  <SectionHeading as="h1" variant="title" id="champions">
                    Get to know our
                  </SectionHeading>
                  <SectionHeading
                    as="p"
                    variant="display"
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
                <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2">
                  <div className="space-y-6">
                    {champions1.map((data, index) => (
                      <ChampionCard key={data.name} data={data} />
                    ))}
                  </div>
                  <div className="space-y-6">
                    {champions2.map((data) => (
                      <ChampionCard key={data.name} data={data} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-6 flex h-full w-full flex-col items-start items-stretch gap-6 md:mt-0">
                {champions3.map((data) => (
                  <ChampionCard key={data.name} data={data} />
                ))}
              </div>
            </div>
          </article>
          <ChampionPerks />
        </div>
      </main>
      <Footer />
    </>
  );
}
