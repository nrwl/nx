import {
  MicrophoneIcon,
  VideoCameraIcon,
  ClipboardIcon,
  BookOpenIcon,
} from '@heroicons/react/24/solid';
import { Footer, Header, SectionHeading } from '@nrwl/nx-dev/ui-common';
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
            id="champions"
            className="relative pt-28 pt-16 sm:pt-24 lg:pt-32"
          >
            <header className="mx-auto max-w-prose px-4 text-center sm:max-w-3xl sm:px-6 lg:px-8">
              <div>
                <SectionHeading as="p" variant="title" id="community">
                  The making of
                </SectionHeading>
                <SectionHeading as="h1" variant="display" className="mt-4">
                  Nx Champions
                </SectionHeading>
              </div>
            </header>
            <h2 className="text-lg">
              If you love Nx and want other people to love Nx too, you should
              join the Nx Champions program.
            </h2>
            When you create articles, videos and talks about Nx, we'll promote
            them on our channels. We'll also host a monthly video call to fill
            Nx Champions in on the future direction of Nx and to get your
            feedback on the way you've seen Nx being used in the community.
            <div>
              Here's what you get:
              <ul>
                <li>
                  Recognition in the{' '}
                  <a className="underline" href="/community#nx-champions">
                    Nx Champions directory
                  </a>
                </li>
                <li>
                  Collaborate with other Nx Champions to improve your content
                </li>
                <li>Nx promotes your content on our social media channels</li>
                <li>
                  Nx Champion branded swag for you and Nx stickers to give away
                </li>
                <li>Direct communication with the Nx and Nx Cloud teams</li>
                <li>Monthly video calls with Nx team members</li>
                <li>Rights to run Nx certified workshops</li>
              </ul>
            </div>
            <div>
              How do I join?
              <ol>
                <li>
                  Fill out the{' '}
                  <a className="underline" href="#">
                    application form
                  </a>
                </li>
                <li>
                  Have an informal conversation with an Nx team member to make
                  sure the program is a good fit for you
                </li>
                <li>Go tell people about Nx</li>
              </ol>
            </div>
          </article>
        </div>
      </main>
      <Footer />
    </>
  );
}
