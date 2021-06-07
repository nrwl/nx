import React from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import Link from 'next/link';
import {
  Footer,
  Header,
  InlineCommand,
  NxUsersShowcase,
} from '@nrwl/nx-dev/ui/common';
import { sendCustomEvent } from '@nrwl/nx-dev/feature-analytics';
import { useStorage } from '../lib/use-storage';

export function ReactPage() {
  const router = useRouter();
  const { value: storedFlavor } = useStorage('flavor');
  const { value: storedVersion } = useStorage('version');
  return (
    <>
      <Header
        showSearch={false}
        flavor={{
          name: storedFlavor || 'react',
          value: storedFlavor || 'react',
        }}
        version={{
          name: storedVersion || 'Latest',
          value: storedVersion || 'latest',
        }}
      />
      <main>
        <div className="w-full overflow-hidden">
          {/*Intro component*/}
          <div className="bg-blue-nx-dark text-white">
            <div className="max-w-screen-lg xl:max-w-screen-xl mx-auto px-5 py-5 relative">
              <img
                src="/images/react-constellation.svg"
                width={800}
                height={650}
                className="absolute top-0 right-0 constellation-wobble-animation"
                style={{ right: '-200px', top: '-270px' }}
              />
              <div className="mt-72">
                <h2 className="text-3xl sm:text-3xl lg:text-5xl leading-none font-extrabold tracking-tight mb-4">
                  Nx and React
                </h2>
                <p className="sm:text-lg mb-16">
                  Nx is a smart and extensible build framework to help you
                  develop, test, build, and scale with React and React
                  frameworks like Gatsby, Next.js, and React Native.
                </p>
              </div>
              <div className="mt-8 mb-32 flex sm:flex-row flex-col justify-center">
                <div className="w-full sm:w-1/2 flex flex-col justify-between items-start sm:pb-0 pb-10 mt-8 sm:mt-0">
                  <p className="sm:text-lg mb-6">
                    <b>Nx</b> provides a holistic dev experience powered by an
                    advanced CLI and editor plugins.
                  </p>
                  <p className="sm:text-lg mb-6">
                    Develop your applications using your preferred React
                    frameworks, mix and match them, without losing the rich
                    support for Storybook, Cypress, Jest, ESLint and more.
                  </p>
                  <p className="sm:text-lg mb-6">
                    <b>Nx</b> uses distributed graph-based task execution and
                    computation caching. Keep your CI and local dev experience
                    fast as your repository grows.
                  </p>
                  <p className="sm:text-lg mb-6">
                    <b>Nx</b> can be added to any React project{' '}
                    <a
                      className="underline pointer"
                      href="#create-nx-workspace"
                    >
                      in minutes
                    </a>
                    .
                  </p>
                </div>
                <div className="w-full sm:w-1/2 flex flex-col justify-between items-start sm:pl-16 sm:pb-0 pb-10 mt-8 sm:mt-0">
                  <iframe
                    width="560"
                    height="315"
                    src="https://www.youtube.com/embed/sNz-4PUM0k8"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="max-w-screen-lg xl:max-w-screen-xl mx-auto px-5 py-5">
            {/*How to use Nx*/}
            <div className="mt-32 flex sm:flex-row flex-col justify-center">
              <div className="w-full sm:w-1/2 flex flex-col justify-between items-start sm:pb-0 pb-10 mt-8 sm:mt-0">
                <h3 className="text-2xl sm:text-2xl lg:text-3xl leading-none font-extrabold text-gray-900 tracking-tight mb-4">
                  Create a React Workspace with Nx
                </h3>
              </div>
              <div className="w-full sm:w-1/2 flex flex-col justify-between items-start sm:pl-16 sm:pb-0 pb-10 mt-8 sm:mt-0">
                <p className="sm:text-lg mb-6">
                  Get started right away by creating a new React workspace by
                  running the following command in your Terminal or Command
                  prompt:
                </p>

                <div className="w-full">
                  <InlineCommand
                    language={'bash'}
                    command={'npx create-nx-workspace --preset=react'}
                    callback={() =>
                      sendCustomEvent('code-snippets', 'click', router.pathname)
                    }
                  />
                </div>

                <p className="sm:text-lg my-6">
                  For Next.js users you can use:
                </p>

                <div className="w-full">
                  <InlineCommand
                    language={'bash'}
                    command={'npx create-nx-workspace --preset=next'}
                    callback={() =>
                      sendCustomEvent('code-snippets', 'click', router.pathname)
                    }
                  />
                </div>
              </div>
            </div>
            {/*More info*/}
            <div
              className="mt-16 mb-32 flex sm:flex-row flex-col items-center justify-center p-8 bg-blue-nx-base text-white"
              style={{
                background:
                  'linear-gradient(90deg, hsla(0, 0%, 100%, 1) 10%, hsla(214, 62%, 21%, 1) 10%)',
              }}
            >
              <div className="w-full sm:w-1/2 flex flex-col justify-between items-start sm:pb-0 pb-10 mt-8 sm:mt-0">
                <iframe
                  width="560"
                  height="315"
                  src="https://www.youtube.com/embed/HcQE5R6ucng"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full"
                />
              </div>
              <div className="w-full sm:w-1/2 flex flex-col justify-between items-start sm:pl-16 sm:pb-0 pb-10 mt-8 sm:mt-0">
                <p className="sm:text-lg mb-6">
                  Once you’ve created your React workspace, follow the steps in
                  this tutorial to learn how to add testing, share code, view
                  dependency graphs, and much, much more.
                </p>
                <div className="inline-flex">
                  <Link href="/latest/react/tutorial/01-create-application">
                    <a className="inline-flex items-center font-bold group">
                      <span className="group-hover:underline">
                        Nx React App Tutorial
                      </span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="ml-1 h-5 w-5 transform-gpu transition ease-out duration-200 group-hover:translate-x-2 "
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 7l5 5m0 0l-5 5m5-5H6"
                        />
                      </svg>
                    </a>
                  </Link>
                </div>
                <p className="italic sm:text-lg my-6">
                  If you want to add Nx to an existing React project, check out
                  these guides for{' '}
                  <Link href="/latest/react/migration/migration-cra">
                    <a className="underline pointer">
                      "Create React App" migration
                    </a>
                  </Link>{' '}
                  or{' '}
                  <Link href="/latest/react/migration/migration-cra">
                    <a className="underline pointer">
                      "Adding Nx to Yarn/Lerna monorepo" migration
                    </a>
                  </Link>
                </p>
              </div>
            </div>
          </div>
          {/*Nx technology*/}
          <div className="bg-blue-nx-base text-white">
            <div className="max-w-screen-lg xl:max-w-screen-xl mx-auto px-5 py-5">
              <div className="py-32 flex sm:flex-row flex-col items-center justify-center">
                <div className="w-full sm:w-1/2 flex flex-col justify-between items-start sm:pb-0 pb-10 mt-8 sm:mt-0">
                  <h3 className="text-xl sm:text-2xl lg:text-2xl leading-none font-extrabold tracking-tight mb-4">
                    Distributed Graph-Based Task Executions and Computation
                    Caching
                  </h3>
                  <p className="sm:text-lg mb-6">
                    <span className="font-bold">Nx</span> is smart. It analyzes
                    your workspace and figures out what can be affected by every
                    code change. That's why Nx doesn't rebuild and retest
                    everything on every commit —{' '}
                    <span className="font-bold">
                      it only rebuilds what is necessary
                    </span>
                    .
                  </p>
                  <p className="sm:text-lg mb-6">
                    <span className="font-bold">Nx</span> partitions commands
                    into a graph of smaller tasks. Nx then runs those tasks in
                    parallel, and
                    <span className="font-bold">
                      it can even distribute them across many machines without
                      any configuration
                    </span>
                    .
                  </p>
                  <p className="sm:text-lg mb-6">
                    <span className="font-bold">
                      Nx also uses a distributed computation cache.
                    </span>{' '}
                    If someone has already built or tested similar code, Nx will
                    use their results to speed up the command for everyone else.
                  </p>
                </div>
                <div className="w-full sm:w-1/2 flex flex-col justify-between items-center sm:pl-16 sm:pb-0 pb-10 mt-8 sm:mt-0">
                  <Image
                    src="/images/distributed-tasks.png"
                    alt="Distributed Graph-Based Task Execution and Computation Caching illustration"
                    width={388}
                    height={300}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-screen-lg xl:max-w-screen-xl mx-auto px-5 py-5">
            {/*Nx plugins ecosystem*/}
            <div className="py-32 flex sm:flex-row flex-col items-center justify-center">
              <div className="w-full sm:w-2/5 flex flex-col justify-between items-center sm:pb-0 pb-10 mt-8 sm:mt-0">
                <div className="grid grid-cols-4 gap-16">
                  <img
                    loading="lazy"
                    className="w-full opacity-25"
                    height="128"
                    width="128"
                    src="https://cdn.jsdelivr.net/npm/simple-icons@v4/icons/storybook.svg"
                  />
                  <img
                    loading="lazy"
                    className="w-full opacity-25"
                    height="128"
                    width="128"
                    src="https://cdn.jsdelivr.net/npm/simple-icons@v4/icons/cypress.svg"
                  />
                  <img
                    loading="lazy"
                    className="w-full opacity-25"
                    height="128"
                    width="128"
                    src="https://cdn.jsdelivr.net/npm/simple-icons@v4/icons/gatsby.svg"
                  />
                  <img
                    loading="lazy"
                    className="w-full opacity-25"
                    height="128"
                    width="128"
                    src="https://cdn.jsdelivr.net/npm/simple-icons@v4/icons/typescript.svg"
                  />
                  <img
                    loading="lazy"
                    className="w-full opacity-25"
                    height="128"
                    width="128"
                    src="https://cdn.jsdelivr.net/npm/simple-icons@v4/icons/next-dot-js.svg"
                  />
                  <img
                    loading="lazy"
                    className="w-full opacity-25"
                    height="128"
                    width="128"
                    src="https://cdn.jsdelivr.net/npm/simple-icons@v4/icons/visualstudiocode.svg"
                  />
                  <img
                    loading="lazy"
                    className="w-full opacity-25"
                    height="128"
                    width="128"
                    src="https://cdn.jsdelivr.net/npm/simple-icons@v4/icons/prettier.svg"
                  />
                  <img
                    loading="lazy"
                    className="w-full opacity-25"
                    height="128"
                    width="128"
                    src="https://cdn.jsdelivr.net/npm/simple-icons@v4/icons/ionic.svg"
                  />
                </div>
              </div>
              <div className="w-full sm:w-3/5 flex flex-col justify-between items-start sm:pl-16 sm:pb-0 pb-10 mt-8 sm:mt-0">
                <h3 className="text-xl sm:text-2xl lg:text-2xl leading-none font-extrabold text-gray-900 tracking-tight mb-4">
                  Rich Plugin Ecosystem
                </h3>
                <p className="sm:text-lg mb-6 font-bold">
                  Nx is an open platform with plugins for many modern tools and
                  frameworks.
                </p>
                <p className="sm:text-lg mb-6">
                  It has support for TypeScript, React, React Native, Cypress,
                  Jest, Prettier, Nest.js, Next.js, Gatsby, Storybook, Ionic,
                  Go, Rust among others. With Nx, you get a consistent dev
                  experience regardless of the tools used.
                </p>
                <ul className="sm:text-lg list-disc list-inside">
                  <li>
                    Use Nx's{' '}
                    <a
                      className="underline pointer"
                      href="https://nx.dev/latest/react/storybook/overview"
                    >
                      Storybook
                    </a>{' '}
                    and{' '}
                    <a
                      className="underline pointer"
                      href="https://nx.dev/latest/react/cypress/overview#cypress-plugin"
                    >
                      Cypress
                    </a>{' '}
                    plugins to build design systems.
                  </li>
                  <li className="mt-4">
                    Use{' '}
                    <a
                      className="underline pointer"
                      target="_blank"
                      href="https://blog.nrwl.io/painlessly-build-and-deploy-next-js-apps-with-nx-225e2721da78?source=friends_link&sk=b381e3b9e7a2d8951fbe806ac0363851"
                    >
                      Next.js
                    </a>
                    ,{' '}
                    <a
                      className="underline pointer"
                      target="_blank"
                      href="https://blog.nrwl.io/step-to-step-guide-on-creating-a-blog-using-nx-gatsby-wordpress-ac7e9bfc0efd?source=friends_link&sk=5af5e109144bc4985f3fe8d92429463b"
                    >
                      Gatsby
                    </a>
                    ,{' '}
                    <a
                      className="underline pointer"
                      target="_blank"
                      href="https://blog.nrwl.io/introducing-react-native-support-for-nx-48d335e90c89?source=friends_link&sk=e04878accafe0d9f696b647d0b9ae2d4"
                    >
                      React Native
                    </a>{' '}
                    and share code between them.
                  </li>
                </ul>
              </div>
            </div>
          </div>
          {/*Integrated experience*/}
          <div className="bg-blue-nx-base text-white">
            <div className="max-w-screen-lg xl:max-w-screen-xl mx-auto px-5 py-5">
              <div className="py-32 flex sm:flex-row flex-col items-center justify-center">
                <div className="w-full sm:w-2/5 flex flex-col justify-between items-start sm:pb-0 pb-10 mt-8 sm:mt-0">
                  <h3 className="text-xl sm:text-2xl lg:text-2xl leading-none font-extrabold tracking-tight mb-4">
                    Nx Integrated Development Experience
                  </h3>
                  <p className="sm:text-lg mb-6">
                    Nx provides a modern dev experience that is more integrated.
                    Nx adds a high-quality VS Code plugin which helps you use
                    the build tool effectively, generate components in folders,
                    and much more.
                  </p>
                  <p className="sm:text-lg mb-6">
                    Nx also supports optional free cloud support with Nx Cloud
                    as well as GitHub integration. Share links with your
                    teammates where everyone working on a project can examine
                    detailed build logs and get insights about how to improve
                    your project and build.
                  </p>
                </div>
                <div className="w-full sm:w-3/5 flex flex-col justify-between items-start sm:pl-16 sm:pb-0 pb-10 mt-8 sm:mt-0">
                  <Image
                    src="/images/vscode-nxcloud-pr.png"
                    alt="Nx Integrated Development Experience illustration"
                    width={870}
                    height={830}
                  />
                </div>
              </div>
            </div>
          </div>
          {/*Call out*/}
          <div className="bg-blue-nx-dark text-white overflow-hidden">
            <div className="max-w-7xl mx-auto my-12 py-12 px-4 sm:px-6 lg:py-16 lg:px-8 lg:flex lg:items-center lg:justify-between">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                <span className="block">Ready to dive in?</span>
                <span className="block">Start using Nx with React today.</span>
              </h2>
              <div className="mt-8 flex lg:mt-0 lg:flex-shrink-0">
                <div className="inline-flex rounded-md shadow">
                  <Link href="/latest/react/getting-started/getting-started">
                    <a className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-gray-700 bg-white">
                      Get started with React
                    </a>
                  </Link>
                </div>
              </div>
            </div>
          </div>
          <div className="max-w-screen-lg xl:max-w-screen-xl mx-auto px-5 py-5">
            {/*Learn more*/}
            <div className="py-32 flex sm:flex-row flex-col items-start justify-center">
              <div className="w-full sm:w-2/5 flex flex-col justify-between items-start sm:pb-0 pb-10 mt-8 sm:mt-0">
                <h3 className="text-xl sm:text-2xl lg:text-2xl leading-none font-extrabold text-gray-900 tracking-tight mb-4">
                  Learn More About Nx
                </h3>
              </div>
              <div className="w-full sm:w-3/5 flex flex-col justify-between items-start sm:pl-16 sm:pb-0 pb-10 mt-8 sm:mt-0">
                <p className="sm:text-lg mb-6">
                  To learn more about Nx and how Nx can increase your dev and
                  build efficiency and modernize your apps stack, check out the
                  following resources:
                </p>
                <ul className="sm:text-lg list-disc list-inside">
                  <li>
                    <Link href={'/latest/react/getting-started/intro'}>
                      <a className="underline pointer">
                        Nx React Documentation
                      </a>
                    </Link>
                  </li>
                  <li>
                    <a
                      className="underline pointer"
                      href="https://egghead.io/playlists/scale-react-development-with-nx-4038"
                      target="_blank"
                    >
                      Free Nx Workspaces video course
                    </a>
                  </li>
                  <li className="mt-4">
                    <a
                      className="underline pointer"
                      href="https://www.youtube.com/watch?v=h5FIGDn5YM0"
                      target="_blank"
                    >
                      Nx Explainer: Dev Tools for Monorepos, In-Depth with
                      Victor Savkin
                    </a>
                  </li>
                  <li className="mt-4">
                    <a
                      className="underline pointer"
                      href="https://go.nrwl.io/nx-office-hours"
                      target="_blank"
                    >
                      Tune into regular Nx Office Hours livestreams
                    </a>
                  </li>
                  <li className="mt-4">
                    <a
                      className="underline pointer"
                      href="https://nx.app"
                      target="_blank"
                    >
                      Nx Cloud
                    </a>
                  </li>
                </ul>
                <p className="sm:text-lg mt-6">
                  You can also{' '}
                  <a
                    className="underline pointer"
                    href="https://twitter.com/NxDevTools"
                    target="_blank"
                  >
                    follow Nx Dev Tools on Twitter
                  </a>{' '}
                  to keep up with latest news, feature announcements, and
                  resources from the Nx Core Team.
                </p>
              </div>
            </div>
          </div>
          {/*Who is using Nx*/}
          <NxUsersShowcase />
        </div>
      </main>
      <Footer
        flavor={{
          name: storedFlavor || 'react',
          value: storedFlavor || 'react',
        }}
        version={{
          name: storedVersion || 'Latest',
          value: storedVersion || 'latest',
        }}
      />
    </>
  );
}

export default ReactPage;
