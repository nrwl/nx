import React from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import {
  Footer,
  Header,
  InlineCommand,
  NxUsersShowcase,
  Testimonials,
} from '@nrwl/nx-dev/ui/common';
import { sendCustomEvent } from '@nrwl/nx-dev/feature-analytics';
import Code from './code';
import {
  AffectedCommand,
  CloudSupport,
  DependencyGraph,
  EcosystemFeatures,
  ExperienceFeatures,
  GettingStarted,
  LearningCourses,
  MonorepoFeatures,
  OpenPlatform,
  OpenSourceProjects,
  Performance,
  VscodePlugin,
  YoutubeChannel,
} from '@nrwl/nx-dev/ui-home';

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
                  <Code />
                </div>
              </div>
            </div>
          </div>

          {/*GITHUB STARS*/}
          {/*<div className="bg-gray-50">*/}
          {/*  <div className="mx-auto w-40 flex justify-center -translate-y-1/2 rounded-md shadow-sm">*/}
          {/*    <div className="bg-purple-nx-base flex-shrink-0 flex items-center justify-center w-16 text-white text-sm font-medium rounded-l-md">*/}
          {/*      <svg*/}
          {/*        xmlns="http://www.w3.org/2000/svg"*/}
          {/*        className="h-6 w-6"*/}
          {/*        fill="currentColor"*/}
          {/*        viewBox="0 0 24 24"*/}
          {/*      >*/}
          {/*        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />*/}
          {/*      </svg>*/}
          {/*    </div>*/}
          {/*    <div className="flex-1 flex items-center justify-between border-t border-r border-b border-gray-200 bg-white rounded-r-md truncate">*/}
          {/*      <div className="flex-1 px-4 py-2 text-xs truncate">*/}
          {/*        <a*/}
          {/*          href="#"*/}
          {/*          className="text-gray-900 font-medium hover:text-gray-600"*/}
          {/*        >*/}
          {/*          Over 12k+*/}
          {/*        </a>*/}
          {/*        <p className="text-gray-500">Github stars</p>*/}
          {/*      </div>*/}
          {/*    </div>*/}
          {/*  </div>*/}
          {/*</div>*/}

          {/*NX FEATURES*/}
          <div className="relative bg-gray-50 py-16 overflow-hidden">
            {/*MONOREPO*/}
            <MonorepoFeatures />
            <div className="relative my-16" aria-hidden="true">
              <div className="w-full border-t border-gray-100" />
            </div>

            {/*INTEGRATED*/}
            <ExperienceFeatures />
            <div className="relative my-16" aria-hidden="true">
              <div className="w-full border-t border-gray-100" />
            </div>
            {/*ECOSYSTEM*/}
            <EcosystemFeatures />
          </div>

          <div className="bg-gray-50 relative transform-gpu">
            <img
              className="w-full"
              src="/images/background/hero-bg-large-3.svg"
              alt=""
            />
          </div>

          {/*NX FEATURE DETAILS*/}
          <div className="relative bg-gray-50 pb-32 overflow-hidden">
            <div className="max-w-prose mx-auto py-16 px-4 sm:py-24 sm:px-6 lg:px-8">
              <div className="text-center">
                <h2 className="text-base font-semibold text-blue-nx-base tracking-wide uppercase">
                  Monorepo done right
                </h2>
                <p className="mt-1 text-4xl font-extrabold text-gray-900 sm:text-5xl sm:tracking-tight lg:text-6xl">
                  Take control of your workspace.
                </p>
                <p className="max-w-xl mt-5 mx-auto text-xl text-gray-500">
                  At its core, Nx focuses on performance and DX. No matter the
                  size of your project, Nx runs seamlessly.
                </p>
              </div>
            </div>
            {/*NX AFFECTED*/}
            <AffectedCommand />
            {/*DEP-GRAPH*/}
            <DependencyGraph />
            {/*NX CONSOLE*/}
            <VscodePlugin />
            {/*NEXT GENERATION CLOUD SUPPORT*/}
            <CloudSupport />
            {/*PERFORMANCE*/}
            <Performance />
            {/*OPEN PLATFORM*/}
            <OpenPlatform />
          </div>

          {/*GETTING STARTED*/}
          <div className="relative bg-white pt-16 sm:pt-24 lg:pt-32">
            <div className="mx-auto max-w-prose px-4 text-center sm:px-6 sm:max-w-3xl lg:px-8">
              <div>
                <h2 className="text-base font-semibold tracking-wider text-blue-nx-base uppercase">
                  Getting STARTED
                </h2>
                <p className="mt-2 text-4xl font-extrabold text-gray-800 tracking-tight sm:text-6xl">
                  Use Nx with or without flavors
                </p>
                <p className="mt-5 max-w-prose mx-auto text-xl text-gray-500">
                  Nx has first-class support for many frontend and backend
                  technologies, so you are always comfortable. No matter your
                  choice, the Nx experience stays the same.
                </p>
              </div>
            </div>

            <GettingStarted />
          </div>

          <div className="mt-28 max-w-prose mx-auto py-16 px-4 sm:py-18 sm:px-6 lg:px-8">
            <div className="text-center">
              <p className="mt-1 text-4xl font-extrabold text-gray-800 sm:text-5xl sm:tracking-tight lg:text-6xl">
                Are you a visual learner?
              </p>
              <p className="max-w-xl mt-5 mx-auto text-xl text-gray-500">
                We did integral courses only for you to help you learn Nx the
                way you like the most. Step by step with real world examples.
              </p>
            </div>
          </div>

          {/*TUTORIALS*/}
          <div className="bg-white py-12">
            <LearningCourses />
          </div>
          <div className="bg-white py-12">
            <YoutubeChannel />
          </div>

          <div className="bg-white relative transform-gpu">
            <img
              className="w-full"
              src="/images/background/hero-bg-large-2.svg"
              alt=""
            />
          </div>

          {/*COMMUNITY*/}
          <div className="bg-white">
            <div className="max-w-prose mx-auto py-16 px-4 sm:py-18 sm:px-6 lg:px-8">
              <div className="text-center">
                <h2 className="text-base font-semibold text-gray-600 tracking-wide uppercase">
                  Community
                </h2>
                <p className="mt-1 text-4xl font-extrabold text-gray-800 sm:text-5xl sm:tracking-tight lg:text-6xl">
                  Build like the best open source projects
                </p>
                <p className="max-w-xl mt-5 mx-auto text-xl text-gray-500">
                  Nx gives your team everything they need to ship better
                  software faster, no doubt why open source projects are using
                  it.
                </p>
              </div>
            </div>

            {/*OPEN SOURCE PROJECTS*/}
            <OpenSourceProjects />

            <div className="mt-28 max-w-prose mx-auto py-16 px-4 sm:py-18 sm:px-6 lg:px-8">
              <div className="text-center">
                <p className="mt-1 text-4xl font-extrabold text-gray-800 sm:text-5xl sm:tracking-tight lg:text-6xl">
                  Learn what they love about Nx
                </p>
                <p className="max-w-xl mt-5 mx-auto text-xl text-gray-500">
                  Developers and Companies build, ship, and maintain their
                  software with Nx, that's something.
                </p>
              </div>
            </div>
            {/*TESTIMONIALS*/}
            <Testimonials />
            {/*COMPANIES*/}
            <NxUsersShowcase />
          </div>
        </div>
      </main>
      <Footer useDarkBackground={false} />
    </>
  );
}

export default Index;
