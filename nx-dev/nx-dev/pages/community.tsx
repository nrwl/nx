import { Footer, Header, SectionHeading } from '@nx/nx-dev/ui-common';
import { ConnectWithUs } from '@nx/nx-dev/ui-community';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
import { nxPackagesApi } from '../lib/packages.api';
import {
  BookOpenIcon,
  MicrophoneIcon,
  TrophyIcon,
  VideoCameraIcon,
} from '@heroicons/react/24/solid';

declare const fetch: any;

interface PluginInfo {
  description: string;
  name: string;
  url: string;
  isOfficial: boolean;
}
interface CommunityProps {
  pluginList: PluginInfo[];
}

export async function getStaticProps(): Promise<{ props: CommunityProps }> {
  const res = await fetch(
    'https://raw.githubusercontent.com/nrwl/nx/master/community/approved-plugins.json'
  );
  const pluginList = await res.json();

  const officialPluginList = (nxPackagesApi.getRootPackageIndex() ?? []).filter(
    (m) =>
      m.name !== 'create-nx-plugin' &&
      m.name !== 'create-nx-workspace' &&
      m.name !== 'tao'
  );

  return {
    props: {
      pluginList: [
        ...officialPluginList.map((plugin) => ({
          name: plugin.packageName,
          description: plugin.description ?? '',
          url: plugin.path,
          isOfficial: true,
        })),
        ...pluginList.map((plugin) => ({
          ...plugin,
          isOfficial: false,
        })),
      ],
    },
  };
}

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
              url: 'https://nx.dev/images/nx-media.jpg',
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
          <article
            id="getting-started"
            className="relative pt-28 pt-16 sm:pt-24 lg:pt-32"
          >
            <header className="mx-auto max-w-prose px-4 text-center sm:max-w-3xl sm:px-6 lg:px-8">
              <div>
                <SectionHeading as="p" variant="title" id="community">
                  What are people saying about Nx?
                </SectionHeading>
                <SectionHeading as="h1" variant="display" className="mt-4">
                  Community Voices
                </SectionHeading>
              </div>
            </header>

            <div className="mx-auto px-4 py-16 lg:px-8 lg:py-20 xl:max-w-7xl">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="relative rounded-lg border border-slate-200 bg-white/60 p-5 shadow-sm transition hover:border-green-500 hover:bg-white dark:border-slate-800/40 dark:bg-slate-800/60 dark:hover:border-green-500 dark:hover:bg-slate-800">
                  <BookOpenIcon className="mb-5 inline-block h-10 w-10 text-green-500" />
                  <h4 className="ml-2 inline-block align-super text-lg font-bold dark:text-slate-300">
                    Articles
                  </h4>
                  <h4 className="mb-2 text-lg font-bold dark:text-slate-300">
                    Qwik reaches the v1, so does qwik-nx!
                  </h4>
                  <img
                    src="https://res.cloudinary.com/practicaldev/image/fetch/s--sk97LsuS--/c_imagga_scale,f_auto,fl_progressive,h_420,q_auto,w_1000/https://dev-to-uploads.s3.amazonaws.com/uploads/articles/dy6nrd52psalfwl635e7.png"
                    alt="Article banner"
                  />
                  <a
                    className="focus:outline-none"
                    href="https://dev.to/valorsoftware/qwik-reaches-the-v1-so-does-qwik-nx-3l6e"
                  >
                    <span className="absolute inset-0" aria-hidden="true" />
                  </a>
                </div>
                <div className="relative rounded-lg border border-slate-200 bg-white/60 p-5 shadow-sm transition hover:border-blue-500 hover:bg-white dark:border-slate-800/40 dark:bg-slate-800/60 dark:hover:border-sky-500 dark:hover:bg-slate-800">
                  <VideoCameraIcon className="mb-5 inline-block h-10 w-10 text-blue-500 dark:text-sky-500" />
                  <h4 className="ml-2 inline-block align-super text-lg font-bold dark:text-slate-300">
                    Videos
                  </h4>
                  <iframe
                    title="NX For MonoRepos? | Prime Interviews #ad"
                    loading="lazy"
                    className="max-w-screen-sm rounded-lg shadow-lg"
                    width="100%"
                    src="https://www.youtube.com/embed/XKivYCgCMPw"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  />
                </div>
                <div className="relative rounded-lg border border-slate-200 bg-white/60 p-5 shadow-sm transition hover:border-pink-500 hover:bg-white dark:border-slate-800/40 dark:bg-slate-800/60 dark:hover:border-pink-500 dark:hover:bg-slate-800">
                  <MicrophoneIcon className="float-left mb-5 inline-block h-10 w-10 text-pink-500" />
                  <h4 className="ml-2 inline-block align-super text-lg font-bold dark:text-slate-300">
                    Conference Talks
                  </h4>
                  <iframe
                    title="Managing Monorepos with Nx"
                    loading="lazy"
                    className="max-w-screen-sm rounded-lg shadow-lg"
                    width="100%"
                    src="https://www.youtube.com/embed/pPCJZhiZcEw"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  />
                </div>
              </div>
            </div>
          </article>{' '}
          <div id="connect-with-us" className="py-18">
            <ConnectWithUs />
          </div>
          <article
            id="champions"
            className="relative pt-28 pt-16 sm:pt-24 lg:pt-32"
          >
            <header className="mx-auto max-w-prose px-4 text-center sm:max-w-3xl sm:px-6 lg:px-8">
              <div>
                <SectionHeading as="p" variant="title" id="community">
                  Get to know our
                </SectionHeading>
                <SectionHeading as="h1" variant="display" className="mt-4">
                  <TrophyIcon className="mb-2 inline-block h-10 w-10 text-yellow-500" />{' '}
                  Nx Champions{' '}
                  <TrophyIcon className="mb-2 inline-block h-10 w-10 text-yellow-500" />
                </SectionHeading>
              </div>
            </header>
            <ul className="mx-auto grid grid-cols-2 gap-x-4 gap-y-8 py-24 text-center sm:grid-cols-4 md:gap-x-6 lg:max-w-5xl lg:gap-x-8 lg:gap-y-12 xl:grid-cols-4">
              <li>
                <div className="space-y-4">
                  <img
                    className="mx-auto h-20 w-20 rounded-full lg:h-24 lg:w-24"
                    src="/images/champions/william-ghelfi.jpeg"
                    alt="William Ghelfi"
                  />
                  <div className="space-y-2">
                    <div className="text-xs font-medium lg:text-sm">
                      <h3 className="mb-2 text-lg font-bold">William Ghelfi</h3>
                      <p className="ml-6 mb-2 text-left -indent-6 text-slate-400 dark:text-slate-600">
                        🗺️ Italy
                      </p>
                      <p className="ml-6 mb-2 text-left -indent-6 text-slate-400 dark:text-slate-600">
                        💬{' '}
                        <a href="https://twitter.com/trumbitta">
                          Twitter: @trumbitta
                        </a>
                      </p>
                      <p className="ml-6 mb-2 text-left -indent-6">
                        🏆 React, Repository Structure, Patting New Devs On
                        Their Backs
                      </p>
                    </div>
                  </div>
                </div>
              </li>
              <li>
                <div className="space-y-4">
                  <img
                    className="mx-auto h-20 w-20 rounded-full lg:h-24 lg:w-24"
                    src="/images/champions/younes-jaaidi.jpeg"
                    alt="Younes Jaaidi"
                  />
                  <div className="space-y-2">
                    <div className="text-xs font-medium lg:text-sm">
                      <h3 className="mb-2 text-lg font-bold">Younes Jaaidi</h3>
                      <p className="ml-6 mb-2 text-left -indent-6 text-slate-400 dark:text-slate-600">
                        🗺️ France
                      </p>
                      <p className="ml-6 mb-2 text-left -indent-6 text-slate-400 dark:text-slate-600">
                        💬{' '}
                        <a href="mailto:younes@marmicode.io">
                          younes@marmicode.io
                        </a>
                        <br />
                        <a href="https://twitter.com/yjaaidi">
                          Twitter: @yjaaidi
                        </a>
                      </p>
                      <p className="ml-6 mb-2 text-left -indent-6">
                        🏆 Testing, Repository Structure, Angular/React/NestJS
                        Architecture
                      </p>
                    </div>
                  </div>
                </div>
              </li>
              <li>
                <div className="space-y-4">
                  <img
                    className="mx-auto h-20 w-20 rounded-full lg:h-24 lg:w-24"
                    src="/images/champions/lara-newsom.png"
                    alt="Lara Newsom"
                  />
                  <div className="space-y-2">
                    <div className="text-xs font-medium lg:text-sm">
                      <h3 className="mb-2 text-lg font-bold">Lara Newsom</h3>
                      <p className="ml-6 mb-2 text-left -indent-6 text-slate-400 dark:text-slate-600">
                        🗺️ Iowa, USA
                      </p>
                      <p className="ml-6 mb-2 text-left -indent-6 text-slate-400 dark:text-slate-600">
                        💬{' '}
                        <a href="mailto:laramnewsom@gmail.com">
                          laramnewsom@gmail.com
                        </a>
                      </p>
                      <p className="ml-6 mb-2 text-left -indent-6">
                        🏆 I work every day on a large enterprise scale Angular
                        application, so I care a lot about plugins and developer
                        experience
                      </p>
                    </div>
                  </div>
                </div>
              </li>
              <li>
                <div className="space-y-4">
                  <img
                    className="mx-auto h-20 w-20 rounded-full lg:h-24 lg:w-24"
                    src="/images/champions/lars-gyrup-brink-nielsen.png"
                    alt="Lars Gyrup Brink Nielsen"
                  />
                  <div className="space-y-2">
                    <div className="text-xs font-medium lg:text-sm">
                      <h3 className="mb-2 text-lg font-bold">
                        Lars Gyrup Brink Nielsen
                      </h3>
                      <p className="ml-6 mb-2 text-left -indent-6 text-slate-400 dark:text-slate-600">
                        🗺️ Denmark
                      </p>
                      <p className="ml-6 mb-2 text-left -indent-6 text-slate-400 dark:text-slate-600">
                        💬{' '}
                        <a href="mailto:larsbrinknielsen@gmail.com">
                          larsbrinknielsen@gmail.com
                        </a>
                        <br />
                        <a href="https://github.com/LayZeeDK">
                          Github: LayZeeDK
                        </a>
                        <br />
                        <a href="https://mastodon.nu/@LayZee">
                          @LayZee@mastodon.nu
                        </a>
                        <br />
                        <a href="https://linkedin.com/in/larsgbn">
                          LinkedIn: larsgbn
                        </a>
                        <br />
                        <a href="https://dev.to/layzee">Dev.to: layzee</a>
                      </p>
                      <p className="ml-6 mb-2 text-left -indent-6">
                        🏆 Angular, GitHub, .NET, enterprise workspaces, open
                        source, testing, architecture, repository structure,
                        published libraries, documentation
                      </p>
                    </div>
                  </div>
                </div>
              </li>
              <li>
                <div className="space-y-4">
                  <img
                    className="mx-auto h-20 w-20 rounded-full lg:h-24 lg:w-24"
                    src="/images/champions/dominik-pieper.png"
                    alt="Dominik Pieper"
                  />
                  <div className="space-y-2">
                    <div className="text-xs font-medium lg:text-sm">
                      <h3 className="mb-2 text-lg font-bold">Dominik Pieper</h3>
                      <p className="ml-6 mb-2 text-left -indent-6 text-slate-400 dark:text-slate-600">
                        🗺️ Germany
                      </p>
                      <p className="ml-6 mb-2 text-left -indent-6 text-slate-400 dark:text-slate-600">
                        💬{' '}
                        <a href="mailto:dominik@pieper.io">dominik@pieper.io</a>
                        <br />
                        <a href="https://twitter.com/dominik_pieper">
                          Twitter: @dominik_pieper
                        </a>
                      </p>
                      <p className="ml-6 mb-2 text-left -indent-6">
                        🏆 Defining repository structures, creating application
                        architecture with Nx, writing Plugins
                      </p>
                    </div>
                  </div>
                </div>
              </li>
              <li>
                <div className="space-y-4">
                  <img
                    className="mx-auto h-20 w-20 rounded-full lg:h-24 lg:w-24"
                    src="/images/champions/brandon-roberts.jpg"
                    alt="Brandon Roberts"
                  />
                  <div className="space-y-2">
                    <div className="text-xs font-medium lg:text-sm">
                      <h3 className="mb-2 text-lg font-bold">
                        Brandon Roberts
                      </h3>
                      <p className="ml-6 mb-2 text-left -indent-6 text-slate-400 dark:text-slate-600">
                        🗺️ Alabama, USA
                      </p>
                      <p className="ml-6 mb-2 text-left -indent-6 text-slate-400 dark:text-slate-600">
                        💬{' '}
                        <a href="https://twitter.com/brandontroberts">
                          @brandontroberts
                        </a>
                        <br />
                        <a href="https://www.linkedin.com/in/brandontroberts">
                          LinkedIn: brandontroberts
                        </a>
                      </p>
                      <p className="ml-6 mb-2 text-left -indent-6">
                        🏆 Onboarding New Devs, Angular, Vite, Plugins
                      </p>
                    </div>
                  </div>
                </div>
              </li>
              <li>
                <div className="space-y-4">
                  <img
                    className="mx-auto h-20 w-20 rounded-full lg:h-24 lg:w-24"
                    src="/images/champions/santosh-yadav.jpg"
                    alt="Santosh Yadav"
                  />
                  <div className="space-y-2">
                    <div className="text-xs font-medium lg:text-sm">
                      <h3 className="mb-2 text-lg font-bold">Santosh Yadav</h3>
                      <p className="ml-6 mb-2 text-left -indent-6 text-slate-400 dark:text-slate-600">
                        🗺️ Germany
                      </p>
                      <p className="ml-6 mb-2 text-left -indent-6 text-slate-400 dark:text-slate-600">
                        <span className="whitespace-nowrap">
                          💬{' '}
                          <a href="mailto:santosh.yadav198613@gmail.com">
                            santosh.yadav198613@gmail.com
                          </a>
                        </span>
                        <br />
                        <a href="https://github.com/santoshyadavdev">
                          Github: santoshyadavdev
                        </a>
                      </p>
                      <p className="ml-6 mb-2 text-left -indent-6">
                        🏆 Onboarding new devs, Repository Structure, Dev
                        Advocacy, Dev Rel, knowledge sharing
                      </p>
                    </div>
                  </div>
                </div>
              </li>
            </ul>

            <div className="pb-16 lg:max-w-5xl mx-auto">
              <h3 className="text-lg font-bold text-center mb-4">
                Interested in joining the Nx Champions program yourself?
              </h3>
              <p className="mb-2">
                If you love Nx and want other people to love Nx too, you may
                have the makings of an Nx Champion.
              </p>
              <p className="mb-4">
                When you create articles, videos and talks about Nx, we'll
                promote them on our channels. We'll also host a monthly video
                call to fill Nx Champions in on the future direction of Nx and
                to get your feedback on the way you've seen Nx being used in the
                community.
              </p>
              <div className="mb-4">
                <h4 className="font-bold">Here's what you get:</h4>
                <ul>
                  <li className="list-disc ml-6">
                    Recognition in the{' '}
                    <a className="underline" href="/community#nx-champions">
                      Nx Champions directory
                    </a>
                  </li>
                  <li className="list-disc ml-6">
                    Collaborate with other Nx Champions to improve your content
                  </li>
                  <li className="list-disc ml-6">
                    Nx promotes your content on our social media channels
                  </li>
                  <li className="list-disc ml-6">
                    Nx Champion branded swag for you and Nx stickers to give
                    away
                  </li>
                  <li className="list-disc ml-6">
                    Direct communication with the Nx and Nx Cloud teams
                  </li>
                  <li className="list-disc ml-6">
                    Monthly video calls with Nx team members
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold">How do I join?</h4>
                <ol>
                  <li className="list-decimal ml-6">
                    Fill out the{' '}
                    <a
                      className="underline"
                      href="https://forms.gle/wYd9mC3ka64ki96G7"
                    >
                      application form
                    </a>
                  </li>
                  <li className="list-decimal ml-6">
                    Have an informal conversation with an Nx team member to make
                    sure the program is a good fit for you
                  </li>
                  <li className="list-decimal ml-6">Go tell people about Nx</li>
                </ol>
              </div>{' '}
            </div>
          </article>{' '}
        </div>
      </main>
      <Footer />
    </>
  );
}
