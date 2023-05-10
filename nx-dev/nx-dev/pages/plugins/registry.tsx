import { getBasicPluginsSection } from '@nx/nx-dev/data-access-menu';
import { Menu } from '@nx/nx-dev/models-menu';
import {
  Breadcrumbs,
  DocumentationHeader,
  Footer,
  SidebarContainer,
} from '@nx/nx-dev/ui-common';
import { PluginDirectory } from '@nx/nx-dev/ui-community';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
import { useRef } from 'react';
import { menusApi } from '../../lib/menus.api';
import { useNavToggle } from '../../lib/navigation-toggle.effect';
import { nxPackagesApi } from '../../lib/packages.api';

declare const fetch: any;

interface PluginInfo {
  description: string;
  name: string;
  url: string;
  isOfficial: boolean;
}
interface BrowseProps {
  pluginList: PluginInfo[];
  // segments: string[];
}

export async function getStaticProps(): Promise<{ props: BrowseProps }> {
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
      // segments,
    },
  };
}

export default function Browse(props: BrowseProps): JSX.Element {
  const router = useRouter();
  const { toggleNav, navIsOpen } = useNavToggle();
  const wrapperElement = useRef(null);

  const vm: {
    menu: Menu;
  } = {
    menu: {
      sections: [getBasicPluginsSection(menusApi.getMenu('plugins', ''))],
    },
  };

  return (
    <>
      <NextSeo
        title="Nx Plugin Listing"
        description="Nx Plugins enhance the developer experience in you workspace to make your life simpler. Browse the list of available Nx Plugins."
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Nx Plugin Listing',
          description:
            'Nx Plugins enhance the developer experience in you workspace to make your life simpler. Browse the list of available Nx Plugins.',
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
      <div id="shell" className="flex h-full flex-col">
        <div className="w-full flex-shrink-0">
          <DocumentationHeader isNavOpen={navIsOpen} toggleNav={toggleNav} />
        </div>
        <main
          id="main"
          role="main"
          className="flex h-full flex-1 overflow-y-hidden"
        >
          <SidebarContainer menu={vm.menu} navIsOpen={navIsOpen} />
          <div
            ref={wrapperElement}
            id="wrapper"
            data-testid="wrapper"
            className="relative flex flex-grow flex-col items-stretch justify-start overflow-y-scroll"
          >
            <div className="mx-auto w-full grow items-stretch px-4 sm:px-6 lg:px-8 2xl:max-w-6xl">
              <div id="content-wrapper" className="w-full flex-auto flex-col">
                <div className="mb-6 pt-8">
                  <Breadcrumbs path={router.asPath} />
                </div>
                <div className="min-w-0 flex-auto pb-24 lg:pb-16">
                  <PluginDirectory pluginList={props.pluginList} />
                </div>
              </div>
            </div>

            <Footer />
          </div>
        </main>
      </div>
    </>
  );
}
