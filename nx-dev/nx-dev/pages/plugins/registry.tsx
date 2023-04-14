import { Footer, Header } from '@nrwl/nx-dev/ui-common';
import { CreateNxPlugin, PluginDirectory } from '@nrwl/nx-dev/ui-community';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
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
    },
  };
}

export default function Browse(props: BrowseProps): JSX.Element {
  const router = useRouter();

  return (
    <>
      <NextSeo
        title="Nx Plugin Listing"
        description="Browse the list of Nx Plugins"
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Nx Plugin Listing',
          description: 'Browse the list of Nx Plugins',
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
          <div id="plugin-directory" className="py-28">
            <PluginDirectory pluginList={props.pluginList} />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
