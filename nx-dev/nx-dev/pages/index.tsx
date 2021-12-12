import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { NextSeo } from 'next-seo';
import {
  Footer,
  Header,
  NpxCreateNxWorkspace,
  NxUsersShowcase,
} from '@nrwl/nx-dev/ui-common';
import { sendCustomEvent } from '@nrwl/nx-dev/feature-analytics';
import {
  AffectedCommand,
  CloudSupport,
  DependencyGraph,
  EcosystemFeatures,
  EggheadCourses,
  ExperienceFeatures,
  GettingStarted,
  MonorepoFeatures,
  NxPlaybook,
  OpenPlatform,
  OpenSourceProjects,
  Performance,
  VscodePlugin,
  YoutubeChannel,
} from '@nrwl/nx-dev/ui-home';
import { InlineCommand } from '@nrwl/nx-dev/ui-commands';

export function Index() {
  const router = useRouter();

  return (
    <>
      <NextSeo
        title="Nx: Smart, Extensible Build Framework"
        description="Nx is a smart and extensible build framework to help you architect, test, and build at any scale — integrating seamlessly with modern technologies and frameworks while providing a distributed graph-based task execution, computation caching, smart rebuilds of affected projects, powerful code generators, editor support, GitHub apps, full monorepo support and more."
        openGraph={{
          url: 'https://nx.dev',
          title: 'Nx: Smart, Extensible Build Framework',
          description:
            'Nx is a smart and extensible build framework to help you architect, test, and build at any scale — integrating seamlessly with modern technologies and frameworks while providing a distributed graph-based task execution, computation caching, smart rebuilds of affected projects, powerful code generators, editor support, GitHub apps, full monorepo support and more.',
          images: [
            {
              url: 'https://nx.dev/images/nx-media.jpg',
              width: 800,
              height: 400,
              alt: 'Nx: Smart, Extensible Build Framework',
              type: 'image/jpeg',
            },
          ],
          site_name: 'NxDev',
          type: 'website',
        }}
      />
      <Header showSearch={false} useDarkBackground={false} />
      <main>
        <div className="w-full">
          {/*INTRO COMPONENT*/}
          <div
            id="animated-background"
            className="bg-blue-nx-base text-white transform-gpu lg:bg-contain bg-clip-border bg-origin-border bg-right bg-no-repeat"
            style={{
              backgroundImage: 'url(/images/background/hero-bg-large.svg)',
            }}
          >
            <div className="max-w-screen-lg xl:max-w-screen-xl mx-auto px-4 py-4 md:py-24">
              <div className="my-8 md:my-18 2xl:my-24 flex lg:flex-row flex-col items-center justify-center">
                <div className="w-full lg:w-1/2 flex flex-col">
                  <h1 className="text-center md:text-left text-4xl sm:text-5xl lg:text-6xl leading none font-extrabold tracking-tight sm:mt-10 mb-8 sm:mt-14 sm:mb-10">
                    <span className="block md:inline">Smart, Extensible</span>{' '}
                    Build Framework
                  </h1>
                  <h2 className="text-2xl font-medium mb-1">
                    Nx helps <b>architect</b>, <b>test</b>, and <b>build</b> at
                    any scale:
                  </h2>
                  <p className="max-w-screen-lg text-lg font-medium mb-10 sm:mb-11 flex flex-wrap">
                    <span className="rounded px-1 mr-1 mb-1 text-white bg-blue-nx-base">
                      integrations with modern frameworks
                    </span>
                    <span className="rounded px-1 mr-1 mb-1 text-white bg-blue-nx-base">
                      computation caching
                    </span>
                    <span className="rounded px-1 mr-1 mb-1 text-white bg-blue-nx-base">
                      smart rebuilds of affected projects
                    </span>
                    <span className="rounded px-1 mr-1 mb-1 text-white bg-blue-nx-base">
                      distributed task execution
                    </span>
                    <span className="rounded px-1 mr-1 mb-1 text-white bg-blue-nx-base">
                      powerful code generators
                    </span>
                    <span className="rounded px-1 mr-1 mb-1 text-white bg-blue-nx-base">
                      editor support
                    </span>
                    <span className="rounded px-1 mr-1 mb-1 text-white bg-blue-nx-base">
                      GitHub apps
                    </span>
                    and more.
                  </p>

                  <div className="flex flex-wrap space-y-4 sm:space-y-0 sm:space-x-4 text-center">
                    <Link href="#getting-started">
                      <a className="w-full sm:w-auto flex-none bg-white text-blue-nx-base hover:text-blue-nx-dark hover:bg-gray-100 text-lg leading-6 font-semibold py-3 px-6 border border-transparent rounded-md focus:ring-2 focus:ring-offset-2 focus:ring-offset-white transition">
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
                  <NpxCreateNxWorkspace />
                </div>
              </div>
            </div>
          </div>

          <div className="hidden md:block bg-gray-50 border-b border-gray-100">
            {/*COMPANIES*/}
            <NxUsersShowcase />
          </div>

          {/*NX FEATURES*/}
          <div
            id="features"
            className="relative bg-gray-50 py-12 overflow-hidden"
          >
            {/*MONOREPO*/}
            <MonorepoFeatures />
            <div className="relative my-12" aria-hidden="true">
              <div className="w-full border-t border-gray-100" />
            </div>

            {/*INTEGRATED*/}
            <ExperienceFeatures />
            <div className="relative my-12" aria-hidden="true">
              <div className="w-full border-t border-gray-100" />
            </div>
            {/*ECOSYSTEM*/}
            <EcosystemFeatures />
          </div>

          <div className="bg-gray-50 relative transform-gpu">
            <img
              className="w-full"
              src="/images/background/hero-bg-large-3.svg"
              alt="separator"
            />
          </div>

          {/*NX FEATURE DETAILS*/}
          <div
            id="features-in-depth"
            className="relative bg-gray-50 pb-32 overflow-hidden"
          >
            <div className="max-w-prose mx-auto py-16 px-4 sm:py-24 sm:px-6 lg:px-8">
              <div className="text-center">
                <h2 className="text-base font-semibold text-blue-nx-base tracking-wide uppercase">
                  Monorepo done right
                </h2>
                <p className="mt-1 text-4xl font-extrabold text-gray-900 sm:text-5xl sm:tracking-tight lg:text-6xl">
                  Works for Projects of Any Size
                </p>
                <p className="max-w-xl mt-5 mx-auto text-xl text-gray-500">
                  Whether you have one project or one thousand, Nx will keep
                  your CI fast and your workspace maintainable.
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
          <div
            id="getting-started"
            className="relative bg-white pt-16 sm:pt-24 lg:pt-32"
          >
            <div className="mx-auto max-w-prose px-4 text-center sm:px-6 sm:max-w-3xl lg:px-8">
              <div>
                <h2 className="text-base font-semibold tracking-wider text-blue-nx-base uppercase">
                  Getting Started
                </h2>
                <p className="mt-2 text-4xl font-extrabold text-gray-800 tracking-tight sm:text-6xl">
                  TypeScript, React, Angular, Node and more
                </p>
                <p className="mt-5 max-w-prose mx-auto text-xl text-gray-500">
                  Nx has first-class support for many frontend and backend
                  technologies, so its documentation comes in multiple flavours.
                </p>
              </div>
            </div>

            <GettingStarted />
          </div>

          <div
            id="learning-materials"
            className="mt-28 max-w-prose mx-auto py-16 px-4 sm:py-18 sm:px-6 lg:px-8"
          >
            <div className="text-center">
              <p className="mt-1 text-4xl font-extrabold text-gray-800 sm:text-5xl sm:tracking-tight lg:text-6xl">
                Free Courses and Videos
              </p>
              <p className="max-w-xl mt-5 mx-auto text-xl text-gray-500">
                For visual learners we have created high-quality courses walking
                you through building real-world examples step by step.
              </p>
            </div>
          </div>

          {/*TUTORIALS*/}
          <div className="bg-white py-12">
            <EggheadCourses />
          </div>
          <div className="bg-white py-12">
            <YoutubeChannel />
          </div>
          <div className="bg-white py-12">
            <NxPlaybook />
          </div>

          <div className="bg-white relative transform-gpu">
            <img
              className="w-full"
              src="/images/background/hero-bg-large-2.svg"
              alt="separator"
            />
          </div>

          {/*COMMUNITY*/}
          <div id="community" className="bg-white">
            <div className="max-w-prose mx-auto py-16 px-4 sm:py-18 sm:px-6 lg:px-8">
              <div className="text-center">
                <h2 className="text-base font-semibold text-gray-600 tracking-wide uppercase">
                  Community
                </h2>
                <p className="mt-1 text-4xl font-extrabold text-gray-800 sm:text-5xl sm:tracking-tight lg:text-6xl">
                  Used by Popular Open Source Projects
                </p>
                <p className="max-w-xl mt-5 mx-auto text-xl text-gray-500">
                  Nx works equally well for the teams building apps and for the
                  communities building open source libraries and tools.
                </p>
              </div>
            </div>

            {/*OPEN SOURCE PROJECTS*/}
            <OpenSourceProjects />

            {/*/!*TESTIMONIALS*!/*/}
            {/*<div*/}
            {/*  id="testimonials"*/}
            {/*  className="mt-28 max-w-prose mx-auto py-16 px-4 sm:py-18 sm:px-6 lg:px-8"*/}
            {/*>*/}
            {/*  <div className="text-center">*/}
            {/*    <p className="mt-1 text-4xl font-extrabold text-gray-800 sm:text-5xl sm:tracking-tight lg:text-6xl">*/}
            {/*      What Devs Love About Nx*/}
            {/*    </p>*/}
            {/*    <p className="max-w-xl mt-5 mx-auto text-xl text-gray-500">*/}
            {/*      More than 600k developers all over the world build and ship*/}
            {/*      with Nx. This is what they love about it.*/}
            {/*    </p>*/}
            {/*  </div>*/}
            {/*</div>*/}
            {/*/!*TESTIMONIALS*!/*/}
            {/*<Testimonials />*/}
            {/*COMPANIES*/}
            <div className="my-12">
              <NxUsersShowcase />
            </div>
          </div>
        </div>
      </main>
      <Footer useDarkBackground={false} />
    </>
  );
}

export default Index;
