import React from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import Link from 'next/link';
import Head from 'next/head';
import {
  Footer,
  Header,
  InlineCommand,
  NxUsersShowcase,
} from '@nrwl/nx-dev/ui/common';
import { sendCustomEvent } from '@nrwl/nx-dev/feature-analytics';
import { useStorage } from '@nrwl/nx-dev/feature-storage';

export function AngularPage() {
  const router = useRouter();
  const { value: selectedFlavor } = useStorage('flavor');
  const { value: storedVersion } = useStorage('version');
  return (
    <>
      <Head>
        <title>Nx and Modern Angular</title>
        <meta
          name="description"
          content="Nx is a suite of powerful dev tools that help developers build, test, and scale full-stack Angular
          applications with integration with modern libraries like Jest, Cypress, Storybook, NgRx, ESLint, and more."
        />
        <meta name="twitter:title" content="Nx and Modern Angular" />
        <meta
          name="twitter:description"
          content="Nx is a suite of powerful dev tools that help developers build, test, and scale full-stack Angular
          applications with integration with modern libraries like Jest, Cypress, Storybook, NgRx, ESLint, and more."
        />
        <meta
          name="twitter:image"
          content="https://nx.dev/images/nx-media.jpg"
        />
        <meta
          name="twitter:image:alt"
          content="Nx: Smart, Extensible Build Framework"
        />
        <meta property="og:url" content="https://nx.dev/angular" />
        <meta
          property="og:description"
          content="Nx is a suite of powerful dev tools that help developers build, test, and scale full-stack Angular
          applications with integration with modern libraries like Jest, Cypress, Storybook, NgRx, ESLint, and more."
        />
        <meta property="og:title" content="Nx and Modern Angular" />
        <meta
          property="og:image"
          content="https://nx.dev/images/nx-media.jpg"
        />
        <meta property="og:image:width" content="800" />
        <meta property="og:image:height" content="400" />
      </Head>
      <Header
        useDarkBackground={false}
        showSearch={false}
        flavor={{
          name: selectedFlavor || 'Angular',
          value: selectedFlavor || 'a',
        }}
        version={{
          name: storedVersion || 'Latest',
          value: storedVersion || 'l',
        }}
      />
      <main>
        <div className="w-full overflow-hidden">
          {/*Intro component*/}
          <div className="bg-blue-nx-dark text-white">
            <div className="max-w-screen-lg xl:max-w-screen-xl mx-auto px-5 py-5 relative">
              <img
                src="/images/angular-constellation.svg"
                width={800}
                height={650}
                className="absolute top-0 right-0 constellation-wobble-animation"
                style={{ right: '-200px', top: '-270px' }}
              />
              <div className="mt-72">
                <h2 className="text-3xl sm:text-3xl lg:text-5xl leading-none font-extrabold tracking-tight mb-4">
                  Nx and Modern Angular
                </h2>
                <p className="sm:text-lg mb-16">
                  Nx is a smart and extensible build framework that helps you
                  develop, test, build, and scale Angular applications with
                  fully integrated support for modern tools like Jest, Cypress,
                  Storybook, ESLint, NgRx, and more.
                </p>
              </div>
              <div className="mt-8 mb-32 flex sm:flex-row flex-col justify-center">
                <div className="w-full sm:w-1/2 flex flex-col justify-between items-start sm:pb-0 pb-10 mt-8 sm:mt-0">
                  <p className="sm:text-lg mb-6">
                    <b>Nx</b> takes the core of the Angular framework and the
                    CLI and provides a more modern development experience on top
                    of them. <b>Nx</b>
                    provides better linting, better testing, a faster CLI,
                    support for popular community libraries and tools.
                  </p>
                  <p className="sm:text-lg mb-6">
                    <b>Nx</b> uses distributed graph-based task execution and
                    computation caching. Keep your CI and local dev experience
                    fast as your repository grows.
                  </p>
                  <p className="sm:text-lg mb-6">
                    You can{' '}
                    <a
                      href="#create-an-angular-workspace-with-nx"
                      className="underline pointer"
                    >
                      get started by creating a modern Angular workspace with Nx
                    </a>
                    , or{' '}
                    <Link href="/l/a/migration/migration-angular">
                      <a className="underline pointer">
                        migrate an existing Angular workspace
                      </a>
                    </Link>{' '}
                    .
                  </p>
                </div>
                <div className="w-full sm:w-1/2 flex flex-col justify-between items-start sm:pl-16 sm:pb-0 pb-10 mt-8 sm:mt-0">
                  <iframe
                    width="560"
                    height="315"
                    src="https://www.youtube.com/embed/cXOkmOy-8dk"
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
                <h3
                  id="create-an-angular-workspace-with-nx"
                  className="text-2xl sm:text-2xl lg:text-3xl leading-none font-extrabold text-gray-900 tracking-tight mb-4"
                >
                  Create an Angular Workspace <br className="hidden lg:block" />{' '}
                  with Nx
                </h3>
              </div>
              <div className="w-full sm:w-1/2 flex flex-col justify-between items-start sm:pl-16 sm:pb-0 pb-10 mt-8 sm:mt-0">
                <p className="sm:text-lg mb-6">
                  Get started right away by creating a new Angular workspace by
                  running the following command in your Terminal or Command
                  prompt:
                </p>

                <div className="w-full">
                  <InlineCommand
                    language={'bash'}
                    command={'npx create-nx-workspace --preset=angular'}
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
                  src="https://www.youtube.com/embed/i37yJKK8qGI"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full"
                />
              </div>
              <div className="w-full sm:w-1/2 flex flex-col justify-between items-start sm:pl-16 sm:pb-0 pb-10 mt-8 sm:mt-0">
                <p className="sm:text-lg mb-6">
                  Once you’ve created your Angular workspace, follow the steps
                  in this tutorial to learn how to add testing, share code, view
                  dependency graphs, and much, much more.
                </p>
                <div className="inline-flex">
                  <Link href="/l/a/tutorial/01-create-application">
                    <a className="inline-flex items-center font-bold group">
                      <span className="group-hover:underline">
                        Nx Angular App Tutorial
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
                  If you want to{' '}
                  <Link href="/l/a/migration/migration-angular">
                    <a className="underline pointer">
                      add Nx to an existing Angular project, check out this
                      guide
                    </a>
                  </Link>
                  .
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
                    Best-in-Class Support for Monorepos
                  </h3>

                  <p className="sm:text-lg mb-6">
                    <span className="font-bold">Nx</span> provides distributed
                    graph-based task execution and computation caching.
                  </p>

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
                    parallel, and{' '}
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
                  <svg
                    id="angular-logo"
                    className="w-full opacity-25"
                    role="img"
                    viewBox="0 0 24 24"
                  >
                    <title>Angular icon</title>
                    <path d="M9.931 12.645h4.138l-2.07-4.908m0-7.737L.68 3.982l1.726 14.771L12 24l9.596-5.242L23.32 3.984 11.999.001zm7.064 18.31h-2.638l-1.422-3.503H8.996l-1.422 3.504h-2.64L12 2.65z" />
                  </svg>
                  <svg
                    id="nest-logo"
                    className="w-full opacity-25"
                    role="img"
                    viewBox="0 0 24 24"
                  >
                    <path d="M14.131.047c-.173 0-.334.037-.483.087.316.21.49.49.576.806.007.043.019.074.025.117a.681.681 0 0 1 .013.112c.024.545-.143.614-.26.936-.18.415-.13.861.086 1.22a.74.74 0 0 0 .074.137c-.235-1.568 1.073-1.803 1.314-2.293.019-.428-.334-.713-.613-.911a1.37 1.37 0 0 0-.732-.21zM16.102.4c-.024.143-.006.106-.012.18-.006.05-.006.112-.012.161-.013.05-.025.1-.044.149-.012.05-.03.1-.05.149l-.067.142c-.02.025-.031.05-.05.075l-.037.055a2.152 2.152 0 0 1-.093.124c-.037.038-.068.081-.112.112v.006c-.037.031-.074.068-.118.1-.13.099-.278.173-.415.266-.043.03-.087.056-.124.093a.906.906 0 0 0-.118.099c-.043.037-.074.074-.111.118-.031.037-.068.08-.093.124a1.582 1.582 0 0 0-.087.13c-.025.05-.043.093-.068.142-.019.05-.037.093-.05.143a2.007 2.007 0 0 0-.043.155c-.006.025-.006.056-.012.08-.007.025-.007.05-.013.075 0 .05-.006.105-.006.155 0 .037 0 .074.006.111 0 .05.006.1.019.155.006.05.018.1.03.15.02.049.032.098.05.148.013.03.031.062.044.087l-1.426-.552c-.241-.068-.477-.13-.719-.186l-.39-.093c-.372-.074-.75-.13-1.128-.167-.013 0-.019-.006-.031-.006A11.082 11.082 0 0 0 8.9 2.855c-.378.025-.756.074-1.134.136a12.45 12.45 0 0 0-.837.174l-.279.074c-.092.037-.18.08-.266.118l-.205.093c-.012.006-.024.006-.03.012-.063.031-.118.056-.174.087a2.738 2.738 0 0 0-.236.118c-.043.018-.086.043-.124.062a.559.559 0 0 1-.055.03c-.056.032-.112.063-.162.094a1.56 1.56 0 0 0-.148.093c-.044.03-.087.055-.124.086-.006.007-.013.007-.019.013-.037.025-.08.056-.118.087l-.012.012-.093.074c-.012.007-.025.019-.037.025-.031.025-.062.056-.093.08-.006.013-.019.02-.025.025-.037.038-.074.069-.111.106-.007 0-.007.006-.013.012a1.742 1.742 0 0 0-.111.106c-.007.006-.007.012-.013.012a1.454 1.454 0 0 0-.093.1c-.012.012-.03.024-.043.036a1.374 1.374 0 0 1-.106.112c-.006.012-.018.019-.024.03-.05.05-.093.1-.143.15l-.018.018c-.1.106-.205.211-.317.304-.111.1-.229.192-.347.273a3.777 3.777 0 0 1-.762.421c-.13.056-.267.106-.403.149-.26.056-.527.161-.756.18-.05 0-.105.012-.155.018l-.155.037-.149.056c-.05.019-.099.044-.148.068-.044.031-.093.056-.137.087a1.011 1.011 0 0 0-.124.106c-.043.03-.087.074-.124.111-.037.043-.074.08-.105.124-.031.05-.068.093-.093.143a1.092 1.092 0 0 0-.087.142c-.025.056-.05.106-.068.161-.019.05-.037.106-.056.161-.012.05-.025.1-.03.15 0 .005-.007.012-.007.018-.012.056-.012.13-.019.167C.006 7.95 0 7.986 0 8.03a.657.657 0 0 0 .074.31v.006c.019.037.044.075.069.112.024.037.05.074.08.111.031.031.068.069.106.1a.906.906 0 0 0 .117.099c.149.13.186.173.378.272.031.019.062.031.1.05.006 0 .012.006.018.006 0 .013 0 .019.006.031a1.272 1.272 0 0 0 .08.298c.02.037.032.074.05.111.007.013.013.025.02.031.024.05.049.093.073.137l.093.13c.031.037.069.08.106.118.037.037.074.068.118.105 0 0 .006.006.012.006.037.031.074.062.112.087a.986.986 0 0 0 .136.08c.043.025.093.05.142.069a.73.73 0 0 0 .124.043c.007.006.013.006.025.012.025.007.056.013.08.019-.018.335-.024.65.026.762.055.124.328-.254.6-.688-.036.428-.061.93 0 1.079.069.155.44-.329.763-.862 4.395-1.016 8.405 2.02 8.826 6.31-.08-.67-.905-1.041-1.283-.948-.186.458-.502 1.047-1.01 1.413.043-.41.025-.83-.062-1.24a4.009 4.009 0 0 1-.769 1.562c-.588.043-1.177-.242-1.487-.67-.025-.018-.031-.055-.05-.08-.018-.043-.037-.087-.05-.13a.515.515 0 0 1-.037-.13c-.006-.044-.006-.087-.006-.137v-.093a.992.992 0 0 1 .031-.13c.013-.043.025-.086.044-.13.024-.043.043-.087.074-.13.105-.298.105-.54-.087-.682a.706.706 0 0 0-.118-.062c-.024-.006-.055-.018-.08-.025l-.05-.018a.847.847 0 0 0-.13-.031.472.472 0 0 0-.13-.019 1.01 1.01 0 0 0-.136-.012c-.031 0-.062.006-.093.006a.484.484 0 0 0-.137.019c-.043.006-.086.012-.13.024a1.068 1.068 0 0 0-.13.044c-.043.018-.08.037-.124.056-.037.018-.074.043-.118.062-1.444.942-.582 3.148.403 3.787-.372.068-.75.148-.855.229l-.013.012c.267.161.546.298.837.416.397.13.818.247 1.004.297v.006a5.996 5.996 0 0 0 1.562.112c2.746-.192 4.996-2.281 5.405-5.033l.037.161c.019.112.043.23.056.347v.006c.012.056.018.112.025.162v.024c.006.056.012.112.012.162.006.068.012.136.012.204v.1c0 .03.007.067.007.098 0 .038-.007.075-.007.112v.087c0 .043-.006.08-.006.124 0 .025 0 .05-.006.08 0 .044-.006.087-.006.137-.006.018-.006.037-.006.055l-.02.143c0 .019 0 .037-.005.056-.007.062-.019.118-.025.18v.012l-.037.174v.018l-.037.167c0 .007-.007.02-.007.025a1.663 1.663 0 0 1-.043.168v.018c-.019.062-.037.118-.05.174-.006.006-.006.012-.006.012l-.056.186c-.024.062-.043.118-.068.18-.025.062-.043.124-.068.18-.025.062-.05.117-.074.18h-.007c-.024.055-.05.117-.08.173a.302.302 0 0 1-.019.043c-.006.006-.006.013-.012.019a5.867 5.867 0 0 1-1.742 2.082c-.05.031-.099.069-.149.106-.012.012-.03.018-.043.03a2.603 2.603 0 0 1-.136.094l.018.037h.007l.26-.037h.006c.161-.025.322-.056.483-.087.044-.006.093-.019.137-.031l.087-.019c.043-.006.086-.018.13-.024.037-.013.074-.02.111-.031.62-.15 1.221-.354 1.798-.595a9.926 9.926 0 0 1-3.85 3.142c.714-.05 1.426-.167 2.114-.366a9.903 9.903 0 0 0 5.857-4.68 9.893 9.893 0 0 1-1.667 3.986 9.758 9.758 0 0 0 1.655-1.376 9.824 9.824 0 0 0 2.61-5.268c.21.98.272 1.99.18 2.987 4.474-6.241.371-12.712-1.346-14.416-.006-.013-.012-.019-.012-.031-.006.006-.006.006-.006.012 0-.006 0-.006-.007-.012 0 .074-.006.148-.012.223a8.34 8.34 0 0 1-.062.415c-.03.136-.068.273-.105.41-.044.13-.093.266-.15.396a5.322 5.322 0 0 1-.185.378 4.735 4.735 0 0 1-.477.688c-.093.111-.192.21-.292.31a3.994 3.994 0 0 1-.18.155l-.142.124a3.459 3.459 0 0 1-.347.241 4.295 4.295 0 0 1-.366.211c-.13.062-.26.118-.39.174a4.364 4.364 0 0 1-.818.223c-.143.025-.285.037-.422.05a4.914 4.914 0 0 1-.297.012 4.66 4.66 0 0 1-.422-.025 3.137 3.137 0 0 1-.421-.062 3.136 3.136 0 0 1-.415-.105h-.007c.137-.013.273-.025.41-.05a4.493 4.493 0 0 0 .818-.223c.136-.05.266-.112.39-.174.13-.062.248-.13.372-.204.118-.08.235-.161.347-.248.112-.087.217-.18.316-.279.105-.093.198-.198.291-.304.093-.111.18-.223.26-.334.013-.019.026-.044.038-.062.062-.1.124-.199.18-.298a4.272 4.272 0 0 0 .334-.775c.044-.13.075-.266.106-.403.025-.142.05-.278.062-.415.012-.142.025-.285.025-.421 0-.1-.007-.199-.013-.298a6.726 6.726 0 0 0-.05-.415 4.493 4.493 0 0 0-.092-.415c-.044-.13-.087-.267-.137-.397-.05-.13-.111-.26-.173-.384-.069-.124-.137-.248-.211-.366a6.843 6.843 0 0 0-.248-.34c-.093-.106-.186-.212-.285-.317a3.878 3.878 0 0 0-.161-.155c-.28-.217-.57-.421-.862-.607a1.154 1.154 0 0 0-.124-.062 2.415 2.415 0 0 0-.589-.26Z" />
                  </svg>
                  <svg
                    id="storybook-logo"
                    className="w-full opacity-25"
                    role="img"
                    viewBox="0 0 24 24"
                  >
                    <path d="M16.71.243l-.12 2.71a.18.18 0 00.29.15l1.06-.8.9.7a.18.18 0 00.28-.14l-.1-2.76 1.33-.1a1.2 1.2 0 011.279 1.2v21.596a1.2 1.2 0 01-1.26 1.2l-16.096-.72a1.2 1.2 0 01-1.15-1.16l-.75-19.797a1.2 1.2 0 011.13-1.27L16.7.222zM13.64 9.3c0 .47 3.16.24 3.59-.08 0-3.2-1.72-4.89-4.859-4.89-3.15 0-4.899 1.72-4.899 4.29 0 4.45 5.999 4.53 5.999 6.959 0 .7-.32 1.1-1.05 1.1-.96 0-1.35-.49-1.3-2.16 0-.36-3.649-.48-3.769 0-.27 4.03 2.23 5.2 5.099 5.2 2.79 0 4.969-1.49 4.969-4.18 0-4.77-6.099-4.64-6.099-6.999 0-.97.72-1.1 1.13-1.1.45 0 1.25.07 1.19 1.87z" />
                  </svg>
                  <svg
                    id="cypress-logo"
                    className="w-full opacity-25"
                    role="img"
                    viewBox="0 0 24 24"
                  >
                    <path d="M11.998 0C5.366 0 0 5.367 0 12a11.992 11.992 0 0 0 12 12c6.633 0 12-5.367 12-12-.001-6.633-5.412-12-12.002-12zM6.37 14.575c.392.523.916.742 1.657.742.35 0 .699-.044 1.004-.175.306-.13.655-.306 1.09-.567l1.223 1.745c-1.003.83-2.138 1.222-3.447 1.222-1.048 0-1.92-.218-2.705-.654a4.393 4.393 0 0 1-1.746-1.92c-.392-.83-.611-1.79-.611-2.925 0-1.09.219-2.094.61-2.923a4.623 4.623 0 0 1 1.748-2.007c.741-.48 1.657-.698 2.661-.698.699 0 1.353.087 1.877.305a5.64 5.64 0 0 1 1.614.96l-1.222 1.658A4.786 4.786 0 0 0 9.12 8.77c-.305-.13-.698-.174-1.048-.174-1.483 0-2.225 1.134-2.225 3.446-.043 1.18.175 2.008.524 2.532H6.37zm12 2.705c-.436 1.353-1.091 2.357-2.008 3.098-.916.743-2.138 1.135-3.665 1.266l-.305-2.05c1.003-.132 1.745-.35 2.225-.7.174-.13.524-.523.524-.523L11.519 6.764h3.01l2.095 8.683 2.226-8.683h2.923L18.37 17.28z" />
                  </svg>
                  <svg
                    id="typescript-logo"
                    className="w-full opacity-25"
                    role="img"
                    viewBox="0 0 24 24"
                  >
                    <path d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.214.776.214 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z" />
                  </svg>
                  <svg
                    id="visualstudiocode-logo"
                    className="w-full opacity-25"
                    role="img"
                    viewBox="0 0 24 24"
                  >
                    <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z" />
                  </svg>
                  <svg
                    id="prettier-logo"
                    className="w-full opacity-25"
                    role="img"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8.571 23.429A.571.571 0 0 1 8 24H2.286a.571.571 0 0 1 0-1.143H8c.316 0 .571.256.571.572zM8 20.57H6.857a.571.571 0 0 0 0 1.143H8a.571.571 0 0 0 0-1.143zm-5.714 1.143H4.57a.571.571 0 0 0 0-1.143H2.286a.571.571 0 0 0 0 1.143zM8 18.286H2.286a.571.571 0 0 0 0 1.143H8a.571.571 0 0 0 0-1.143zM16 16H5.714a.571.571 0 0 0 0 1.143H16A.571.571 0 0 0 16 16zM2.286 17.143h1.143a.571.571 0 0 0 0-1.143H2.286a.571.571 0 0 0 0 1.143zm17.143-3.429H16a.571.571 0 0 0 0 1.143h3.429a.571.571 0 0 0 0-1.143zM9.143 14.857h4.571a.571.571 0 0 0 0-1.143H9.143a.571.571 0 0 0 0 1.143zm-6.857 0h4.571a.571.571 0 0 0 0-1.143H2.286a.571.571 0 0 0 0 1.143zM20.57 11.43H11.43a.571.571 0 0 0 0 1.142h9.142a.571.571 0 0 0 0-1.142zM9.714 12a.571.571 0 0 0-.571-.571H5.714a.571.571 0 0 0 0 1.142h3.429A.571.571 0 0 0 9.714 12zm-7.428.571h1.143a.571.571 0 0 0 0-1.142H2.286a.571.571 0 0 0 0 1.142zm19.428-3.428H16a.571.571 0 0 0 0 1.143h5.714a.571.571 0 0 0 0-1.143zM2.286 10.286H8a.571.571 0 0 0 0-1.143H2.286a.571.571 0 0 0 0 1.143zm13.143-2.857c0 .315.255.571.571.571h5.714a.571.571 0 0 0 0-1.143H16a.571.571 0 0 0-.571.572zm-8.572-.572a.571.571 0 0 0 0 1.143H8a.571.571 0 0 0 0-1.143H6.857zM2.286 8H4.57a.571.571 0 0 0 0-1.143H2.286a.571.571 0 0 0 0 1.143zm16.571-2.857c0 .315.256.571.572.571h1.142a.571.571 0 0 0 0-1.143H19.43a.571.571 0 0 0-.572.572zm-1.143 0a.571.571 0 0 0-.571-.572H12.57a.571.571 0 0 0 0 1.143h4.572a.571.571 0 0 0 .571-.571zm-15.428.571h8a.571.571 0 0 0 0-1.143h-8a.571.571 0 0 0 0 1.143zm5.143-2.857c0 .316.255.572.571.572h11.429a.571.571 0 0 0 0-1.143H8a.571.571 0 0 0-.571.571zm-5.143.572h3.428a.571.571 0 0 0 0-1.143H2.286a.571.571 0 0 0 0 1.143zm0-2.286H16A.571.571 0 0 0 16 0H2.286a.571.571 0 0 0 0 1.143z" />
                  </svg>
                  <svg
                    id="ionic-logo"
                    className="w-full opacity-25"
                    role="img"
                    viewBox="0 0 24 24"
                  >
                    <path d="M22.922 7.027l-.103-.23-.169.188c-.408.464-.928.82-1.505 1.036l-.159.061.066.155a9.745 9.745 0 0 1 .75 3.759c0 5.405-4.397 9.806-9.806 9.806-5.409 0-9.802-4.397-9.802-9.802 0-5.405 4.402-9.806 9.806-9.806 1.467 0 2.883.319 4.2.947l.155.075.066-.155a3.767 3.767 0 0 1 1.106-1.453l.197-.159-.225-.117A11.905 11.905 0 0 0 12.001.001c-6.619 0-12 5.381-12 12s5.381 12 12 12 12-5.381 12-12c0-1.73-.361-3.403-1.078-4.973zM12 6.53A5.476 5.476 0 0 0 6.53 12 5.476 5.476 0 0 0 12 17.47 5.476 5.476 0 0 0 17.47 12 5.479 5.479 0 0 0 12 6.53zm10.345-2.007a2.494 2.494 0 1 1-4.988 0 2.494 2.494 0 0 1 4.988 0z" />
                  </svg>
                </div>
              </div>
              <div className="w-full sm:w-3/5 flex flex-col justify-between items-start sm:pl-16 sm:pb-0 pb-10 mt-8 sm:mt-0">
                <h3 className="text-xl sm:text-2xl lg:text-2xl leading-none font-extrabold text-gray-900 tracking-tight mb-4">
                  Rich Plugin Ecosystem
                </h3>
                <p className="sm:text-lg mb-6">
                  <b>
                    Nx is an open platform with plugins for many modern tools
                    and frameworks.
                  </b>
                  It has support for TypeScript, Angular, NativeScript, Cypress,
                  Jest, Prettier, Nest.js, AngularCLI, Storybook, Ionic, Go,
                  Rust among others. With Nx, you get a consistent dev
                  experience regardless of the tools used.
                </p>
                <p className="sm:text-lg mb-6">For instance:</p>
                <ul className="sm:text-lg list-disc list-inside">
                  <li>
                    <a
                      className="underline pointer"
                      href="https://blog.nrwl.io/nx-is-modern-angular-bda6cf10746d"
                    >
                      Nx is Modern Angular
                    </a>
                  </li>
                  <li>
                    <a
                      className="underline pointer"
                      href="https://blog.nrwl.io/smarter-and-faster-angular-development-with-nx-6ccca0fe18d1"
                    >
                      Smarter and Faster Angular Development with Nx
                    </a>
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
                    Integrated Development Experience
                  </h3>
                  <p className="sm:text-lg mb-6">
                    Nx provides a modern integrated dev experience. Nx adds a
                    high-quality VS Code plugin which helps you use the build
                    tool effectively, generate components in folders, and much
                    more.
                  </p>
                  <p className="sm:text-lg mb-6">
                    Nx also has optional free cloud support as well as GitHub
                    integration. Share links with your teammates where everyone
                    working on a project can examine detailed build logs and get
                    insights about how to improve your project and build.
                  </p>
                </div>
                <div className="w-full sm:w-3/5 flex flex-col justify-between items-start sm:pl-16 sm:pb-0 pb-10 mt-8 sm:mt-0">
                  <Image
                    src="/images/vscode-nxcloud-pr.png"
                    alt="Integrated Development Experience illustration"
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
                <span className="block">
                  Start using Nx with Angular today.
                </span>
              </h2>
              <div className="mt-8 flex lg:mt-0 lg:flex-shrink-0">
                <div className="inline-flex rounded-md shadow">
                  <Link href="/l/a/getting-started/intro">
                    <a className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-gray-700 bg-white">
                      Get started with Angular
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
                    <Link href={'/l/a/getting-started/intro'}>
                      <a className="underline pointer">
                        Nx Angular Documentation
                      </a>
                    </Link>
                  </li>
                  <li>
                    <a
                      className="underline pointer"
                      href="https://www.youtube.com/watch?v=2mYLe9Kp9VM&list=PLakNactNC1dH38AfqmwabvOszDmKriGco"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Free Nx Workspaces video course
                    </a>
                  </li>
                  <li className="mt-4">
                    <a
                      className="underline pointer"
                      href="https://www.youtube.com/watch?v=h5FIGDn5YM0"
                      target="_blank"
                      rel="noreferrer"
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
                      rel="noreferrer"
                    >
                      Tune into regular Nx Office Hours livestreams
                    </a>
                  </li>
                  <li className="mt-4">
                    <a
                      className="underline pointer"
                      href="https://nx.app"
                      target="_blank"
                      rel="noreferrer"
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
                    rel="noreferrer"
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
      <Footer useDarkBackground={false} />
    </>
  );
}

export default AngularPage;
