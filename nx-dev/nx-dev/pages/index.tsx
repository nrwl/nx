import {
  Footer,
  Header,
  NpxCreateNxWorkspace,
  NxUsersShowcase,
} from '@nrwl/nx-dev/ui-common';
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
  Testimonials,
  VscodePlugin,
  YoutubeChannel,
} from '@nrwl/nx-dev/ui-home';
import { NextSeo } from 'next-seo';
import Link from 'next/link';
import { ReactComponentElement } from 'react';

export function Index(): ReactComponentElement<any> {
  return (
    <>
      <NextSeo
        title="Nx: Smart, Fast and Extensible Build System"
        description="Next generation build system with first class monorepo support and powerful integrations."
        openGraph={{
          url: 'https://nx.dev',
          title: 'Nx: Smart, Fast and Extensible Build System',
          description:
            'Nx is a smart, fast and extensible build system which comes with first class monorepo support and powerful integrations.',
          images: [
            {
              url: 'https://nx.dev/images/nx-media.jpg',
              width: 800,
              height: 400,
              alt: 'Nx: Smart, Fast and Extensible Build System',
              type: 'image/jpeg',
            },
          ],
          site_name: 'Nx',
          type: 'website',
        }}
      />
      <h1 className="sr-only">Next generation monorepo tool</h1>
      <Header useDarkBackground={false} />
      <main id="main" role="main">
        <div className="w-full">
          {/*INTRO COMPONENT*/}
          <header
            id="animated-background"
            className="bg-blue-nx-base transform-gpu bg-clip-border bg-right bg-no-repeat bg-origin-border text-white lg:bg-cover"
            style={{
              backgroundImage: 'url(/images/background/hero-bg-large.svg)',
            }}
          >
            <div className="md:py-18 mx-auto max-w-screen-lg px-4 py-4 xl:max-w-screen-xl">
              <div className="md:my-18 my-8 flex flex-col  items-center justify-center 2xl:my-24">
                <div className="flex w-full flex-col text-center">
                  <h1 className="mb-8 text-4xl font-extrabold leading-none tracking-tight sm:mt-10 sm:mt-14 sm:mb-10 sm:text-5xl lg:text-5xl">
                    <span className="block lg:inline">
                      Smart, Fast and Extensible
                    </span>{' '}
                    Build System
                  </h1>
                  <h2 className="mx-auto mb-10 max-w-2xl text-2xl font-semibold sm:mb-11">
                    Next generation build system with first class monorepo
                    support and powerful integrations.
                  </h2>
                </div>
                <div
                  aria-hidden="true"
                  className="mx-auto mt-8 hidden w-full max-w-2xl flex-col items-center justify-between pb-10 sm:flex lg:mt-0 lg:pb-0"
                >
                  <NpxCreateNxWorkspace />
                </div>
                <div className="my-14 flex flex-wrap text-center sm:space-x-4">
                  <Link href="#getting-started">
                    <a
                      title="Start using Nx by creating a workspace"
                      className="text-blue-nx-base hover:text-blue-nx-dark w-full flex-none rounded-md border border-transparent bg-white py-3 px-6 text-lg font-semibold leading-6 transition hover:bg-gray-100 focus:ring-2 focus:ring-offset-2 focus:ring-offset-white sm:w-auto"
                    >
                      Create Nx Workspace
                    </a>
                  </Link>

                  <Link href="/migration/adding-to-monorepo">
                    <a
                      title="Add Nx to existing Monorepo"
                      className="text-blue-nx-base hover:text-blue-nx-dark mt-4 w-full flex-none rounded-md border border-transparent bg-white py-3 px-6 text-lg font-semibold leading-6 transition hover:bg-gray-100 focus:ring-2 focus:ring-offset-2 focus:ring-offset-white sm:w-auto md:mt-0"
                    >
                      Add Nx to Monorepo
                    </a>
                  </Link>
                </div>
              </div>
            </div>
          </header>

          <div className="hidden border-b border-gray-100 bg-gray-50 md:block">
            {/*COMPANIES*/}
            <NxUsersShowcase />
          </div>

          {/*NX FEATURES*/}
          <div
            id="features"
            className="relative overflow-hidden bg-gray-50 py-12"
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

          <div className="relative transform-gpu bg-gray-50">
            <img
              className="w-full"
              src="/images/background/hero-bg-large-3.svg"
              loading="lazy"
              alt="separator"
              aria-hidden="true"
            />
          </div>

          {/*NX FEATURE DETAILS*/}
          <article
            id="features-in-depth"
            className="relative overflow-hidden bg-gray-50 pb-32"
          >
            <header className="mx-auto max-w-prose py-16 px-4 sm:py-24 sm:px-6 lg:px-8">
              <div className="text-center">
                <h1 className="text-blue-nx-base text-base font-semibold uppercase tracking-wide">
                  Monorepo done right
                </h1>
                <p className="mt-1 text-4xl font-extrabold text-gray-900 sm:text-5xl sm:tracking-tight lg:text-6xl">
                  Works for Projects of Any Size
                </p>
                <p className="mx-auto mt-5 max-w-xl text-xl text-gray-500">
                  Whether you have one project or one thousand, Nx will keep
                  your CI fast and your workspace maintainable.
                </p>
              </div>
            </header>
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
          </article>

          {/*TESTIMONIALS*/}
          <article
            id="testimonials"
            className="relative bg-white pt-16 sm:pt-24 lg:pt-32"
          >
            <header className="sm:py-18 mx-auto max-w-prose px-4 py-16 text-center sm:max-w-3xl sm:px-6 lg:px-8">
              <div>
                <h1 className="text-blue-nx-base text-base font-semibold uppercase tracking-wider">
                  They talk about Nx
                </h1>
                <p className="mt-2 text-4xl font-extrabold tracking-tight text-gray-800 sm:text-6xl">
                  Devs & CEOs, Startups & big companies are loving Nx
                </p>
                <p className="mx-auto mt-5 max-w-prose text-xl text-gray-500">
                  Here is what they say about Nx, what they like about it, how
                  it transforms their developer life and what you are missing
                  out on!
                </p>
              </div>
            </header>

            <Testimonials />
          </article>

          {/*GETTING STARTED*/}
          <article
            id="getting-started"
            className="relative bg-white pt-16 sm:pt-24 lg:pt-32"
          >
            <header className="mx-auto max-w-prose px-4 text-center sm:max-w-3xl sm:px-6 lg:px-8">
              <div>
                <h1 className="text-blue-nx-base text-base font-semibold uppercase tracking-wider">
                  Getting Started <span className="sr-only">With Nx</span>
                </h1>
                <p className="mt-2 text-4xl font-extrabold tracking-tight text-gray-800 sm:text-6xl">
                  TypeScript, React, Angular, Node and more
                </p>
                <p className="mx-auto mt-5 max-w-prose text-xl text-gray-500">
                  Nx has first-class support for many frontend and backend
                  technologies, so its documentation comes in multiple flavours.
                </p>
              </div>
            </header>

            <GettingStarted />
          </article>

          <div
            id="learning-materials"
            className="sm:py-18 mx-auto mt-28 max-w-prose py-16 px-4 sm:px-6 lg:px-8"
          >
            <div className="text-center">
              <p className="mt-1 text-4xl font-extrabold text-gray-800 sm:text-5xl sm:tracking-tight lg:text-6xl">
                Free Courses and Videos
              </p>
              <p className="mx-auto mt-5 max-w-xl text-xl text-gray-500">
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

          <div className="relative transform-gpu bg-white">
            <img
              className="w-full"
              loading="lazy"
              src="/images/background/hero-bg-large-2.svg"
              alt="separator"
              aria-hidden="true"
            />
          </div>

          {/*COMMUNITY*/}
          <article id="community" className="bg-white">
            <div className="sm:py-18 mx-auto max-w-prose py-16 px-4 sm:px-6 lg:px-8">
              <div className="text-center">
                <h1 className="text-base font-semibold uppercase tracking-wide text-gray-600">
                  Community
                </h1>
                <p className="mt-1 text-4xl font-extrabold text-gray-800 sm:text-5xl sm:tracking-tight lg:text-6xl">
                  Used by Popular Open Source Projects
                </p>
                <p className="mx-auto mt-5 max-w-xl text-xl text-gray-500">
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
          </article>
        </div>
      </main>
      <Footer useDarkBackground={false} />
    </>
  );
}

export default Index;
