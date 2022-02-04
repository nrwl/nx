import Image from 'next/image';
import Link from 'next/link';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
import { Footer, Header, PluginCard } from '@nrwl/nx-dev/ui-common';

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
      <Header useDarkBackground={false} showSearch={false} />
      <main>
        <div className="w-full">
          {/*Intro component*/}
          <div className="bg-gray-50">
            <div className="max-w-screen mx-auto px-5 py-5 xl:max-w-screen-xl">
              <div className="mt-40">
                <h1 className="leading none mt-10 mb-8 text-4xl font-extrabold tracking-tight text-gray-900 sm:mt-14 sm:mb-10 sm:text-6xl lg:text-7xl">
                  It's always better when we're together.
                </h1>
                <p className="mb-10 max-w-screen-lg text-lg font-medium sm:mb-11 sm:text-2xl sm:leading-10">
                  There are many ways you can connect with the open-source Nx
                  community. Below, you’ll find details about various connection
                  points.
                </p>
              </div>
            </div>
          </div>
          {/*Community*/}
          <div className="max-w-screen mx-auto px-5 py-5 xl:max-w-screen-xl">
            <div className="mt-32 flex flex-col justify-center md:flex-row">
              <div className="mt-8 flex w-full flex-col items-start justify-between pb-10 md:mt-0 md:w-1/2 md:pb-0">
                <h2 className="mb-4 text-xl font-bold leading-none tracking-tight text-gray-800 sm:text-2xl lg:text-2xl">
                  GitHub & Slack
                </h2>

                <p className="mb-6 sm:text-lg">
                  At the <a href="https://github.com/nrwl/nx">Nx GitHub repo</a>
                  , you can file issues or contribute code back to the project.
                </p>
                <p className="mb-6 sm:text-lg">
                  <a
                    className="cursor-pointer underline"
                    target="_blank"
                    title="Join the Nx Community Slack"
                    href="https://go.nrwl.io/join-slack"
                    rel="noreferrer"
                  >
                    Join the Nx Community Slack
                  </a>{' '}
                  to meet a friendly community of Nx users. This is a perfect
                  place to ask clarifying questions or to talk through new ideas
                  that you want to try with Nx. There's also a channel dedicated
                  to sharing articles about Nx and most of the authors of
                  community plugins can be reached there.
                </p>

                <h2 className="mb-4 text-xl font-bold leading-none tracking-tight text-gray-800 sm:text-2xl lg:text-2xl">
                  Livestreams & Twitter
                </h2>
                <p className="mb-6 sm:text-lg">
                  The Nx Show takes place every second and fourth Monday, from
                  1:00 - 2:00 PM EST on the{' '}
                  <a
                    className="cursor-pointer underline"
                    target="_blank"
                    href="https://www.youtube.com/nrwl_io"
                    rel="noreferrer"
                  >
                    Nrwl YouTube channel
                  </a>
                  . Info about upcoming sessions is shared on the{' '}
                  <a
                    className="cursor-pointer underline"
                    target="_blank"
                    href="https://twitter.com/NxDevTools"
                    rel="noreferrer"
                  >
                    @NxDevTools
                  </a>{' '}
                  Twitter account and the Nrwl+Nx Newsletter. You can find past
                  live-streams on the{' '}
                  <a
                    className="cursor-pointer underline"
                    target="_blank"
                    rel="noreferrer"
                    href="https://www.youtube.com/watch?v=JS3m1wIwRBg&list=PLakNactNC1dH8LCp2mvx5lbO6maNrlBVN"
                  >
                    'Nx Show' Youtube Playlist
                  </a>
                  .
                </p>

                <p className="mb-6 sm:text-lg">
                  In each session, members of the Nx core team answer your
                  questions, help get you up and running with Nx, and address
                  particular challenges. If you have a question or topic you’d
                  like to see covered during The Nx Show, you can{' '}
                  <a
                    className="cursor-pointer underline"
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Nx Show Questions and Suggestions Form"
                    title="Nx Show Questions and Suggestions Form"
                    href="https://forms.gle/ehzCjzcF1xxNaviC7"
                  >
                    submit them here
                  </a>
                </p>

                <p className="mb-6 sm:text-lg">
                  For the latest news about Nx,{' '}
                  <a
                    className="cursor-pointer underline"
                    target="_blank"
                    rel="noreferrer"
                    href="https://twitter.com/NxDevTools"
                  >
                    follow @NxDevTools on Twitter
                  </a>
                  .
                </p>

                <h2 className="mb-4 text-xl font-bold leading-none tracking-tight text-gray-800 sm:text-2xl lg:text-2xl">
                  We also have a newsletter
                </h2>
                <p className="mb-6 sm:text-lg">
                  You can also{' '}
                  <a
                    className="cursor-pointer underline"
                    target="_blank"
                    rel="noreferrer"
                    href="https://go.nrwl.io/nx-newsletter"
                  >
                    subscribe to the Nx Newsletter
                  </a>
                  : a monthly email digest from the Nx core team at Nrwl.
                  Subscribers receive news about Nx releases, posts about new Nx
                  features, details about new plugins, links to community
                  resources, and additional Nx content.
                </p>
              </div>
              <div className="mt-8 flex w-full flex-col items-start justify-between pb-10 md:mt-0 md:w-1/2 md:pl-16 md:pb-0">
                <Image
                  src="/images/community.svg"
                  width={555}
                  height={735}
                  alt="community illustration"
                />
              </div>
            </div>
          </div>
          {/*How to plugin*/}
          <div className="max-w-screen mx-auto px-5 py-5 xl:max-w-screen-xl">
            <div className="my-32 flex flex-col  items-start justify-center md:flex-row">
              <div className="mt-8 flex w-full flex-col items-start justify-between pb-10 md:mt-0 md:pb-0 lg:w-2/5">
                <h2 className="mb-4 text-xl font-bold leading-none tracking-tight text-gray-800 sm:text-2xl lg:text-2xl">
                  Community plugin
                </h2>
                <p className="mb-6 sm:text-lg">
                  Core Nx plugins are created and maintained by the Nx team at
                  Nrwl and you can see all the available plugins when you run
                  the{' '}
                  <code className="rounded border border-gray-200 bg-gray-50 px-2 py-1 font-mono text-sm leading-6 text-gray-600">
                    nx list
                  </code>{' '}
                  command in your workspace.
                </p>
                <p className="mb-6 sm:text-lg">
                  <b>The community plugins listed below</b> are created and
                  maintained by members of the Nx community, will allow you to
                  use the full power of the workspace while using different
                  technologies!
                </p>
                <div className="mb-6">
                  <a
                    href="#community-plugin-list"
                    className="cursor-pointer underline"
                  >
                    Check the community plugins right now!
                  </a>
                </div>
                <h3 className="mb-4 text-xl font-bold leading-none tracking-tight text-gray-800">
                  How to Install
                </h3>
                <p className="mb-6 sm:text-lg">
                  Each of the plugins listed below have a yarn and an npm icon.
                  Clicking on either of these copies the relevant command to
                  install the dependency for your project.
                </p>
              </div>
              <div className="mt-8 flex w-full flex-col items-start justify-between pb-10 md:mt-0 md:pl-16 lg:w-3/5">
                <div className="w-full border border-gray-100 bg-gray-50 py-4 px-6">
                  <h3 className="mb-4 text-xl font-bold leading-none tracking-tight text-gray-800 sm:text-2xl lg:text-2xl">
                    How to Create Your Own
                  </h3>
                  <p className="mb-6 sm:text-lg">
                    Get started with building your own plugin!
                  </p>
                  <iframe
                    loading="lazy"
                    width="560"
                    height="315"
                    title="YouTube video player"
                    src="https://www.youtube.com/embed/XYO689PAhow"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </div>
          {/*Call out*/}
          <div className="bg-blue-nx-base text-white">
            <div className="mx-auto my-12 max-w-7xl py-12 px-4 sm:px-6 lg:flex lg:items-center lg:justify-between lg:py-16 lg:px-8">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                <span className="block">Ready to dive in?</span>
                <span className="block text-gray-200">
                  Start using Nx today.
                </span>
              </h2>
              <div className="mt-8 flex lg:mt-0 lg:flex-shrink-0">
                <div className="inline-flex rounded-md shadow">
                  <Link href="/getting-started/intro">
                    <a className="text-blue-nx-base inline-flex items-center justify-center rounded-md border border-transparent bg-white px-5 py-3 text-base font-medium">
                      Get started with Nx
                    </a>
                  </Link>
                </div>
              </div>
            </div>
          </div>
          {/*Plugins*/}
          <div className="max-w-screen mx-auto px-5 py-5 xl:max-w-screen-xl">
            <div className="my-32 flex flex-col justify-center sm:flex-row">
              <div className="mt-8 w-full py-6 lg:w-3/5">
                <h2
                  id="community-plugin-list"
                  className="mb-4 text-xl font-extrabold leading-none tracking-tight text-gray-900 sm:text-2xl lg:text-3xl"
                >
                  Community Plugins Directory
                </h2>
              </div>
              <div className="mt-8 w-full py-6 text-right lg:w-2/5">
                <a
                  href="/nx-plugin/overview#listing-your-nx-plugin"
                  className="bg-blue-nx-base inline-flex items-center justify-center rounded-md border border-transparent px-5 py-3 text-base font-medium text-white"
                >
                  Add your Nx plugin to the list!
                </a>
              </div>
            </div>
            <div className="my-12 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {props.pluginList.map((plugin) => (
                <PluginCard
                  key={plugin.name}
                  name={plugin.name}
                  description={plugin.description}
                  url={plugin.url}
                />
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer useDarkBackground={false} />
    </>
  );
}

export default Community;
