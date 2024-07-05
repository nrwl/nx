import { EnvelopeIcon } from '@heroicons/react/24/solid';
import { DiscordIcon, SectionHeading } from '@nx/nx-dev/ui-common';
import Link from 'next/link';

export function ConnectWithUs(): JSX.Element {
  return (
    <article
      id="community"
      className="mx-auto flex max-w-7xl flex-col space-y-12 px-4 py-12 sm:px-6 lg:flex-row lg:items-center lg:space-x-20 lg:space-y-0 lg:px-8 lg:py-16"
    >
      <header className="space-y-10 md:py-12 lg:w-5/12 xl:w-5/12">
        <div>
          <SectionHeading as="h1" variant="display" id="connect-with-us">
            Let's connect together!
          </SectionHeading>
          <p className="mt-4">
            There are many ways you can connect with the open-source Nx
            community. Let's connect together!
          </p>
          <p className="py-4">
            Looking for community plugins? Find them listed in the{' '}
            <Link
              href="/plugin-registry"
              className="font-semibold underline"
              prefetch={false}
            >
              plugin registry
            </Link>
            .
          </p>
        </div>
      </header>

      <div className="relative flex-none lg:w-7/12 xl:w-7/12">
        <div className="relative flex flex-col space-y-6 md:flex-row md:space-x-6 md:space-y-0">
          <div className="space-y-6 md:mt-24 md:w-1/2">
            <div className="group relative rounded-lg border border-slate-200 bg-white/60 p-5 transition duration-200 ease-out hover:border-indigo-300 dark:border-slate-800/40 dark:bg-slate-800/60 dark:hover:border-indigo-900 dark:hover:bg-slate-800">
              <div className="relative m-2 mb-6 inline-flex h-10 w-10 items-center justify-center">
                <div className="absolute inset-0 -m-2 rotate-6 transform rounded-3xl bg-indigo-300 transition duration-200 ease-out group-hover:-rotate-3 group-hover:scale-105 dark:bg-indigo-900" />
                <div className="absolute inset-0 -rotate-6 transform rounded-2xl bg-[#5865F2] bg-opacity-75 shadow-inner transition duration-200 ease-out group-hover:rotate-2 group-hover:scale-105" />
                <DiscordIcon
                  showTitle={true}
                  className="relative inline-block h-5 w-5 transform text-white transition duration-200 ease-out group-hover:scale-110"
                />
              </div>
              <h4 className="mb-2 text-lg font-bold">Join us on Discord</h4>
              <a
                href="https://go.nx.dev/community"
                rel="noreferrer"
                target="_blank"
                title="Nx Official Discord Server"
                className="focus:outline-none"
              >
                <span className="absolute inset-0" aria-hidden="true"></span>
                <p className="leading-relaxed">
                  Join the Official Nx Discord Server to meet a friendly
                  community of Nx users. This is a really great place to ask
                  questions or to talk new ideas!
                </p>
              </a>
            </div>
            <div className="group relative rounded-lg border border-slate-200 bg-white/60 p-5 transition duration-200 ease-out hover:border-red-300 dark:border-slate-800/40 dark:bg-slate-800/60 dark:hover:border-red-900 dark:hover:bg-slate-800">
              <div className="relative m-2 mb-6 inline-flex h-10 w-10 items-center justify-center">
                <div className="absolute inset-0 -m-2 rotate-6 transform rounded-3xl bg-red-300 transition duration-200 ease-out group-hover:-rotate-3 group-hover:scale-105 dark:bg-red-900" />
                <div className="absolute inset-0 -rotate-6 transform rounded-2xl bg-[#FF0000] bg-opacity-75 shadow-inner transition duration-200 ease-out group-hover:rotate-2 group-hover:scale-105" />
                <svg
                  fill="currentColor"
                  className="hi-solid hi-chart-pie relative inline-block h-5 w-5 transform text-white transition duration-200 ease-out group-hover:scale-110"
                  role="img"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <title>YouTube</title>
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </div>
              <h4 className="mb-2 text-lg font-bold">Livestreams on Youtube</h4>
              <a
                href="https://www.youtube.com/@NxDevtools/videos?utm_source=nx.dev"
                rel="noreferrer"
                target="_blank"
                title="Nx Youtube channel"
                className="focus:outline-none"
              >
                <span className="absolute inset-0" aria-hidden="true"></span>
                <p className="leading-relaxed">
                  Get access to live Q&A sessions, podcasts and tutorials on our
                  Youtube channel updated regularly! Do not forget to subscribe
                  to the Nx Show animated by Nx core team's members!
                </p>
              </a>
            </div>
          </div>
          <div className="space-y-6 md:w-1/2">
            <div className="group relative rounded-lg border border-slate-200 bg-white/60 p-5 transition duration-200 ease-out hover:border-slate-300 dark:border-slate-800/40 dark:bg-slate-800/60 dark:hover:border-slate-900 dark:hover:bg-slate-800">
              <div className="relative m-2 mb-6 inline-flex h-10 w-10 items-center justify-center">
                <div className="absolute inset-0 -m-2 rotate-6 transform rounded-3xl bg-slate-300 transition duration-200 ease-out group-hover:-rotate-3 group-hover:scale-105 dark:bg-slate-800" />
                <div className="absolute inset-0 -rotate-6 transform rounded-2xl bg-[#000000] bg-opacity-75 shadow-inner transition duration-200 ease-out group-hover:rotate-2 group-hover:scale-105" />
                <svg
                  fill="currentColor"
                  className="inline-block h-5 w-5 transform text-white transition duration-200 ease-out group-hover:scale-110"
                  role="img"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <title>X</title>
                  <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
                </svg>
              </div>
              <h4 className="mb-2 text-lg font-bold">Follow us on X</h4>
              <a
                href="https://x.com/NxDevTools?utm_source=nx.dev"
                rel="noreferrer"
                target="_blank"
                title="Nx X account"
                className="focus:outline-none"
              >
                <span className="absolute inset-0" aria-hidden="true"></span>
                <p className="leading-relaxed">
                  Stay up to date on everything about Nx by following
                  @NxDevTools on X.
                </p>
              </a>
            </div>
            <div className="group relative rounded-lg border border-slate-200 bg-white/60 p-5 transition duration-200 ease-out hover:border-green-300 dark:border-slate-800/40 dark:bg-slate-800/60 dark:hover:border-green-900 dark:hover:bg-slate-800">
              <div className="relative m-2 mb-6 inline-flex h-10 w-10 items-center justify-center">
                <div className="absolute inset-0 -m-2 rotate-6 transform rounded-3xl bg-green-300 transition duration-200 ease-out group-hover:-rotate-3 group-hover:scale-105 dark:bg-green-800" />
                <div className="absolute inset-0 -rotate-6 transform rounded-2xl bg-green-500 bg-opacity-75 shadow-inner transition duration-200 ease-out group-hover:rotate-2 group-hover:scale-105" />
                <EnvelopeIcon className="inline-block h-5 w-5 transform text-white transition duration-200 ease-out group-hover:scale-110" />
              </div>
              <h4 className="mb-2 text-lg font-bold">Nx monthly newsletter</h4>
              <a
                href="https://go.nrwl.io/nx-newsletter?utm_source=nx.dev"
                rel="noreferrer"
                target="_blank"
                title="Nx monthly newsletter subscription"
                className="focus:outline-none"
              >
                <span className="absolute inset-0" aria-hidden="true"></span>
                <p className="leading-relaxed">
                  Subscribe and receive news about Nx releases, posts about new
                  Nx features, details about new plugins, links to community
                  resources, and additional Nx content.
                </p>
              </a>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
