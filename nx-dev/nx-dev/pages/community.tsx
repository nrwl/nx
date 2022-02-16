import {
  BeakerIcon,
  ChatIcon,
  ClipboardListIcon,
} from '@heroicons/react/solid';
import { Footer, Header } from '@nrwl/nx-dev/ui-common';
import {
  ConnectWithUs,
  PluginDirectory,
  CreateNxPlugin,
} from '@nrwl/nx-dev/ui-community';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';

declare const fetch: any;

interface CommunityProps {
  pluginList: {
    description: string;
    name: string;
    url: string;
  }[];
}

export async function getStaticProps(): Promise<{ props: CommunityProps }> {
  const res = await fetch(
    'https://raw.githubusercontent.com/nrwl/nx/master/community/approved-plugins.json'
  );
  const pluginList = await res.json();
  return {
    props: {
      pluginList,
    },
  };
}

export function Community(props: CommunityProps) {
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
              height: 400,
              alt: 'Nx: Smart, Fast and Extensible Build System',
              type: 'image/jpeg',
            },
          ],
          site_name: 'NxDev',
          type: 'website',
        }}
      />
      <Header useDarkBackground={false} />
      <main>
        <div className="w-full">
          <article
            id="getting-started"
            className="relative bg-gray-50 pt-16 sm:pt-24 lg:pt-32"
          >
            <header className="mx-auto max-w-prose px-4 text-center sm:max-w-3xl sm:px-6 lg:px-8">
              <div>
                <h1 className="text-blue-nx-base text-base font-semibold uppercase tracking-wider">
                  <span className="sr-only">Nx has </span> A strong and dynamic
                  community
                </h1>
                <p className="mt-2 text-4xl font-extrabold tracking-tight text-gray-800 sm:text-6xl">
                  It's always better when we're together.
                </p>
              </div>
            </header>

            <div className="mx-auto px-4 py-16 lg:px-8 lg:py-32 xl:max-w-7xl">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="hover:border-green-nx-base relative rounded-lg border-2 border-white bg-white p-5 shadow-sm transition">
                  <ChatIcon className="text-green-nx-base mb-5 inline-block h-10 w-10" />
                  <h4 className="mb-2 text-lg font-bold">Community</h4>
                  <a className="focus:outline-none" href="#community">
                    <span className="absolute inset-0" aria-hidden="true" />
                    <p className="leading-relaxed text-gray-600">
                      There are many ways you can connect with the open-source
                      Nx community: Slack, Youtube, Twitter and email newsletter
                      are available to keep you on top of all the Nx things!
                    </p>
                  </a>
                </div>
                <div className="relative rounded-lg border-2 border-white bg-white p-5 shadow-sm transition hover:border-blue-500">
                  <BeakerIcon className="mb-5 inline-block h-10 w-10 text-blue-500" />
                  <h4 className="mb-2 text-lg font-bold">
                    Create and Share your own{' '}
                    <span className="sr-only">Nx plugin</span>
                  </h4>
                  <a className="focus:outline-none" href="#create-nx-plugin">
                    <span className="absolute inset-0" aria-hidden="true" />
                    <p className="leading-relaxed text-gray-600">
                      Core Nx plugins are created and maintained by the Nx team
                      at Nrwl but you can easily create your own! Follow our
                      documentation on how to create your own plugin.
                    </p>
                  </a>
                </div>
                <div className="relative rounded-lg border-2 border-white bg-white p-5 shadow-sm transition hover:border-pink-500 sm:col-span-2 lg:col-span-1">
                  <ClipboardListIcon className="mb-5 inline-block h-10 w-10 text-pink-500" />
                  <h4 className="mb-2 text-lg font-bold">
                    Browse the community plugin directory
                  </h4>
                  <a className="focus:outline-none" href="#plugin-directory">
                    <span className="absolute inset-0" aria-hidden="true" />
                    <p className="leading-relaxed text-gray-600">
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

          <div id="connect-with-us" className="relative overflow-hidden py-24">
            <ConnectWithUs />
          </div>

          <div id="create-nx-plugin" className="relative overflow-hidden py-24">
            <CreateNxPlugin />
          </div>

          <div id="plugin-directory" className="relative overflow-hidden py-24">
            <PluginDirectory pluginList={props.pluginList} />
          </div>
        </div>
      </main>
      <Footer useDarkBackground={false} />
    </>
  );
}

export default Community;
