import { EnvelopeIcon } from '@heroicons/react/24/solid';
import { SectionHeading } from '@nx/nx-dev/ui-common';
import Link from 'next/link';

export function ConnectWithUs(): JSX.Element {
  return (
    <article
      id="community"
      className="mx-auto flex max-w-7xl flex-col space-y-12 py-12 px-4 sm:px-6 lg:flex-row lg:items-center lg:space-y-0 lg:space-x-20 lg:py-16 lg:px-8"
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
            <Link href="/plugin-registry" className="font-semibold underline">
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
                <svg
                  fill="currentColor"
                  className="relative inline-block h-5 w-5 transform text-white transition duration-200 ease-out group-hover:scale-110"
                  role="img"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <title>Discord</title>
                  <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
                </svg>
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
