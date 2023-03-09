import {
  BeakerIcon,
  BookOpenIcon,
  ChatBubbleLeftEllipsisIcon,
  ClipboardIcon,
  MicrophoneIcon,
  TrophyIcon,
  VideoCameraIcon,
} from '@heroicons/react/24/solid';
import { Footer, Header, SectionHeading } from '@nx/nx-dev/ui-common';
import {
  ConnectWithUs,
  CreateNxPlugin,
  PluginDirectory,
} from '@nx/nx-dev/ui-community';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
import { nxPackagesApi } from '../lib/packages.api';

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
        title="Nx Community and Plugin Listing"
        description="There are many ways you can connect with the open-source Nx community. The community is rich and dynamic offering Nx plugins and help on multiple platforms like GitHub, Slack and Twitter"
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Nx Community and Plugin Listing',
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

            <div className="mx-auto px-4 py-16 lg:px-8 lg:py-32 xl:max-w-7xl">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="relative rounded-lg border border-slate-200 bg-white/60 p-5 shadow-sm transition hover:border-green-500 hover:bg-white dark:border-slate-800/40 dark:bg-slate-800/60 dark:hover:border-green-500 dark:hover:bg-slate-800">
                  <BookOpenIcon className="mb-5 inline-block h-10 w-10 text-green-500" />
                  <h4 className="ml-2 inline-block align-super text-lg font-bold dark:text-slate-300">
                    Articles
                  </h4>
                  <h4 className="mb-2 text-lg font-bold dark:text-slate-300">
                    Learn to Scale React Development with Nx
                  </h4>
                  <img
                    src="https://res.cloudinary.com/practicaldev/image/fetch/s--9qrpxIAn--/c_imagga_scale,f_auto,fl_progressive,h_420,q_auto,w_1000/https://dev-to-uploads.s3.amazonaws.com/uploads/articles/0p7aemoattr29ah6wc8c.png"
                    alt="Article banner"
                  />
                  <a
                    className="focus:outline-none"
                    href="https://dev.to/nothanii/learn-to-scale-react-development-with-nx-1i3k"
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
                    title="Migrate from Lerna to Nx in 1 minute"
                    loading="lazy"
                    className="max-w-screen-sm rounded-lg shadow-lg"
                    width="100%"
                    src="https://www.youtube.com/embed/hEBWdy5gwrM"
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
          </article>

          <div id="connect-with-us" className="py-28">
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
            <ul className="mx-auto grid grid-cols-2 gap-x-4 gap-y-8 py-16 text-center sm:grid-cols-4 md:gap-x-6 lg:max-w-5xl lg:gap-x-8 lg:gap-y-12 xl:grid-cols-4">
              <li>
                <div className="space-y-4">
                  <img
                    className="mx-auto h-20 w-20 rounded-full lg:h-24 lg:w-24"
                    src="/images/testimonials/michael-bromley.jpg"
                    alt="Altan stalker"
                  />
                  <div className="space-y-2">
                    <div className="text-xs font-medium lg:text-sm">
                      <h3 className="mb-2">Altan Stalker</h3>
                      <p className="ml-6 text-left -indent-6 text-slate-400 dark:text-slate-600">
                        🗺️ Atlanta, Georgia, USA
                      </p>
                      <p className="ml-6 text-left -indent-6 text-slate-400 dark:text-slate-600">
                        <a href="https://twitter.com/StalkAltan">
                          🐥 @StalkAltan
                        </a>
                      </p>
                      <p className=" ml-6 text-left -indent-6">
                        💬 I don't often use a monorepo, but when I do, I use
                        Nx.
                      </p>
                    </div>
                  </div>
                </div>
              </li>
              <li>
                <div className="space-y-4">
                  <img
                    className="mx-auto h-20 w-20 rounded-full lg:h-24 lg:w-24"
                    src="/images/testimonials/michael-bromley.jpg"
                    alt="Austin Fahsl"
                  />
                  <div className="space-y-2">
                    <div className="text-xs font-medium lg:text-sm">
                      <h3>Austin Fahsl</h3>
                      <p className="text-slate-400 dark:text-slate-600">
                        Senior Engineer
                      </p>
                    </div>
                  </div>
                </div>
              </li>
              <li>
                <div className="space-y-4">
                  <img
                    className="mx-auto h-20 w-20 rounded-full lg:h-24 lg:w-24"
                    src="/images/testimonials/michael-bromley.jpg"
                    alt="Benjamin Cabanes"
                  />
                  <div className="space-y-2">
                    <div className="text-xs font-medium lg:text-sm">
                      <h3>Benjamin Cabanes</h3>
                      <p className="text-slate-400 dark:text-slate-600">
                        Architect
                      </p>
                    </div>
                  </div>
                </div>
              </li>
              <li>
                <div className="space-y-4">
                  <img
                    className="mx-auto h-20 w-20 rounded-full lg:h-24 lg:w-24"
                    src="/images/testimonials/michael-bromley.jpg"
                    alt="Caitlin Cashin"
                  />
                  <div className="space-y-2">
                    <div className="text-xs font-medium lg:text-sm">
                      <h3>Caitlin Cashin</h3>
                      <p className="text-slate-400 dark:text-slate-600">
                        Developer Marketing Manager
                      </p>
                    </div>
                  </div>
                </div>
              </li>
              <li>
                <div className="space-y-4">
                  <img
                    className="mx-auto h-20 w-20 rounded-full lg:h-24 lg:w-24"
                    src="/images/testimonials/michael-bromley.jpg"
                    alt="Caleb Ukle"
                  />
                  <div className="space-y-2">
                    <div className="text-xs font-medium lg:text-sm">
                      <h3>Caleb Ukle</h3>
                      <p className="text-slate-400 dark:text-slate-600">
                        Senior Engineer
                      </p>
                    </div>
                  </div>
                </div>
              </li>
              <li>
                <div className="space-y-4">
                  <img
                    className="mx-auto h-20 w-20 rounded-full lg:h-24 lg:w-24"
                    src="/images/testimonials/michael-bromley.jpg"
                    alt="Chau Tran"
                  />
                  <div className="space-y-2">
                    <div className="text-xs font-medium lg:text-sm">
                      <h3>Chau Tran</h3>
                      <p className="text-slate-400 dark:text-slate-600">
                        Senior Engineer
                      </p>
                    </div>
                  </div>
                </div>
              </li>
              <li>
                <div className="space-y-4">
                  <img
                    className="mx-auto h-20 w-20 rounded-full lg:h-24 lg:w-24"
                    src="/images/testimonials/michael-bromley.jpg"
                    alt="Chelsea Durso"
                  />
                  <div className="space-y-2">
                    <div className="text-xs font-medium lg:text-sm">
                      <h3>Chelsea Durso</h3>
                      <p className="text-slate-400 dark:text-slate-600">
                        Design Director
                      </p>
                    </div>
                  </div>
                </div>
              </li>
              <li>
                <div className="space-y-4">
                  <img
                    className="mx-auto h-20 w-20 rounded-full lg:h-24 lg:w-24"
                    src="/images/testimonials/michael-bromley.jpg"
                    alt="Colum Ferry"
                  />
                  <div className="space-y-2">
                    <div className="text-xs font-medium lg:text-sm">
                      <h3>Colum Ferry</h3>
                      <p className="text-slate-400 dark:text-slate-600">
                        Senior Engineer
                      </p>
                    </div>
                  </div>
                </div>
              </li>{' '}
            </ul>

            <div className="pb-16">
              <p className="text-center">
                Interested in joining the Nx Champions program yourself?{' '}
                <a className="underline" href="/champions">
                  Find out more about the program
                </a>
              </p>
            </div>
          </article>
        </div>
      </main>
      <Footer />
    </>
  );
}
