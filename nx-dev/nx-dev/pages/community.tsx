import {
  BeakerIcon,
  ChatIcon,
  ClipboardListIcon,
} from '@heroicons/react/solid';
import { Footer, Header } from '@nrwl/nx-dev/ui-common';
import {
  ConnectWithUs,
  CreateNxPlugin,
  PluginDirectory,
} from '@nrwl/nx-dev/ui-community';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
import { ReactComponentElement } from 'react';

declare const fetch: any;

interface CommunityProps {
  pluginList: {
    description: string;
    name: string;
    url: string;
    isOfficial: boolean;
  }[];
}

export async function getStaticProps(): Promise<{ props: CommunityProps }> {
  const res = await fetch(
    'https://raw.githubusercontent.com/nrwl/nx/master/community/approved-plugins.json'
  );
  const pluginList = await res.json();
  return {
    props: {
      pluginList: pluginList.map((plugin) => ({
        ...plugin,
        isOfficial: false,
      })),
    },
  };
}

export function Community(props: CommunityProps): ReactComponentElement<any> {
  const firstPartyPlugins = [
    {
      description:
        'Integration with libraries such as Storybook, Jest, Cypress, NgRx, Micro-frontend...',
      name: '@nrwl/angular',
      url: 'https://nx.dev/angular/overview',
      isOfficial: true,
    },
    {
      description: 'Cypress is an e2e test runner built for modern web.',
      name: '@nrwl/cypress',
      url: 'https://nx.dev/cypress/overview',
      isOfficial: true,
    },
    {
      description:
        'Detox is gray box end-to-end testing and automation library for mobile apps.',
      name: '@nrwl/detox',
      url: 'https://nx.dev/detox/overview',
      isOfficial: true,
    },
    {
      description:
        'It contains many utility functions for reading and writing files, updating configuration, working with Abstract Syntax Trees(ASTs), and more.',
      name: '@nrwl/devkit',
      url: 'https://nx.dev/nx-devkit/index',
      isOfficial: true,
    },
    {
      description:
        'ESLint is powerful linter by itself, able to work on the syntax of your source files and assert things about based on the rules you configure.',
      name: '@nrwl/eslint-plugin-nx',
      url: 'https://nx.dev/guides/eslint#using-eslint-in-nx-workspaces',
      isOfficial: true,
    },
    {
      description:
        'Express is mature, minimal, and an open source web framework for making web applications and apis.',
      name: '@nrwl/express',
      url: 'https://nx.dev/express/overview',
      isOfficial: true,
    },
    {
      description: 'Jest is an open source test runner created by Facebook.',
      name: '@nrwl/jest',
      url: 'https://nx.dev/jest/overview',
      isOfficial: true,
    },
    {
      description:
        'Contains executors and generators that are useful for JavaScript/TypeScript projects in an Nx workspace.',
      name: '@nrwl/js',
      url: 'https://nx.dev/js/overview',
      isOfficial: true,
    },
    {
      description:
        'Contains executors, generator, plugin and utilities used for linting JavaScript/TypeScript projects within an Nx workspace.',
      name: '@nrwl/linter',
      url: 'https://nx.dev/linter/overview',
      isOfficial: true,
    },
    {
      description:
        'Nest.js is a framework designed for building scalable server-side applications.',
      name: '@nrwl/nest',
      url: 'https://nx.dev/nest/overview',
      isOfficial: true,
    },
    {
      description:
        'The Next.js plugin contains executors and generators for managing Next.js applications and libraries within an Nx workspace.',
      name: '@nrwl/next',
      url: 'https://nx.dev/next/overview',
      isOfficial: true,
    },
    {
      description:
        'Contains generators and executors to manage Node applications within an Nx workspace.',
      name: '@nrwl/node',
      url: 'https://nx.dev/node/overview',
      isOfficial: true,
    },
    {
      description: 'Distributed caching and analytics for your Nx Workspace.',
      name: '@nrwl/nx-cloud',
      url: 'https://nx.app/',
      isOfficial: true,
    },
    {
      description:
        'Contains executors and generators for managing React applications and libraries within an Nx workspace.',
      name: '@nrwl/react',
      url: 'https://nx.dev/react/overview',
      isOfficial: true,
    },
    {
      description:
        "React Native brings React's declarative UI framework to iOS and Android.",
      name: '@nrwl/react-native',
      url: 'https://nx.dev/react-native/overview',
      isOfficial: true,
    },
    {
      description: 'Storybook is a development environment for UI components.',
      name: '@nrwl/storybook',
      url: 'https://nx.dev/storybook/overview-react',
      isOfficial: true,
    },
    {
      description:
        'Contains generators for managing Web Component applications and libraries within an Nx workspace.',
      name: '@nrwl/web',
      url: 'https://nx.dev/web/overview',
      isOfficial: true,
    },
    {
      description:
        'Contains executors and generators that are useful for any Nx workspace. It should be present in every Nx workspace and other plugins build on it.',
      name: '@nrwl/workspace',
      url: 'https://nx.dev/workspace/nrwl-workspace-overview',
      isOfficial: true,
    },
  ];
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
            <PluginDirectory
              pluginList={firstPartyPlugins.concat(props.pluginList)}
            />
          </div>
        </div>
      </main>
      <Footer useDarkBackground={false} />
    </>
  );
}

export default Community;
