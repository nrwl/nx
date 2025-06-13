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
          <SectionHeading as="h1" variant="title" id="connect-with-us">
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

            <div className="group relative rounded-lg border border-slate-200 bg-white/60 p-5 transition duration-200 ease-out hover:border-blue-300 dark:border-slate-800/40 dark:bg-slate-800/60 dark:hover:border-blue-900 dark:hover:bg-slate-800">
              <div className="relative m-2 mb-6 inline-flex h-10 w-10 items-center justify-center">
                <div className="absolute inset-0 -m-2 rotate-6 transform rounded-3xl bg-blue-300 transition duration-200 ease-out group-hover:-rotate-3 group-hover:scale-105 dark:bg-blue-800" />
                <div className="absolute inset-0 -rotate-6 transform rounded-2xl bg-[#0285FF] bg-opacity-75 shadow-inner transition duration-200 ease-out group-hover:rotate-2 group-hover:scale-105" />
                <svg
                  fill="currentColor"
                  className="inline-block h-5 w-5 transform text-white transition duration-200 ease-out group-hover:scale-110"
                  role="img"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <title>Bluesky</title>
                  <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8Z" />
                </svg>
              </div>
              <h4 className="mb-2 text-lg font-bold">Follow us on Bluesky</h4>
              <a
                href="https://bsky.app/profile/nx.dev?utm_source=nx.dev"
                rel="noreferrer"
                target="_blank"
                title="Nx Bluesky account"
                className="focus:outline-none"
              >
                <span className="absolute inset-0" aria-hidden="true"></span>
                <p className="leading-relaxed">
                  Stay up to date on everything about Nx by following @nx.dev on
                  Bluesky.
                </p>
              </a>
            </div>

            <div className="group relative rounded-lg border border-slate-200 bg-white/60 p-5 transition duration-200 ease-out hover:border-blue-300 dark:border-slate-800/40 dark:bg-slate-800/60 dark:hover:border-blue-900 dark:hover:bg-slate-800">
              <div className="relative m-2 mb-6 inline-flex h-10 w-10 items-center justify-center">
                <div className="absolute inset-0 -m-2 rotate-6 transform rounded-3xl bg-blue-300 transition duration-200 ease-out group-hover:-rotate-3 group-hover:scale-105 dark:bg-blue-900" />
                <div className="absolute inset-0 -rotate-6 transform rounded-2xl bg-[#0077B5] bg-opacity-75 shadow-inner transition duration-200 ease-out group-hover:rotate-2 group-hover:scale-105" />
                <svg
                  fill="currentColor"
                  className="inline-block h-5 w-5 transform text-white transition duration-200 ease-out group-hover:scale-110"
                  role="img"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <title>LinkedIn</title>
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </div>
              <h4 className="mb-2 text-lg font-bold">Connect on LinkedIn</h4>
              <a
                href="https://www.linkedin.com/company/nxdevtools"
                rel="noreferrer"
                target="_blank"
                title="Nx LinkedIn page"
                className="focus:outline-none"
              >
                <span className="absolute inset-0" aria-hidden="true"></span>
                <p className="leading-relaxed">
                  Follow Nx on LinkedIn to stay informed about the latest
                  updates, company news, and professional insights from the Nx
                  team.
                </p>
              </a>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
