import {
  BeakerIcon,
  ChatBubbleLeftEllipsisIcon,
  ClipboardIcon,
} from '@heroicons/react/24/solid';
import { Footer, Header } from '@nrwl/nx-dev/ui-common';
import {
  ConnectWithUs,
  CreateNxPlugin,
  PluginDirectory,
} from '@nrwl/nx-dev/ui-community';
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
      m.name !== 'add-nx-to-monorepo' &&
      m.name !== 'cra-to-nx' &&
      m.name !== 'create-nx-plugin' &&
      m.name !== 'create-nx-workspace' &&
      m.name !== 'make-angular-cli-faster' &&
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
        description="There are many ways you can connect with the open-source Nx community. The community is rich and dynamic offering Nx plugins and help on multiple platforms like Github, Slack and Twitter"
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Nx Community and Plugin Listing',
          description:
            'There are many ways you can connect with the open-source Nx community. The community is rich and dynamic offering Nx plugins and help on multiple platforms like Github, Slack and Twitter',
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
                <h1 className="text-lg font-semibold tracking-tight text-blue-500 dark:text-sky-500">
                  <span className="sr-only">Nx has </span> A strong and dynamic
                  community
                </h1>
                <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl">
                  It's always better when we're together.
                </p>
              </div>
            </header>

            <div className="mx-auto px-4 py-16 lg:px-8 lg:py-32 xl:max-w-7xl">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="relative rounded-lg border border-slate-200 bg-white/60 p-5 shadow-sm transition hover:border-green-500 hover:bg-white dark:border-slate-800/40 dark:bg-slate-800/60 dark:hover:border-green-500 dark:hover:bg-slate-800">
                  <ChatBubbleLeftEllipsisIcon className="mb-5 inline-block h-10 w-10 text-green-500" />
                  <h4 className="mb-2 text-lg font-bold dark:text-slate-300">
                    Community
                  </h4>
                  <a className="focus:outline-none" href="#community">
                    <span className="absolute inset-0" aria-hidden="true" />
                    <p className="leading-relaxed">
                      There are many ways you can connect with the open-source
                      Nx community: Slack, Youtube, Twitter and email newsletter
                      are available to keep you on top of all the Nx things!
                    </p>
                  </a>
                </div>
                <div className="relative rounded-lg border border-slate-200 bg-white/60 p-5 shadow-sm transition hover:border-blue-500 hover:bg-white dark:border-slate-800/40 dark:bg-slate-800/60 dark:hover:border-sky-500 dark:hover:bg-slate-800">
                  <BeakerIcon className="mb-5 inline-block h-10 w-10 text-blue-500 dark:text-sky-500" />
                  <h4 className="mb-2 text-lg font-bold">
                    Create and Share your own{' '}
                    <span className="sr-only">Nx plugin</span>
                  </h4>
                  <a className="focus:outline-none" href="#create-nx-plugin">
                    <span className="absolute inset-0" aria-hidden="true" />
                    <p className="leading-relaxed">
                      Official Nx plugins are created and maintained by the Nx
                      team at Nrwl but you can easily create your own! Follow
                      our documentation on how to create your own plugin.
                    </p>
                  </a>
                </div>
                <div className="relative rounded-lg border border-slate-200 bg-white/60 p-5 shadow-sm transition hover:border-pink-500 hover:bg-white dark:border-slate-800/40 dark:bg-slate-800/60 dark:hover:border-pink-500 dark:hover:bg-slate-800">
                  <ClipboardIcon className="mb-5 inline-block h-10 w-10 text-pink-500" />
                  <h4 className="mb-2 text-lg font-bold">
                    Browse the community plugin directory
                  </h4>
                  <a className="focus:outline-none" href="#plugin-directory">
                    <span className="absolute inset-0" aria-hidden="true" />
                    <p className="leading-relaxed">
                      Check all the community plugins available for Nx! These
                      plugins have been approved by the Nx core team, are well
                      maintained and regularly updated to make sure they work
                      with the latest versions.
                    </p>
                  </a>
                </div>
              </div>
            </div>
          </article>

          <div id="connect-with-us" className="py-28">
            <ConnectWithUs />
          </div>

          <div id="create-nx-plugin" className="py-28">
            <CreateNxPlugin />
          </div>

          <div id="plugin-directory" className="py-28">
            <PluginDirectory pluginList={props.pluginList} />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
