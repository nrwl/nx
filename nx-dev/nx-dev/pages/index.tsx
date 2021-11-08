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
  FeatureList,
} from '@nrwl/nx-dev/ui/common';
import { sendCustomEvent } from '@nrwl/nx-dev/feature-analytics';

export function Index() {
  const router = useRouter();
  return (
    <>
      <Head>
        <title>Nx: Smart, Extensible Build Framework</title>
        <meta
          name="description"
          content="Nx is a smart and extensible build framework to help you architect, test, and build at any scale — integrating seamlessly with modern technologies and frameworks while providing a distributed graph-based task execution, computation caching, smart rebuilds of affected projects, powerful code generators, editor support, GitHub apps, and more."
        />
        <meta
          name="twitter:title"
          content="Nx: Smart, Extensible Build Framework"
        />
        <meta
          name="twitter:description"
          content="Nx is a smart and extensible build framework to help you architect, test, and build at any scale — integrating seamlessly with modern technologies and frameworks while providing a distributed graph-based task execution, computation caching, smart rebuilds of affected projects, powerful code generators, editor support, GitHub apps, and more."
        />
        <meta
          name="twitter:image"
          content="https://nx.dev/images/nx-media.jpg"
        />
        <meta
          name="twitter:image:alt"
          content="Nx: Smart, Extensible Build Framework"
        />
        <meta property="og:url" content="https://nx.dev" />
        <meta
          property="og:description"
          content="Nx is a smart and extensible build framework to help you architect, test, and build at any scale — integrating seamlessly with modern technologies and frameworks while providing a distributed graph-based task execution, computation caching, smart rebuilds of affected projects, powerful code generators, editor support, GitHub apps, and more."
        />
        <meta
          property="og:title"
          content="Nx: Smart, Extensible Build Framework"
        />
        <meta
          property="og:image"
          content="https://nx.dev/images/nx-media.jpg"
        />
        <meta property="og:image:width" content="800" />
        <meta property="og:image:height" content="400" />
      </Head>
      <Header showSearch={false} useDarkBackground={false} />
      <main>
        <div className="w-full">
          {/*INTRO COMPONENT*/}
          <div
            id="animated-background"
            className="bg-blue-nx-dark bg-blue-nx-base text-white transform-gpu lg:bg-contain bg-clip-border bg-origin-border bg-right bg-no-repeat"
            style={{
              backgroundImage: 'url(/images/background/hero-bg-large.svg)',
            }}
          >
            <div className="max-w-screen-lg xl:max-w-screen-xl mx-auto px-5 py-24">
              <div className="m-18 2xl:m-24 flex lg:flex-row flex-col items-center justify-center">
                <div className="w-full lg:w-1/2 flex flex-col">
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl leading none font-extrabold tracking-tight sm:mt-10 mb-8 sm:mt-14 sm:mb-10">
                    Smart, Extensible Build Framework
                  </h1>
                  <h2 className="text-2xl font-medium mb-1">
                    Nx helps architect, test, and build at any scale:
                  </h2>
                  <p className="max-w-screen-lg text-lg font-medium mb-10 sm:mb-11">
                    integrations with modern frameworks, distributed task
                    execution, computation caching, smart rebuilds of affected
                    projects, powerful code generators, editor support, GitHub
                    apps, and more.
                  </p>

                  <div className="flex flex-wrap space-y-4 sm:space-y-0 sm:space-x-4 text-center">
                    <Link href="/getting-started/intro">
                      <a className="w-full sm:w-auto flex-none bg-white text-blue-nx-dark text-lg leading-6 font-semibold py-3 px-6 border border-transparent rounded-md focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-blue-nx-dark focus:outline-none transition-colors duration-180">
                        Get Started
                      </a>
                    </Link>

                    <InlineCommand
                      language={'bash'}
                      command={'npx create-nx-workspace'}
                      callback={() =>
                        sendCustomEvent(
                          'code-snippets',
                          'click',
                          router.pathname
                        )
                      }
                    />
                  </div>
                </div>
                <div className="hidden sm:flex w-full lg:w-1/2 flex-col justify-between items-center lg:pl-16 lg:pb-0 pb-10 mt-8 lg:mt-0">
                  <iframe
                    className="max-w-screen-sm"
                    width="100%"
                    height="315"
                    src="https://www.youtube.com/embed/n6e1cTChMzE?rel=0&modestbranding=1&autohide=1&showinfo=1&controls=1&vq=hd1080"
                    title="Nx with React"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            </div>
          </div>

          {/*NX FEATURES*/}
          <div className="max-w-screen-lg xl:max-w-screen-xl mx-auto px-5 py-5">
            <FeatureList />
          </div>

          {/*NX BANNER PROMOTION*/}
          <div className="max-w-screen-lg xl:max-w-screen-xl mx-auto px-5 py-5">
            <a
              href="https://nxplaybook.com/p/advanced-nx-workspaces?utm_source=nx.dev"
              className="cursor-pointer flex"
              target="_blank"
              rel="nofollow"
            >
              <img
                className="w-full rounded-lg"
                src="/images/nx-playbook-banner.svg"
                alt="Nx Playbook promotion banner"
              />
            </a>
          </div>

          {/*SELECTION COMPONENT*/}
          <div className="max-w-screen-lg xl:max-w-screen-xl mx-auto px-5 py-5">
            <div className="mt-6 md:mt-24 mb-20 flex md:flex-row flex-col justify-center">
              <div className="w-full md:w-1/2 grid grid-cols-3 gap-4 sm:gap-10 items-center">
                <Link href="/react">
                  <a className="w-full bg-white border border-gray-100 shadow-sm hover:border-blue-nx-dark transition-all ease-out duration-180 rounded-md py-4 px-3 space-x-1 text-base tracking-tight font-bold leading-tight text-center flex flex-col justify-center items-center px-2 py-4 space-y-4">
                    <svg viewBox="0 0 24 24" className="w-1/2" fill="#52C1DE">
                      <path d="M14.23 12.004a2.236 2.236 0 0 1-2.235 2.236 2.236 2.236 0 0 1-2.236-2.236 2.236 2.236 0 0 1 2.235-2.236 2.236 2.236 0 0 1 2.236 2.236zm2.648-10.69c-1.346 0-3.107.96-4.888 2.622-1.78-1.653-3.542-2.602-4.887-2.602-.41 0-.783.093-1.106.278-1.375.793-1.683 3.264-.973 6.365C1.98 8.917 0 10.42 0 12.004c0 1.59 1.99 3.097 5.043 4.03-.704 3.113-.39 5.588.988 6.38.32.187.69.275 1.102.275 1.345 0 3.107-.96 4.888-2.624 1.78 1.654 3.542 2.603 4.887 2.603.41 0 .783-.09 1.106-.275 1.374-.792 1.683-3.263.973-6.365C22.02 15.096 24 13.59 24 12.004c0-1.59-1.99-3.097-5.043-4.032.704-3.11.39-5.587-.988-6.38-.318-.184-.688-.277-1.092-.278zm-.005 1.09v.006c.225 0 .406.044.558.127.666.382.955 1.835.73 3.704-.054.46-.142.945-.25 1.44-.96-.236-2.006-.417-3.107-.534-.66-.905-1.345-1.727-2.035-2.447 1.592-1.48 3.087-2.292 4.105-2.295zm-9.77.02c1.012 0 2.514.808 4.11 2.28-.686.72-1.37 1.537-2.02 2.442-1.107.117-2.154.298-3.113.538-.112-.49-.195-.964-.254-1.42-.23-1.868.054-3.32.714-3.707.19-.09.4-.127.563-.132zm4.882 3.05c.455.468.91.992 1.36 1.564-.44-.02-.89-.034-1.345-.034-.46 0-.915.01-1.36.034.44-.572.895-1.096 1.345-1.565zM12 8.1c.74 0 1.477.034 2.202.093.406.582.802 1.203 1.183 1.86.372.64.71 1.29 1.018 1.946-.308.655-.646 1.31-1.013 1.95-.38.66-.773 1.288-1.18 1.87-.728.063-1.466.098-2.21.098-.74 0-1.477-.035-2.202-.093-.406-.582-.802-1.204-1.183-1.86-.372-.64-.71-1.29-1.018-1.946.303-.657.646-1.313 1.013-1.954.38-.66.773-1.286 1.18-1.868.728-.064 1.466-.098 2.21-.098zm-3.635.254c-.24.377-.48.763-.704 1.16-.225.39-.435.782-.635 1.174-.265-.656-.49-1.31-.676-1.947.64-.15 1.315-.283 2.015-.386zm7.26 0c.695.103 1.365.23 2.006.387-.18.632-.405 1.282-.66 1.933-.2-.39-.41-.783-.64-1.174-.225-.392-.465-.774-.705-1.146zm3.063.675c.484.15.944.317 1.375.498 1.732.74 2.852 1.708 2.852 2.476-.005.768-1.125 1.74-2.857 2.475-.42.18-.88.342-1.355.493-.28-.958-.646-1.956-1.1-2.98.45-1.017.81-2.01 1.085-2.964zm-13.395.004c.278.96.645 1.957 1.1 2.98-.45 1.017-.812 2.01-1.086 2.964-.484-.15-.944-.318-1.37-.5-1.732-.737-2.852-1.706-2.852-2.474 0-.768 1.12-1.742 2.852-2.476.42-.18.88-.342 1.356-.494zm11.678 4.28c.265.657.49 1.312.676 1.948-.64.157-1.316.29-2.016.39.24-.375.48-.762.705-1.158.225-.39.435-.788.636-1.18zm-9.945.02c.2.392.41.783.64 1.175.23.39.465.772.705 1.143-.695-.102-1.365-.23-2.006-.386.18-.63.406-1.282.66-1.933zM17.92 16.32c.112.493.2.968.254 1.423.23 1.868-.054 3.32-.714 3.708-.147.09-.338.128-.563.128-1.012 0-2.514-.807-4.11-2.28.686-.72 1.37-1.536 2.02-2.44 1.107-.118 2.154-.3 3.113-.54zm-11.83.01c.96.234 2.006.415 3.107.532.66.905 1.345 1.727 2.035 2.446-1.595 1.483-3.092 2.295-4.11 2.295-.22-.005-.406-.05-.553-.132-.666-.38-.955-1.834-.73-3.703.054-.46.142-.944.25-1.438zm4.56.64c.44.02.89.034 1.345.034.46 0 .915-.01 1.36-.034-.44.572-.895 1.095-1.345 1.565-.455-.47-.91-.993-1.36-1.565z" />
                    </svg>
                    <div className="sm:text-base md:text-sm lg:text-base">
                      React
                    </div>
                  </a>
                </Link>
                <Link href="/angular">
                  <a className="w-full bg-white border border-gray-100 shadow-sm hover:border-blue-nx-dark transition-all ease-out duration-180 rounded-md py-4 px-3 space-x-1 text-base tracking-tight font-bold leading-tight text-center flex flex-col justify-center items-center px-2 py-4 space-y-4">
                    <svg viewBox="0 0 24 24" className="w-1/2" fill="#E23236">
                      <path d="M9.931 12.645h4.138l-2.07-4.908m0-7.737L.68 3.982l1.726 14.771L12 24l9.596-5.242L23.32 3.984 11.999.001zm7.064 18.31h-2.638l-1.422-3.503H8.996l-1.422 3.504h-2.64L12 2.65z" />
                    </svg>
                    <div className="sm:text-base md:text-sm lg:text-base">
                      Angular
                    </div>
                  </a>
                </Link>
                <Link href="/node">
                  <a className="w-full bg-white border border-gray-100 shadow-sm hover:border-blue-nx-dark transition-all ease-out duration-180 rounded-md py-4 px-3 space-x-1 text-base tracking-tight font-bold leading-tight text-center flex flex-col justify-center items-center px-2 py-4 space-y-4">
                    <svg viewBox="0 0 24 24" className="w-1/2" fill="#77AE64">
                      <path d="M11.998,24c-0.321,0-0.641-0.084-0.922-0.247l-2.936-1.737c-0.438-0.245-0.224-0.332-0.08-0.383 c0.585-0.203,0.703-0.25,1.328-0.604c0.065-0.037,0.151-0.023,0.218,0.017l2.256,1.339c0.082,0.045,0.197,0.045,0.272,0l8.795-5.076 c0.082-0.047,0.134-0.141,0.134-0.238V6.921c0-0.099-0.053-0.192-0.137-0.242l-8.791-5.072c-0.081-0.047-0.189-0.047-0.271,0 L3.075,6.68C2.99,6.729,2.936,6.825,2.936,6.921v10.15c0,0.097,0.054,0.189,0.139,0.235l2.409,1.392 c1.307,0.654,2.108-0.116,2.108-0.89V7.787c0-0.142,0.114-0.253,0.256-0.253h1.115c0.139,0,0.255,0.112,0.255,0.253v10.021 c0,1.745-0.95,2.745-2.604,2.745c-0.508,0-0.909,0-2.026-0.551L2.28,18.675c-0.57-0.329-0.922-0.945-0.922-1.604V6.921 c0-0.659,0.353-1.275,0.922-1.603l8.795-5.082c0.557-0.315,1.296-0.315,1.848,0l8.794,5.082c0.57,0.329,0.924,0.944,0.924,1.603 v10.15c0,0.659-0.354,1.273-0.924,1.604l-8.794,5.078C12.643,23.916,12.324,24,11.998,24z M19.099,13.993 c0-1.9-1.284-2.406-3.987-2.763c-2.731-0.361-3.009-0.548-3.009-1.187c0-0.528,0.235-1.233,2.258-1.233 c1.807,0,2.473,0.389,2.747,1.607c0.024,0.115,0.129,0.199,0.247,0.199h1.141c0.071,0,0.138-0.031,0.186-0.081 c0.048-0.054,0.074-0.123,0.067-0.196c-0.177-2.098-1.571-3.076-4.388-3.076c-2.508,0-4.004,1.058-4.004,2.833 c0,1.925,1.488,2.457,3.895,2.695c2.88,0.282,3.103,0.703,3.103,1.269c0,0.983-0.789,1.402-2.642,1.402 c-2.327,0-2.839-0.584-3.011-1.742c-0.02-0.124-0.126-0.215-0.253-0.215h-1.137c-0.141,0-0.254,0.112-0.254,0.253 c0,1.482,0.806,3.248,4.655,3.248C17.501,17.007,19.099,15.91,19.099,13.993z" />
                    </svg>
                    <div className="sm:text-base md:text-sm lg:text-base">
                      Node
                    </div>
                  </a>
                </Link>
              </div>
              <div className="w-full md:w-1/2 flex flex-col justify-between items-start md:pl-16 md:pb-0 pb-10 mt-8 md:mt-0">
                <h2 className="text-xl sm:text-2xl lg:text-3xl leading-none font-extrabold tracking-tight mb-4 relative">
                  <svg
                    width={42}
                    height={42}
                    viewBox="0 0 64 64"
                    style={{
                      transform: 'scaleX(-1) rotate(50deg)',
                      left: '-4.3rem',
                      position: 'absolute',
                      top: 'calc(50% - (32px / 2))',
                    }}
                    className="hidden md:block"
                  >
                    <path
                      shapeRendering="geometricPrecision"
                      d="m63.386,16.193l.002-.002c0.002-0.003 0.004-0.006 0.006-0.01 0.172-0.195 0.298-0.43 0.399-0.678 0.032-0.076 0.053-0.148 0.076-0.225 0.058-0.191 0.094-0.389 0.106-0.596 0.006-0.076 0.018-0.148 0.016-0.226 0-0.04 0.01-0.076 0.008-0.115-0.014-0.239-0.062-0.47-0.136-0.687-0.006-0.023-0.022-0.041-0.03-0.064-0.088-0.239-0.214-0.451-0.363-0.645-0.021-0.027-0.028-0.063-0.05-0.09l-10.311-12.146c-0.789-0.93-2.084-0.948-2.894-0.037-0.808,0.91-0.823,2.402-0.032,3.334l5.558,6.549c-8.121-1.076-16.104,0.633-16.481,0.717-24.646,4.467-42.087,27.227-38.88,50.736 0.159,1.164 1.028,1.992 2.019,1.992 0.106,0 0.212-0.009 0.32-0.027 1.116-0.203 1.878-1.409 1.704-2.696-2.857-20.94 13.056-41.282 35.537-45.358 0.103-0.024 8.351-1.794 16.117-0.574l-8.577,5.093c-1.005,0.598-1.398,2.02-0.881,3.177 0.516,1.159 1.748,1.608 2.756,1.017l13.52-8.028c0.183-0.111 0.347-0.25 0.491-0.411z"
                    />
                  </svg>
                  First-class support for your favorite stack
                </h2>
                <p className="sm:text-lg mb-6">
                  Nx is a smart and extensible build framework to help you
                  architect, test, and build at any scale — integrating
                  seamlessly with modern technologies and libraries while
                  providing a robust CLI, caching, dependency management, and
                  more.
                </p>
                <p className="sm:text-lg mb-6">
                  It has first-class support for many frontend and backend
                  technologies, so its documentation comes in multiple flavours.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-nx-base text-white">
            <div className="max-w-screen-lg xl:max-w-screen-xl mx-auto px-5 py-5">
              {/*GRAPH AND COMPUTATION CACHING*/}
              <div id="monorepos" className="flex sm:flex-row flex-col">
                <div className="py-16 md:py-32 flex md:flex-row flex-col items-center justify-center">
                  <div className="w-full md:w-2/5 flex flex-col justify-center items-center md:pr-16 md:pb-0 mt-8 md:mt-0">
                    <Image
                      src="/images/distributed-tasks.png"
                      alt="Distributed Graph-Based Task Execution and Computation Caching illustration"
                      width={388}
                      height={300}
                    />
                  </div>
                  <div className="w-full md:w-3/5 flex flex-col justify-center md:pl-16 md:pb-0 mt-8 md:mt-0">
                    <h2 className="text-xl md:text-2xl lg:text-2xl leading-none font-extrabold tracking-tight mb-4">
                      Best-in-Class Support for Monorepos
                    </h2>
                    <p className="md:text-lg mb-6">
                      <span className="font-bold">Nx</span> provides distributed
                      graph-based task execution and computation caching.
                    </p>
                    <p className="md:text-lg mb-6">
                      <span className="font-bold">Nx</span> is smart. It
                      analyzes your workspace and figures out what can be
                      affected by every code change. That's why Nx doesn't
                      rebuild and retest everything on every commit -{' '}
                      <span className="font-bold">
                        it only rebuilds what is necessary
                      </span>
                      .
                    </p>
                    <p className="md:text-lg mb-6">
                      <span className="font-bold">Nx</span> partitions commands
                      into a graph of smaller tasks. Nx then runs those tasks in
                      parallel, and it can{' '}
                      <span className="font-bold">
                        even distribute them across many machines without any
                        configuration
                      </span>
                      .
                    </p>
                    <p className="md:text-lg mb-6">
                      <span className="font-bold">
                        Nx also uses a distributed computation cache
                      </span>
                      . If someone has already built or tested similar code, Nx
                      will use their results to speed up the command for
                      everyone else.
                    </p>
                  </div>
                </div>
              </div>
              {/*DEV EXPERIENCE*/}
              <div id="integrated-dx" className="flex md:flex-row flex-col">
                <div className="py-16 md:py-32 flex md:flex-row flex-col-reverse items-center justify-center">
                  <div className="w-full md:w-2/5 flex flex-col justify-between items-start md:pb-0 pb-10 mt-8 md:mt-0">
                    <h2 className="text-xl sm:text-2xl lg:text-2xl leading-none font-extrabold tracking-tight mb-4">
                      Integrated Development Experience
                    </h2>
                    <p className="sm:text-lg mb-6">
                      Nx provides a modern dev experience that is more
                      integrated. Nx adds a high-quality{' '}
                      <a
                        href="https://nx.dev/getting-started/console#nx-console-for-vscode"
                        target="_blank"
                        className="cursor-pointer underline"
                        rel="noreferrer"
                      >
                        VS Code plugin
                      </a>{' '}
                      which helps you use the build tool effectively, generate
                      components in folders, and much more.
                    </p>
                    <p className="sm:text-lg mb-6">
                      Nx also has optional free cloud support as well as GitHub
                      integration. Share links with your teammates where
                      everyone working on a project can examine detailed build
                      logs and get insights about how to improve your project
                      and build.
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
              {/* NXCLOUD AD */}
              <div className="text-white my-16 md:my-32 rounded-xl bg-blue-nx-dark border-blue-nx-dark">
                <div className="max-w-7xl mx-auto px-4 sm:px-10 py-10 md:px-8 lg:flex lg:items-center lg:justify-between relative">
                  <span className="absolute text-xs top-2 mt-3">Sponsor</span>
                  <h2 className="text-2xl font-bold tracking-tight sm:text-2xl">
                    <span className="block">
                      See how much more time you can save with Nx Cloud.
                    </span>
                  </h2>
                  <div className="mt-4 flex lg:mt-0 lg:flex-shrink-0">
                    <div className="inline-flex rounded-md shadow">
                      <a
                        href="https://nx.app/?utm_source=nx.dev"
                        className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-blue-nx-dark bg-white"
                      >
                        Learn About Nx Cloud
                      </a>
                    </div>
                  </div>
                </div>
              </div>
              {/*RICH PLUGIN ECOSYSTEM*/}
              <div className="flex md:flex-row flex-col">
                <div
                  id="ecosystem"
                  className="my-16 md:my-32 flex md:flex-row flex-col items-center justify-center"
                >
                  <div className="max-w-md md:w-2/5 flex flex-col justify-between items-center md:pb-0 pb-10 mt-8 md:mt-0">
                    <div className="grid grid-cols-4 gap-16">
                      <svg
                        id="nextjs-logo"
                        className="w-full opacity-75 fill-current"
                        role="img"
                        viewBox="0 0 24 24"
                      >
                        <path d="M11.5725 0c-.1763 0-.3098.0013-.3584.0067-.0516.0053-.2159.021-.3636.0328-3.4088.3073-6.6017 2.1463-8.624 4.9728C1.1004 6.584.3802 8.3666.1082 10.255c-.0962.659-.108.8537-.108 1.7474s.012 1.0884.108 1.7476c.652 4.506 3.8591 8.2919 8.2087 9.6945.7789.2511 1.6.4223 2.5337.5255.3636.04 1.9354.04 2.299 0 1.6117-.1783 2.9772-.577 4.3237-1.2643.2065-.1056.2464-.1337.2183-.1573-.0188-.0139-.8987-1.1938-1.9543-2.62l-1.919-2.592-2.4047-3.5583c-1.3231-1.9564-2.4117-3.556-2.4211-3.556-.0094-.0026-.0187 1.5787-.0235 3.509-.0067 3.3802-.0093 3.5162-.0516 3.596-.061.115-.108.1618-.2064.2134-.075.0374-.1408.0445-.495.0445h-.406l-.1078-.068a.4383.4383 0 01-.1572-.1712l-.0493-.1056.0053-4.703.0067-4.7054.0726-.0915c.0376-.0493.1174-.1125.1736-.143.0962-.047.1338-.0517.5396-.0517.4787 0 .5584.0187.6827.1547.0353.0377 1.3373 1.9987 2.895 4.3608a10760.433 10760.433 0 004.7344 7.1706l1.9002 2.8782.096-.0633c.8518-.5536 1.7525-1.3418 2.4657-2.1627 1.5179-1.7429 2.4963-3.868 2.8247-6.134.0961-.6591.1078-.854.1078-1.7475 0-.8937-.012-1.0884-.1078-1.7476-.6522-4.506-3.8592-8.2919-8.2087-9.6945-.7672-.2487-1.5836-.42-2.4985-.5232-.169-.0176-1.0835-.0366-1.6123-.037zm4.0685 7.217c.3473 0 .4082.0053.4857.047.1127.0562.204.1642.237.2767.0186.061.0234 1.3653.0186 4.3044l-.0067 4.2175-.7436-1.14-.7461-1.14v-3.066c0-1.982.0093-3.0963.0234-3.1502.0375-.1313.1196-.2346.2323-.2955.0961-.0494.1313-.054.4997-.054z" />
                      </svg>
                      <svg
                        id="react-logo"
                        className="w-full opacity-75 fill-current"
                        role="img"
                        viewBox="0 0 24 24"
                      >
                        <path d="M14.23 12.004a2.236 2.236 0 0 1-2.235 2.236 2.236 2.236 0 0 1-2.236-2.236 2.236 2.236 0 0 1 2.235-2.236 2.236 2.236 0 0 1 2.236 2.236zm2.648-10.69c-1.346 0-3.107.96-4.888 2.622-1.78-1.653-3.542-2.602-4.887-2.602-.41 0-.783.093-1.106.278-1.375.793-1.683 3.264-.973 6.365C1.98 8.917 0 10.42 0 12.004c0 1.59 1.99 3.097 5.043 4.03-.704 3.113-.39 5.588.988 6.38.32.187.69.275 1.102.275 1.345 0 3.107-.96 4.888-2.624 1.78 1.654 3.542 2.603 4.887 2.603.41 0 .783-.09 1.106-.275 1.374-.792 1.683-3.263.973-6.365C22.02 15.096 24 13.59 24 12.004c0-1.59-1.99-3.097-5.043-4.032.704-3.11.39-5.587-.988-6.38-.318-.184-.688-.277-1.092-.278zm-.005 1.09v.006c.225 0 .406.044.558.127.666.382.955 1.835.73 3.704-.054.46-.142.945-.25 1.44-.96-.236-2.006-.417-3.107-.534-.66-.905-1.345-1.727-2.035-2.447 1.592-1.48 3.087-2.292 4.105-2.295zm-9.77.02c1.012 0 2.514.808 4.11 2.28-.686.72-1.37 1.537-2.02 2.442-1.107.117-2.154.298-3.113.538-.112-.49-.195-.964-.254-1.42-.23-1.868.054-3.32.714-3.707.19-.09.4-.127.563-.132zm4.882 3.05c.455.468.91.992 1.36 1.564-.44-.02-.89-.034-1.345-.034-.46 0-.915.01-1.36.034.44-.572.895-1.096 1.345-1.565zM12 8.1c.74 0 1.477.034 2.202.093.406.582.802 1.203 1.183 1.86.372.64.71 1.29 1.018 1.946-.308.655-.646 1.31-1.013 1.95-.38.66-.773 1.288-1.18 1.87-.728.063-1.466.098-2.21.098-.74 0-1.477-.035-2.202-.093-.406-.582-.802-1.204-1.183-1.86-.372-.64-.71-1.29-1.018-1.946.303-.657.646-1.313 1.013-1.954.38-.66.773-1.286 1.18-1.868.728-.064 1.466-.098 2.21-.098zm-3.635.254c-.24.377-.48.763-.704 1.16-.225.39-.435.782-.635 1.174-.265-.656-.49-1.31-.676-1.947.64-.15 1.315-.283 2.015-.386zm7.26 0c.695.103 1.365.23 2.006.387-.18.632-.405 1.282-.66 1.933-.2-.39-.41-.783-.64-1.174-.225-.392-.465-.774-.705-1.146zm3.063.675c.484.15.944.317 1.375.498 1.732.74 2.852 1.708 2.852 2.476-.005.768-1.125 1.74-2.857 2.475-.42.18-.88.342-1.355.493-.28-.958-.646-1.956-1.1-2.98.45-1.017.81-2.01 1.085-2.964zm-13.395.004c.278.96.645 1.957 1.1 2.98-.45 1.017-.812 2.01-1.086 2.964-.484-.15-.944-.318-1.37-.5-1.732-.737-2.852-1.706-2.852-2.474 0-.768 1.12-1.742 2.852-2.476.42-.18.88-.342 1.356-.494zm11.678 4.28c.265.657.49 1.312.676 1.948-.64.157-1.316.29-2.016.39.24-.375.48-.762.705-1.158.225-.39.435-.788.636-1.18zm-9.945.02c.2.392.41.783.64 1.175.23.39.465.772.705 1.143-.695-.102-1.365-.23-2.006-.386.18-.63.406-1.282.66-1.933zM17.92 16.32c.112.493.2.968.254 1.423.23 1.868-.054 3.32-.714 3.708-.147.09-.338.128-.563.128-1.012 0-2.514-.807-4.11-2.28.686-.72 1.37-1.536 2.02-2.44 1.107-.118 2.154-.3 3.113-.54zm-11.83.01c.96.234 2.006.415 3.107.532.66.905 1.345 1.727 2.035 2.446-1.595 1.483-3.092 2.295-4.11 2.295-.22-.005-.406-.05-.553-.132-.666-.38-.955-1.834-.73-3.703.054-.46.142-.944.25-1.438zm4.56.64c.44.02.89.034 1.345.034.46 0 .915-.01 1.36-.034-.44.572-.895 1.095-1.345 1.565-.455-.47-.91-.993-1.36-1.565z" />
                      </svg>
                      <svg
                        id="gatsby-logo"
                        className="w-full opacity-75 fill-current"
                        role="img"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0zm0 2.571c3.171 0 5.915 1.543 7.629 3.858l-1.286 1.115C16.886 5.572 14.571 4.286 12 4.286c-3.343 0-6.171 2.143-7.286 5.143l9.857 9.857c2.486-.857 4.373-3 4.973-5.572h-4.115V12h6c0 4.457-3.172 8.228-7.372 9.17L2.83 9.944C3.772 5.743 7.543 2.57 12 2.57zm-9.429 9.6l9.344 9.258c-2.4-.086-4.801-.943-6.601-2.743-1.8-1.8-2.743-4.201-2.743-6.515z" />
                      </svg>
                      <svg
                        id="angular-logo"
                        className="w-full opacity-75 fill-current"
                        role="img"
                        viewBox="0 0 24 24"
                      >
                        <title>Angular icon</title>
                        <path d="M9.931 12.645h4.138l-2.07-4.908m0-7.737L.68 3.982l1.726 14.771L12 24l9.596-5.242L23.32 3.984 11.999.001zm7.064 18.31h-2.638l-1.422-3.503H8.996l-1.422 3.504h-2.64L12 2.65z" />
                      </svg>
                      <svg
                        id="nest-logo"
                        className="w-full opacity-75 fill-current"
                        role="img"
                        viewBox="0 0 24 24"
                      >
                        <path d="M14.131.047c-.173 0-.334.037-.483.087.316.21.49.49.576.806.007.043.019.074.025.117a.681.681 0 0 1 .013.112c.024.545-.143.614-.26.936-.18.415-.13.861.086 1.22a.74.74 0 0 0 .074.137c-.235-1.568 1.073-1.803 1.314-2.293.019-.428-.334-.713-.613-.911a1.37 1.37 0 0 0-.732-.21zM16.102.4c-.024.143-.006.106-.012.18-.006.05-.006.112-.012.161-.013.05-.025.1-.044.149-.012.05-.03.1-.05.149l-.067.142c-.02.025-.031.05-.05.075l-.037.055a2.152 2.152 0 0 1-.093.124c-.037.038-.068.081-.112.112v.006c-.037.031-.074.068-.118.1-.13.099-.278.173-.415.266-.043.03-.087.056-.124.093a.906.906 0 0 0-.118.099c-.043.037-.074.074-.111.118-.031.037-.068.08-.093.124a1.582 1.582 0 0 0-.087.13c-.025.05-.043.093-.068.142-.019.05-.037.093-.05.143a2.007 2.007 0 0 0-.043.155c-.006.025-.006.056-.012.08-.007.025-.007.05-.013.075 0 .05-.006.105-.006.155 0 .037 0 .074.006.111 0 .05.006.1.019.155.006.05.018.1.03.15.02.049.032.098.05.148.013.03.031.062.044.087l-1.426-.552c-.241-.068-.477-.13-.719-.186l-.39-.093c-.372-.074-.75-.13-1.128-.167-.013 0-.019-.006-.031-.006A11.082 11.082 0 0 0 8.9 2.855c-.378.025-.756.074-1.134.136a12.45 12.45 0 0 0-.837.174l-.279.074c-.092.037-.18.08-.266.118l-.205.093c-.012.006-.024.006-.03.012-.063.031-.118.056-.174.087a2.738 2.738 0 0 0-.236.118c-.043.018-.086.043-.124.062a.559.559 0 0 1-.055.03c-.056.032-.112.063-.162.094a1.56 1.56 0 0 0-.148.093c-.044.03-.087.055-.124.086-.006.007-.013.007-.019.013-.037.025-.08.056-.118.087l-.012.012-.093.074c-.012.007-.025.019-.037.025-.031.025-.062.056-.093.08-.006.013-.019.02-.025.025-.037.038-.074.069-.111.106-.007 0-.007.006-.013.012a1.742 1.742 0 0 0-.111.106c-.007.006-.007.012-.013.012a1.454 1.454 0 0 0-.093.1c-.012.012-.03.024-.043.036a1.374 1.374 0 0 1-.106.112c-.006.012-.018.019-.024.03-.05.05-.093.1-.143.15l-.018.018c-.1.106-.205.211-.317.304-.111.1-.229.192-.347.273a3.777 3.777 0 0 1-.762.421c-.13.056-.267.106-.403.149-.26.056-.527.161-.756.18-.05 0-.105.012-.155.018l-.155.037-.149.056c-.05.019-.099.044-.148.068-.044.031-.093.056-.137.087a1.011 1.011 0 0 0-.124.106c-.043.03-.087.074-.124.111-.037.043-.074.08-.105.124-.031.05-.068.093-.093.143a1.092 1.092 0 0 0-.087.142c-.025.056-.05.106-.068.161-.019.05-.037.106-.056.161-.012.05-.025.1-.03.15 0 .005-.007.012-.007.018-.012.056-.012.13-.019.167C.006 7.95 0 7.986 0 8.03a.657.657 0 0 0 .074.31v.006c.019.037.044.075.069.112.024.037.05.074.08.111.031.031.068.069.106.1a.906.906 0 0 0 .117.099c.149.13.186.173.378.272.031.019.062.031.1.05.006 0 .012.006.018.006 0 .013 0 .019.006.031a1.272 1.272 0 0 0 .08.298c.02.037.032.074.05.111.007.013.013.025.02.031.024.05.049.093.073.137l.093.13c.031.037.069.08.106.118.037.037.074.068.118.105 0 0 .006.006.012.006.037.031.074.062.112.087a.986.986 0 0 0 .136.08c.043.025.093.05.142.069a.73.73 0 0 0 .124.043c.007.006.013.006.025.012.025.007.056.013.08.019-.018.335-.024.65.026.762.055.124.328-.254.6-.688-.036.428-.061.93 0 1.079.069.155.44-.329.763-.862 4.395-1.016 8.405 2.02 8.826 6.31-.08-.67-.905-1.041-1.283-.948-.186.458-.502 1.047-1.01 1.413.043-.41.025-.83-.062-1.24a4.009 4.009 0 0 1-.769 1.562c-.588.043-1.177-.242-1.487-.67-.025-.018-.031-.055-.05-.08-.018-.043-.037-.087-.05-.13a.515.515 0 0 1-.037-.13c-.006-.044-.006-.087-.006-.137v-.093a.992.992 0 0 1 .031-.13c.013-.043.025-.086.044-.13.024-.043.043-.087.074-.13.105-.298.105-.54-.087-.682a.706.706 0 0 0-.118-.062c-.024-.006-.055-.018-.08-.025l-.05-.018a.847.847 0 0 0-.13-.031.472.472 0 0 0-.13-.019 1.01 1.01 0 0 0-.136-.012c-.031 0-.062.006-.093.006a.484.484 0 0 0-.137.019c-.043.006-.086.012-.13.024a1.068 1.068 0 0 0-.13.044c-.043.018-.08.037-.124.056-.037.018-.074.043-.118.062-1.444.942-.582 3.148.403 3.787-.372.068-.75.148-.855.229l-.013.012c.267.161.546.298.837.416.397.13.818.247 1.004.297v.006a5.996 5.996 0 0 0 1.562.112c2.746-.192 4.996-2.281 5.405-5.033l.037.161c.019.112.043.23.056.347v.006c.012.056.018.112.025.162v.024c.006.056.012.112.012.162.006.068.012.136.012.204v.1c0 .03.007.067.007.098 0 .038-.007.075-.007.112v.087c0 .043-.006.08-.006.124 0 .025 0 .05-.006.08 0 .044-.006.087-.006.137-.006.018-.006.037-.006.055l-.02.143c0 .019 0 .037-.005.056-.007.062-.019.118-.025.18v.012l-.037.174v.018l-.037.167c0 .007-.007.02-.007.025a1.663 1.663 0 0 1-.043.168v.018c-.019.062-.037.118-.05.174-.006.006-.006.012-.006.012l-.056.186c-.024.062-.043.118-.068.18-.025.062-.043.124-.068.18-.025.062-.05.117-.074.18h-.007c-.024.055-.05.117-.08.173a.302.302 0 0 1-.019.043c-.006.006-.006.013-.012.019a5.867 5.867 0 0 1-1.742 2.082c-.05.031-.099.069-.149.106-.012.012-.03.018-.043.03a2.603 2.603 0 0 1-.136.094l.018.037h.007l.26-.037h.006c.161-.025.322-.056.483-.087.044-.006.093-.019.137-.031l.087-.019c.043-.006.086-.018.13-.024.037-.013.074-.02.111-.031.62-.15 1.221-.354 1.798-.595a9.926 9.926 0 0 1-3.85 3.142c.714-.05 1.426-.167 2.114-.366a9.903 9.903 0 0 0 5.857-4.68 9.893 9.893 0 0 1-1.667 3.986 9.758 9.758 0 0 0 1.655-1.376 9.824 9.824 0 0 0 2.61-5.268c.21.98.272 1.99.18 2.987 4.474-6.241.371-12.712-1.346-14.416-.006-.013-.012-.019-.012-.031-.006.006-.006.006-.006.012 0-.006 0-.006-.007-.012 0 .074-.006.148-.012.223a8.34 8.34 0 0 1-.062.415c-.03.136-.068.273-.105.41-.044.13-.093.266-.15.396a5.322 5.322 0 0 1-.185.378 4.735 4.735 0 0 1-.477.688c-.093.111-.192.21-.292.31a3.994 3.994 0 0 1-.18.155l-.142.124a3.459 3.459 0 0 1-.347.241 4.295 4.295 0 0 1-.366.211c-.13.062-.26.118-.39.174a4.364 4.364 0 0 1-.818.223c-.143.025-.285.037-.422.05a4.914 4.914 0 0 1-.297.012 4.66 4.66 0 0 1-.422-.025 3.137 3.137 0 0 1-.421-.062 3.136 3.136 0 0 1-.415-.105h-.007c.137-.013.273-.025.41-.05a4.493 4.493 0 0 0 .818-.223c.136-.05.266-.112.39-.174.13-.062.248-.13.372-.204.118-.08.235-.161.347-.248.112-.087.217-.18.316-.279.105-.093.198-.198.291-.304.093-.111.18-.223.26-.334.013-.019.026-.044.038-.062.062-.1.124-.199.18-.298a4.272 4.272 0 0 0 .334-.775c.044-.13.075-.266.106-.403.025-.142.05-.278.062-.415.012-.142.025-.285.025-.421 0-.1-.007-.199-.013-.298a6.726 6.726 0 0 0-.05-.415 4.493 4.493 0 0 0-.092-.415c-.044-.13-.087-.267-.137-.397-.05-.13-.111-.26-.173-.384-.069-.124-.137-.248-.211-.366a6.843 6.843 0 0 0-.248-.34c-.093-.106-.186-.212-.285-.317a3.878 3.878 0 0 0-.161-.155c-.28-.217-.57-.421-.862-.607a1.154 1.154 0 0 0-.124-.062 2.415 2.415 0 0 0-.589-.26Z" />
                      </svg>
                      <svg
                        id="storybook-logo"
                        className="w-full opacity-75 fill-current"
                        role="img"
                        viewBox="0 0 24 24"
                      >
                        <path d="M16.71.243l-.12 2.71a.18.18 0 00.29.15l1.06-.8.9.7a.18.18 0 00.28-.14l-.1-2.76 1.33-.1a1.2 1.2 0 011.279 1.2v21.596a1.2 1.2 0 01-1.26 1.2l-16.096-.72a1.2 1.2 0 01-1.15-1.16l-.75-19.797a1.2 1.2 0 011.13-1.27L16.7.222zM13.64 9.3c0 .47 3.16.24 3.59-.08 0-3.2-1.72-4.89-4.859-4.89-3.15 0-4.899 1.72-4.899 4.29 0 4.45 5.999 4.53 5.999 6.959 0 .7-.32 1.1-1.05 1.1-.96 0-1.35-.49-1.3-2.16 0-.36-3.649-.48-3.769 0-.27 4.03 2.23 5.2 5.099 5.2 2.79 0 4.969-1.49 4.969-4.18 0-4.77-6.099-4.64-6.099-6.999 0-.97.72-1.1 1.13-1.1.45 0 1.25.07 1.19 1.87z" />
                      </svg>
                      <svg
                        id="ionic-logo"
                        className="w-full opacity-75 fill-current"
                        role="img"
                        viewBox="0 0 24 24"
                      >
                        <path d="M22.922 7.027l-.103-.23-.169.188c-.408.464-.928.82-1.505 1.036l-.159.061.066.155a9.745 9.745 0 0 1 .75 3.759c0 5.405-4.397 9.806-9.806 9.806-5.409 0-9.802-4.397-9.802-9.802 0-5.405 4.402-9.806 9.806-9.806 1.467 0 2.883.319 4.2.947l.155.075.066-.155a3.767 3.767 0 0 1 1.106-1.453l.197-.159-.225-.117A11.905 11.905 0 0 0 12.001.001c-6.619 0-12 5.381-12 12s5.381 12 12 12 12-5.381 12-12c0-1.73-.361-3.403-1.078-4.973zM12 6.53A5.476 5.476 0 0 0 6.53 12 5.476 5.476 0 0 0 12 17.47 5.476 5.476 0 0 0 17.47 12 5.479 5.479 0 0 0 12 6.53zm10.345-2.007a2.494 2.494 0 1 1-4.988 0 2.494 2.494 0 0 1 4.988 0z" />
                      </svg>
                      <svg
                        id="cypress-logo"
                        className="w-full opacity-75 fill-current"
                        role="img"
                        viewBox="0 0 24 24"
                      >
                        <path d="M11.998 0C5.366 0 0 5.367 0 12a11.992 11.992 0 0 0 12 12c6.633 0 12-5.367 12-12-.001-6.633-5.412-12-12.002-12zM6.37 14.575c.392.523.916.742 1.657.742.35 0 .699-.044 1.004-.175.306-.13.655-.306 1.09-.567l1.223 1.745c-1.003.83-2.138 1.222-3.447 1.222-1.048 0-1.92-.218-2.705-.654a4.393 4.393 0 0 1-1.746-1.92c-.392-.83-.611-1.79-.611-2.925 0-1.09.219-2.094.61-2.923a4.623 4.623 0 0 1 1.748-2.007c.741-.48 1.657-.698 2.661-.698.699 0 1.353.087 1.877.305a5.64 5.64 0 0 1 1.614.96l-1.222 1.658A4.786 4.786 0 0 0 9.12 8.77c-.305-.13-.698-.174-1.048-.174-1.483 0-2.225 1.134-2.225 3.446-.043 1.18.175 2.008.524 2.532H6.37zm12 2.705c-.436 1.353-1.091 2.357-2.008 3.098-.916.743-2.138 1.135-3.665 1.266l-.305-2.05c1.003-.132 1.745-.35 2.225-.7.174-.13.524-.523.524-.523L11.519 6.764h3.01l2.095 8.683 2.226-8.683h2.923L18.37 17.28z" />
                      </svg>
                      <svg
                        id="typescript-logo"
                        className="w-full opacity-75 fill-current"
                        role="img"
                        viewBox="0 0 24 24"
                      >
                        <path d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.214.776.214 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z" />
                      </svg>
                      <svg
                        id="visualstudiocode-logo"
                        className="w-full opacity-75 fill-current"
                        role="img"
                        viewBox="0 0 24 24"
                      >
                        <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z" />
                      </svg>
                      <svg
                        id="prettier-logo"
                        className="w-full opacity-75 fill-current"
                        role="img"
                        viewBox="0 0 24 24"
                      >
                        <path d="M8.571 23.429A.571.571 0 0 1 8 24H2.286a.571.571 0 0 1 0-1.143H8c.316 0 .571.256.571.572zM8 20.57H6.857a.571.571 0 0 0 0 1.143H8a.571.571 0 0 0 0-1.143zm-5.714 1.143H4.57a.571.571 0 0 0 0-1.143H2.286a.571.571 0 0 0 0 1.143zM8 18.286H2.286a.571.571 0 0 0 0 1.143H8a.571.571 0 0 0 0-1.143zM16 16H5.714a.571.571 0 0 0 0 1.143H16A.571.571 0 0 0 16 16zM2.286 17.143h1.143a.571.571 0 0 0 0-1.143H2.286a.571.571 0 0 0 0 1.143zm17.143-3.429H16a.571.571 0 0 0 0 1.143h3.429a.571.571 0 0 0 0-1.143zM9.143 14.857h4.571a.571.571 0 0 0 0-1.143H9.143a.571.571 0 0 0 0 1.143zm-6.857 0h4.571a.571.571 0 0 0 0-1.143H2.286a.571.571 0 0 0 0 1.143zM20.57 11.43H11.43a.571.571 0 0 0 0 1.142h9.142a.571.571 0 0 0 0-1.142zM9.714 12a.571.571 0 0 0-.571-.571H5.714a.571.571 0 0 0 0 1.142h3.429A.571.571 0 0 0 9.714 12zm-7.428.571h1.143a.571.571 0 0 0 0-1.142H2.286a.571.571 0 0 0 0 1.142zm19.428-3.428H16a.571.571 0 0 0 0 1.143h5.714a.571.571 0 0 0 0-1.143zM2.286 10.286H8a.571.571 0 0 0 0-1.143H2.286a.571.571 0 0 0 0 1.143zm13.143-2.857c0 .315.255.571.571.571h5.714a.571.571 0 0 0 0-1.143H16a.571.571 0 0 0-.571.572zm-8.572-.572a.571.571 0 0 0 0 1.143H8a.571.571 0 0 0 0-1.143H6.857zM2.286 8H4.57a.571.571 0 0 0 0-1.143H2.286a.571.571 0 0 0 0 1.143zm16.571-2.857c0 .315.256.571.572.571h1.142a.571.571 0 0 0 0-1.143H19.43a.571.571 0 0 0-.572.572zm-1.143 0a.571.571 0 0 0-.571-.572H12.57a.571.571 0 0 0 0 1.143h4.572a.571.571 0 0 0 .571-.571zm-15.428.571h8a.571.571 0 0 0 0-1.143h-8a.571.571 0 0 0 0 1.143zm5.143-2.857c0 .316.255.572.571.572h11.429a.571.571 0 0 0 0-1.143H8a.571.571 0 0 0-.571.571zm-5.143.572h3.428a.571.571 0 0 0 0-1.143H2.286a.571.571 0 0 0 0 1.143zm0-2.286H16A.571.571 0 0 0 16 0H2.286a.571.571 0 0 0 0 1.143z" />
                      </svg>
                      <svg
                        id="ionic-logo"
                        className="w-full opacity-75 fill-current"
                        role="img"
                        viewBox="0 0 24 24"
                      >
                        <path d="M22.922 7.027l-.103-.23-.169.188c-.408.464-.928.82-1.505 1.036l-.159.061.066.155a9.745 9.745 0 0 1 .75 3.759c0 5.405-4.397 9.806-9.806 9.806-5.409 0-9.802-4.397-9.802-9.802 0-5.405 4.402-9.806 9.806-9.806 1.467 0 2.883.319 4.2.947l.155.075.066-.155a3.767 3.767 0 0 1 1.106-1.453l.197-.159-.225-.117A11.905 11.905 0 0 0 12.001.001c-6.619 0-12 5.381-12 12s5.381 12 12 12 12-5.381 12-12c0-1.73-.361-3.403-1.078-4.973zM12 6.53A5.476 5.476 0 0 0 6.53 12 5.476 5.476 0 0 0 12 17.47 5.476 5.476 0 0 0 17.47 12 5.479 5.479 0 0 0 12 6.53zm10.345-2.007a2.494 2.494 0 1 1-4.988 0 2.494 2.494 0 0 1 4.988 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="w-full md:w-3/5 flex flex-col justify-between items-start md:pl-16 sm:pb-0 pb-10 mt-8 md:mt-0">
                    <h2 className="text-xl sm:text-2xl lg:text-2xl leading-none font-extrabold tracking-tight mb-4">
                      Rich Plugin Ecosystem
                    </h2>
                    <p className="md:text-lg mb-6">
                      <b>
                        Nx is an open platform with plugins for many modern
                        tools and frameworks.
                      </b>
                      It has support for TypeScript, React, React Native,
                      Angular, NativeScript, Cypress, Jest, Prettier, Nest.js,
                      AngularCLI, Storybook, Ionic, Go, Rust among others. With
                      Nx, you get a consistent dev experience regardless of the
                      tools used.
                    </p>
                    <p className="sm:text-lg mb-0">For instance:</p>
                    <ul className="sm:text-lg list-disc list-inside mt-0">
                      <li>
                        Use{' '}
                        <a
                          className="underline pointer"
                          target="_blank"
                          href="https://blog.nrwl.io/painlessly-build-and-deploy-next-js-apps-with-nx-225e2721da78?source=friends_link&sk=b381e3b9e7a2d8951fbe806ac0363851"
                          rel="noreferrer"
                        >
                          Next.js
                        </a>
                        ,{' '}
                        <a
                          className="underline pointer"
                          target="_blank"
                          href="https://blog.nrwl.io/step-to-step-guide-on-creating-a-blog-using-nx-gatsby-wordpress-ac7e9bfc0efd?source=friends_link&sk=5af5e109144bc4985f3fe8d92429463b"
                          rel="noreferrer"
                        >
                          Gatsby
                        </a>
                        ,{' '}
                        <a
                          className="underline pointer"
                          target="_blank"
                          href="https://blog.nrwl.io/introducing-react-native-support-for-nx-48d335e90c89?source=friends_link&sk=e04878accafe0d9f696b647d0b9ae2d4"
                          rel="noreferrer"
                        >
                          React Native
                        </a>{' '}
                        and share code between them.
                      </li>
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
            </div>
          </div>

          <div className="max-w-screen-lg xl:max-w-screen-xl mx-auto px-5 py-5">
            {/*LEARNING MATERIALS*/}
            <div className="my-16 md:my-32 flex sm:flex-row flex-col">
              <div className="w-full sm:w-1/2 flex flex-col justify-center items-center sm:pb-0 sm:pr-16 pb-10 mt-8 sm:mt-0">
                <a
                  className="cursor-pointer underline"
                  href="https://egghead.io/courses/scale-react-development-with-nx-4038?utm_source=nx.dev"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Image
                    src="/images/nx-on-egghead.webp"
                    alt="Nx on Eggheadio illustration"
                    width={674}
                    height={352}
                  />
                </a>
              </div>
              <div className="w-full sm:w-1/2 flex flex-col justify-center sm:pb-0 pb-10 sm:pl-16 mt-8 sm:mt-0">
                <h2 className="text-xl sm:text-2xl lg:text-2xl leading-none font-extrabold tracking-tight mb-4">
                  Get access to key learning materials
                </h2>
                <p className="sm:text-lg mb-6">
                  With accessible and free online content about Nx, you can
                  quickly get up and running with all of Nx's features. Nx
                  tutorials and resources are continuously updated with the
                  latest version. Plus, when you're looking for advanced courses
                  visit{' '}
                  <a
                    className="cursor-pointer underline"
                    href="https://nxplaybook.com/?utm_source=nx.dev"
                    target="_blank"
                    rel="noreferrer"
                  >
                    NxPlaybook.com
                  </a>
                  .
                </p>
                <div className="mt-8 flex lg:mt-0 lg:flex-shrink-0">
                  <div className="inline-flex rounded-md shadow">
                    <a
                      target="_blank"
                      href="https://egghead.io/courses/scale-react-development-with-nx-4038?utm_source=nx.dev"
                      className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-nx-dark"
                      rel="noreferrer"
                    >
                      Watch Nx Workspaces Course
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-nx-base text-white">
            <div className="max-w-screen-lg xl:max-w-screen-xl mx-auto px-5 py-5">
              {/*MORE*/}
              <div className="my-16 md:my-32 flex sm:flex-row flex-col">
                <div className="w-full sm:w-1/2 flex flex-col justify-center sm:pr-16 sm:pb-0 pb-10 mt-8 sm:mt-0">
                  <h3 className="text-xl sm:text-2xl lg:text-2xl leading-none font-extrabold tracking-tight mb-4">
                    Nx and Nx Console
                  </h3>
                  <p className="sm:text-lg mb-6">
                    For developers, Nx extends Nx Console to give you more
                    visibility into your workspace. With Nx Console and Nx in
                    your workflow you can reduce the time it takes to build
                    high-quality software at scale, and improve best-practices
                    across your organization.{' '}
                    <a
                      href="https://nx.dev/getting-started/console#nx-console-for-vscode"
                      target="_blank"
                      className="cursor-pointer underline"
                      rel="noreferrer"
                    >
                      Try out Nx Console
                    </a>
                    .
                  </p>
                </div>
                <div className="w-full sm:w-1/2 flex flex-col justify-center sm:pl-16 sm:pb-0 pb-10 mt-8 sm:mt-0">
                  <h3 className="text-xl sm:text-2xl lg:text-2xl leading-none font-extrabold tracking-tight mb-4">
                    Brought to you by the community
                  </h3>
                  <p className="sm:text-lg mb-6">
                    Nx is built and maintained as an open-source toolkit for
                    developers by community contributors alongside the experts
                    at Nrwl, a software consulting firm with renowned JavaScript
                    experts and core contributors. To learn more, visit{' '}
                    <a
                      href="https://nrwl.io/?utm_source=nx.dev"
                      target="_blank"
                      className="cursor-pointer underline"
                      rel="noreferrer"
                    >
                      nrwl.io
                    </a>
                    .
                  </p>
                </div>
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

export default Index;
