import { getBasicNxSection } from '@nx/nx-dev/data-access-menu';
import { MenuItem } from '@nx/nx-dev/models-menu';
import {
  Breadcrumbs,
  DocumentationHeader,
  Footer,
  PluginType,
  SidebarContainer,
} from '@nx/nx-dev/ui-common';
import { PluginDirectory } from '@nx/nx-dev/ui-community';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
import { menusApi } from '../lib/menus.api';
import { useNavToggle } from '../lib/navigation-toggle.effect';
import { nxPackagesApi } from '../lib/packages.api';
import { ScrollableContent } from '@nx/ui-scrollable-content';

declare const fetch: any;
let qualityIndicators = require('./quality-indicators.json');

interface PluginInfo {
  description: string;
  name: string;
  url: string;
  pluginType: PluginType;
}
interface BrowseProps {
  pluginList: PluginInfo[];
  menu: MenuItem[];
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
          ...qualityIndicators[plugin.packageName],
          nxVersion: 'official',
          pluginType: plugin.name?.startsWith('powerpack-')
            ? 'nxPowerpack'
            : 'nxOpenSource',
        })),
        ...pluginList.map((plugin) => ({
          ...plugin,
          ...qualityIndicators[plugin.name],
          pluginType: 'community',
        })),
      ],
      menu: menusApi.getMenu('nx', ''),
    },
  };
}

export default function Browse(props: BrowseProps): JSX.Element {
  const router = useRouter();
  const { toggleNav, navIsOpen } = useNavToggle();

  const menu = {
    sections: [getBasicNxSection(props.menu)],
  };

  return (
    <>
      <NextSeo
        title="Nx Plugin Registry"
        description="Nx Plugins enhance the developer experience in you workspace to make your life simpler. Browse the list of available Nx Plugins."
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Nx Plugin Registry',
          description:
            'Nx Plugins enhance the developer experience in you workspace to make your life simpler. Browse the list of available Nx Plugins.',
          images: [
            {
              url: 'https://nx.dev/images/nx-media.jpg',
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
      <div id="shell" className="flex h-full flex-col">
        <div className="w-full flex-shrink-0">
          <DocumentationHeader isNavOpen={navIsOpen} toggleNav={toggleNav} />
        </div>
        <main
          id="main"
          role="main"
          className="flex h-full flex-1 overflow-y-hidden"
        >
          <div className="hidden">
            <SidebarContainer
              menu={menu}
              navIsOpen={navIsOpen}
              toggleNav={toggleNav}
            />
          </div>
          <ScrollableContent>
            <div className="mx-auto w-full grow items-stretch px-4 sm:px-6 lg:px-8 2xl:max-w-6xl">
              <div id="content-wrapper" className="w-full flex-auto flex-col">
                <div className="mb-6 pt-8">
                  <Breadcrumbs path={router.asPath} />
                </div>
                <div className="min-w-0 flex-auto">
                  <PluginDirectory pluginList={props.pluginList} />
                </div>
                <div className="pb-24 lg:pb-16">
                  <p>
                    Are you a plugin author? You can{' '}
                    <a
                      className="underline"
                      href="/extending-nx/recipes/publish-plugin#list-your-nx-plugin"
                    >
                      add your plugin to the registry
                    </a>{' '}
                    with a few simple steps.
                  </p>
                </div>
              </div>
            </div>

            <Footer />
          </ScrollableContent>
        </main>
      </div>
    </>
  );
}
