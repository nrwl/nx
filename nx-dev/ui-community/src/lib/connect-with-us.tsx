import { MailIcon } from '@heroicons/react/solid';
import { ReactComponentElement } from 'react';

export function ConnectWithUs(): ReactComponentElement<any> {
  return (
    <article
      id="community"
      className="flex flex-col space-y-12 p-4 lg:mx-auto lg:max-w-7xl lg:flex-row lg:items-center lg:space-y-0 lg:space-x-20"
    >
      <header className="space-y-10 md:py-12 lg:w-5/12 xl:w-5/12">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
            Let's connect together!
          </h1>
          <p className="mt-4 text-lg text-gray-500">
            There are many ways you can connect with the open-source Nx
            community. Let's connect together!
          </p>
        </div>
      </header>

      <div className="relative flex-none lg:w-7/12 xl:w-7/12">
        <div className="relative flex flex-col space-y-6 md:flex-row md:space-x-6 md:space-y-0">
          <div className="space-y-6 md:mt-24 md:w-1/2">
            <div className="group rounded-2xl border-2 border-gray-100 bg-white p-5 transition duration-200 ease-out hover:border-violet-300">
              <div className="relative m-2 mb-6 inline-flex h-10 w-10 items-center justify-center">
                <div className="absolute inset-0 -m-2 rotate-6 transform rounded-3xl bg-violet-300 transition duration-200 ease-out group-hover:-rotate-3 group-hover:scale-105"></div>
                <div className="absolute inset-0 -rotate-6 transform rounded-2xl bg-[#4A154B] bg-opacity-75 shadow-inner transition duration-200 ease-out group-hover:rotate-2 group-hover:scale-105"></div>
                <svg
                  fill="currentColor"
                  className="hi-solid hi-adjustments relative inline-block h-5 w-5 transform text-white transition duration-200 ease-out group-hover:scale-110"
                  role="img"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <title>Slack</title>
                  <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
                </svg>
              </div>
              <h4 className="mb-2 text-lg font-bold">Join us on Slack</h4>
              <a
                href="https://go.nrwl.io/join-slack?utm_source=nx.dev"
                rel="noreferrer"
                target="_blank"
                title="Nx Community Slack channel"
                className="focus:outline-none"
              >
                <span className="absolute inset-0" aria-hidden="true"></span>
                <p className="leading-relaxed text-gray-600">
                  Join the Nx Community Slack to meet a friendly community of Nx
                  users. With more than{' '}
                  <span className="font-semibold">4k+ users</span>, this is a
                  really great place to ask questions or to talk new ideas!
                </p>
              </a>
            </div>
            <div className="group relative rounded-2xl border-2 border-gray-100 bg-white p-5 transition duration-200 ease-out hover:border-red-300">
              <div className="relative m-2 mb-6 inline-flex h-10 w-10 items-center justify-center">
                <div className="absolute inset-0 -m-2 rotate-6 transform rounded-3xl bg-red-300 transition duration-200 ease-out group-hover:-rotate-3 group-hover:scale-105"></div>
                <div className="absolute inset-0 -rotate-6 transform rounded-2xl bg-[#FF0000] bg-opacity-75 shadow-inner transition duration-200 ease-out group-hover:rotate-2 group-hover:scale-105"></div>
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
                href="https://www.youtube.com/nrwl_io/videos?utm_source=nx.dev"
                rel="noreferrer"
                target="_blank"
                title="Nx Youtube channel"
                className="focus:outline-none"
              >
                <span className="absolute inset-0" aria-hidden="true"></span>
                <p className="leading-relaxed text-gray-600">
                  Get access to live Q&A sessions, podcasts and tutorials on our
                  Youtube channel updated regularly! Do not forget to subscribe
                  to the Nx Show animated by Nx core team's members!
                </p>
              </a>
            </div>
          </div>
          <div className="space-y-6 md:w-1/2">
            <div className="group relative rounded-2xl border-2 border-gray-100 bg-white p-5 transition duration-200 ease-out hover:border-blue-300">
              <div className="relative m-2 mb-6 inline-flex h-10 w-10 items-center justify-center">
                <div className="absolute inset-0 -m-2 rotate-6 transform rounded-3xl bg-blue-300 transition duration-200 ease-out group-hover:-rotate-3 group-hover:scale-105"></div>
                <div className="absolute inset-0 -rotate-6 transform rounded-2xl bg-[#1DA1F2] bg-opacity-75 shadow-inner transition duration-200 ease-out group-hover:rotate-2 group-hover:scale-105"></div>
                <svg
                  fill="currentColor"
                  className="inline-block h-5 w-5 transform text-white transition duration-200 ease-out group-hover:scale-110"
                  role="img"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <title>Twitter</title>
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                </svg>
              </div>
              <h4 className="mb-2 text-lg font-bold">Follow us on Twitter</h4>
              <a
                href="https://twitter.com/NxDevTools?utm_source=nx.dev"
                rel="noreferrer"
                target="_blank"
                title="Nx Twitter account"
                className="focus:outline-none"
              >
                <span className="absolute inset-0" aria-hidden="true"></span>
                <p className="leading-relaxed text-gray-600">
                  Stay up to date on everything about Nx by following
                  @NxDevTools on Twitter.
                </p>
              </a>
            </div>
            <div className="group hover:border-nx-300 relative rounded-2xl border-2 border-gray-100 bg-white p-5 transition duration-200 ease-out">
              <div className="relative m-2 mb-6 inline-flex h-10 w-10 items-center justify-center">
                <div className="absolute inset-0 -m-2 rotate-6 transform rounded-3xl bg-green-300 transition duration-200 ease-out group-hover:-rotate-3 group-hover:scale-105"></div>
                <div className="bg-green-nx-base absolute inset-0 -rotate-6 transform rounded-2xl bg-opacity-75 shadow-inner transition duration-200 ease-out group-hover:rotate-2 group-hover:scale-105"></div>
                <MailIcon className="inline-block h-5 w-5 transform text-white transition duration-200 ease-out group-hover:scale-110" />
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
                <p className="leading-relaxed text-gray-600">
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

export default ConnectWithUs;
