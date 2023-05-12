import { TrophyIcon } from '@heroicons/react/24/solid';
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

interface CommunityProps {}

export default function Community(props: CommunityProps): JSX.Element {
  const router = useRouter();

  const champions1: Champion[] = [
    {
      name: 'William Ghelfi',
      expertise: 'React, Repository Structure, Patting New Devs On Their Backs',
      imageUrl: '/images/champions/william-ghelfi.webp',
      contact: [
        {
          label: '@trumbitta',
          link: 'https://twitter.com/trumbitta',
        },
        {
          label: '@williamghelfi.com',
          link: 'https://bsky.app/profile/williamghelfi.com',
        },
      ],
      location: 'Italy',
    },
    {
      name: 'Santosh Yadav',
      expertise:
        'Onboarding new devs, Repository Structure, Dev Advocacy, Dev Rel, knowledge sharing',
      imageUrl: '/images/champions/santosh-yadav.webp',
      contact: [
        {
          label: 'santosh.yadav198613@gmail.com',
          link: 'mailto:santosh.yadav198613@gmail.com',
        },
        {
          label: 'github.com/santoshyadavdev',
          link: 'https://github.com/santoshyadavdev',
        },
      ],
      location: 'Germany',
    },
    {
      name: 'Lars Gyrup Brink Nielsen',
      expertise:
        'Angular, GitHub, .NET, enterprise workspaces, open source, testing, architecture, repository structure, published libraries, documentation',
      imageUrl: '/images/champions/lars-gyrup-brink-nielsen.webp',
      contact: [
        {
          label: 'larsbrinknielsen@gmail.com',
          link: 'mailto:larsbrinknielsen@gmail.com',
        },
      ],
      location: 'Denmark',
    },
  ];
  const champions2: Champion[] = [
    {
      name: 'Dominik Pieper',
      expertise:
        'Defining repository structures, creating application architecture with Nx, writing  Plugins',
      imageUrl: '/images/champions/dominik-pieper.webp',
      contact: [
        {
          label: 'dominik@pieper.io',
          link: 'mailto:dominik@pieper.io',
        },
      ],
      location: 'Germany',
    },
    {
      name: 'Brandon Roberts',
      expertise: 'Onboarding New Devs, Angular, Vite, Plugins',
      imageUrl: '/images/champions/brandon-roberts.webp',
      contact: [
        {
          label: '@brandontroberts',
          link: 'https://twitter.com/brandontroberts',
        },
        {
          label: 'LinkedIn: brandontroberts',
          link: 'https://www.linkedin.com/in/brandontroberts',
        },
      ],
      location: 'Alabama, USA',
    },
    {
      name: 'Younes Jaaidi',
      expertise:
        'Testing, Repository Structure, Angular/React/NestJS Architecture',
      imageUrl: '/images/champions/younes-jaaidi.webp',
      contact: [
        {
          label: 'younes@marmicode.io',
          link: 'mailto:younes@marmicode.io',
        },
        {
          label: '@yjaaidi',
          link: 'https://twitter.com/yjaaidi',
        },
      ],
      location: 'France',
    },
    {
      name: 'Manfred Steyer',
      expertise:
        'Angular, Blogs, Talks, Conferences, Plugins, Repository Structure',
      imageUrl: '/images/champions/manfred-steyer.webp',
      contact: [
        {
          label: 'manfred.steyer@angulararchitects.io',
          link: 'mailto:manfred.steyer@angulararchitects.io',
        },
      ],
      location: 'Austria',
    },
  ];
  const champions3: Champion[] = [
    {
      name: 'Lara Newsom',
      expertise:
        'I work every day on a large enterprise scale Angular application, so I care a lot about plugins and developer experience',
      imageUrl: '/images/champions/lara-newsom.webp',
      contact: [
        {
          label: 'laramnewsom@gmail.com',
          link: 'mailto:laramnewsom@gmail.com',
        },
      ],
      location: 'Iowa, USA',
    },
    {
      name: 'Kate Sky',
      expertise:
        'Nx + Angular best practices in Enterprise multi-team environment and micro-frontend architecture',
      imageUrl: '/images/champions/kate-sky.webp',
      contact: [
        {
          label: '@KateSky8',
          link: 'https://twitter.com/KateSky8',
        },
      ],
      location: 'USA',
    },
    {
      name: 'Shai Reznik',
      expertise: 'Writing plugins, Qwik, testing',
      imageUrl: '/images/champions/shai-reznik.webp',
      contact: [
        {
          label: '@shai_reznik',
          link: 'https://twitter.com/shai_reznik',
        },
      ],
      location: 'Israel',
    },
    {
      name: 'Issam GUISSOUMA',
      expertise: 'IDE support',
      imageUrl: '/images/champions/issam-guissouma.webp',
      contact: [
        {
          label: '@iguissouma',
          link: 'https://twitter.com/iguissouma',
        },
      ],
      location: 'France',
    },
    {
      name: 'Devin Shoemaker',
      expertise:
        'Writing plugins and being the resident Nx enthusiast at Ionic',
      imageUrl: '/images/champions/devin-shoemaker.webp',
      contact: [
        {
          label: '@ParanoidCoder',
          link: 'https://twitter.com/ParanoidCoder',
        },
      ],
      location: 'Missouri, USA',
    },
  ];

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
