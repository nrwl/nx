import {
  ChevronRightIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';
import {
  ButtonLink,
  DiscordIcon,
  Footer,
  Header,
  SectionHeading,
} from '@nx/nx-dev/ui-common';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { CopyToClipboard } from 'react-copy-to-clipboard';

export default function AdventOfCode(): JSX.Element {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  return (
    <>
      <NextSeo
        title="The ULTIMATE Typescript Starter Repo for Advent of Code 2023"
        description="Our ULTIMATE Typescript Starter Repo for Advent of Code 2023"
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'The ULTIMATE Typescript Starter Repo for Advent of Code 2023',
          description:
            'Our ULTIMATE Typescript Starter Repo for Advent of Code 2023',
          images: [
            {
              url: 'https://nx.dev/socials/ultimate-typescript-aoc-2023.jpg',
              width: 800,
              height: 421,
              alt: 'Nx Advent of Code',
              type: 'image/jpeg',
            },
          ],
          siteName: 'NxDev',
          type: 'website',
        }}
      />
      <Header />
      <main id="main" role="main">
        <div className="w-full">
          <div
            id="connect-with-us"
            className="py-18 bg-slate-50 dark:bg-slate-800/40"
          >
            <article
              id="advent-of-code"
              className="mx-auto flex max-w-7xl flex-col space-y-12 px-4 py-12 sm:px-6 lg:flex-row lg:items-center lg:space-x-20 lg:space-y-0 lg:px-8 lg:py-16"
            >
              <header className="space-y-10 md:py-12 lg:w-5/12 xl:w-5/12">
                <div>
                  <SectionHeading
                    as="h1"
                    variant="display"
                    id="advent-of-code-title"
                  >
                    Nx Advent of Code
                  </SectionHeading>
                  <p className="mt-4">
                    Join the Nx Community to solve the Advent of Code puzzles
                    together! We have a convenient TypeScript starter kit
                    available to help you get started right away.
                  </p>
                  <div className="mt-8 flex gap-4">
                    <ButtonLink
                      href="https://github.com/nrwl/ts-aoc-starter#running-the-puzzles"
                      variant="primary"
                      size="large"
                      title="Use Nx to setup your Advent of Code workspace"
                    >
                      Get started
                    </ButtonLink>

                    <CopyToClipboard
                      text="npx create-ts-aoc-starter"
                      onCopy={() => {
                        setCopied(true);
                      }}
                    >
                      <button
                        title="Use Nx to setup your Advent of Code workspace"
                        className="text-md group relative flex w-full items-center rounded-lg border border-slate-200 bg-white px-6 py-3 font-semibold leading-6 transition hover:bg-slate-100 focus:ring-2 focus:ring-offset-2 focus:ring-offset-white sm:w-auto dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                      >
                        <span className="absolute right-1 top-1 flex opacity-0 transition-opacity group-hover:opacity-100">
                          {copied ? (
                            <ClipboardDocumentCheckIcon className="h-4 w-4" />
                          ) : (
                            <ClipboardDocumentIcon className="h-4 w-4" />
                          )}
                        </span>
                        <ChevronRightIcon
                          aria-hidden="true"
                          className="font-input-mono mr-2 h-5 w-5 text-blue-500 dark:text-sky-500"
                        />
                        npx create-ts-aoc-starter
                      </button>
                    </CopyToClipboard>
                  </div>
                </div>
              </header>

              <div className="relative flex-none lg:w-7/12 xl:w-7/12">
                <div className="video-responsive flex items-center justify-center">
                  <iframe
                    src={`https://www.youtube.com/embed/cOHIO5UXqMw`}
                    className="mb-1 aspect-video w-full rounded-lg shadow-lg"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title="Nx Advent of Code"
                  />
                </div>
              </div>
            </article>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/40">
            {/* <div className="max-w-screen-lg mx-auto"> */}
            <div className="mx-auto max-w-7xl">
              <article className="mx-auto px-4 sm:px-6 lg:items-center lg:px-8">
                <main className="grid grid-cols-1 gap-5 pb-24 pt-10 md:grid-cols-3">
                  <div className="group relative rounded-lg border border-slate-200 bg-white/60 p-5 transition duration-200 ease-out hover:border-slate-300 dark:border-slate-800/40 dark:bg-slate-800/60 dark:hover:border-slate-900 dark:hover:bg-slate-800">
                    <div className="relative m-2 mb-6 inline-flex h-10 w-10 items-center justify-center">
                      <div className="absolute inset-0 -m-2 rotate-6 transform rounded-3xl bg-slate-300 transition duration-200 ease-out group-hover:-rotate-3 group-hover:scale-105 dark:bg-slate-800" />
                      <div className="absolute inset-0 -rotate-6 transform rounded-2xl bg-[#000000] bg-opacity-75 shadow-inner transition duration-200 ease-out group-hover:rotate-2 group-hover:scale-105" />
                      <img
                        src="https://adventofcode.com/favicon.png"
                        alt="Advent of Code"
                        className="z-50 h-6 w-6 rounded-full"
                      />
                    </div>
                    <h4 className="mb-2 text-lg font-bold">Advent of Code</h4>
                    <a
                      href="https://adventofcode.com"
                      rel="noreferrer"
                      target="_blank"
                      title="Nrwl Blog"
                      className="focus:outline-none"
                    >
                      <span
                        className="absolute inset-0"
                        aria-hidden="true"
                      ></span>
                      <p className="leading-relaxed">
                        Advent of Code is an Advent calendar of small
                        programming puzzles for a variety of skill sets and
                        skill levels that can be solved in any programming
                        language you like.
                      </p>
                    </a>
                  </div>
                  <div className="group relative rounded-lg border border-slate-200 bg-white/60 p-5 transition duration-200 ease-out hover:border-indigo-300 dark:border-slate-800/40 dark:bg-slate-800/60 dark:hover:border-indigo-900 dark:hover:bg-slate-800">
                    <div className="relative m-2 mb-6 inline-flex h-10 w-10 items-center justify-center">
                      <div className="absolute inset-0 -m-2 rotate-6 transform rounded-3xl bg-indigo-300 transition duration-200 ease-out group-hover:-rotate-3 group-hover:scale-105 dark:bg-indigo-900" />
                      <div className="absolute inset-0 -rotate-6 transform rounded-2xl bg-[#5865F2] bg-opacity-75 shadow-inner transition duration-200 ease-out group-hover:rotate-2 group-hover:scale-105" />
                      <DiscordIcon
                        showTitle={true}
                        className="relative inline-block h-5 w-5 transform text-white transition duration-200 ease-out group-hover:scale-110"
                      />
                    </div>
                    <h4 className="mb-2 text-lg font-bold">
                      Join us on Discord
                    </h4>
                    <a
                      href="https://go.nx.dev/community"
                      rel="noreferrer"
                      target="_blank"
                      title="Nx Official Discord Server"
                      className="focus:outline-none"
                    >
                      <span
                        className="absolute inset-0"
                        aria-hidden="true"
                      ></span>
                      <p className="leading-relaxed">
                        Join our <code>⁠aoc-2023</code> channel on the Nx
                        Community discord to discuss the Advent of Code puzzles
                        or collaborate on them.
                      </p>
                    </a>
                  </div>
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
                      <span
                        className="absolute inset-0"
                        aria-hidden="true"
                      ></span>
                      <p className="leading-relaxed">
                        Stay up to date on everything about Nx by following
                        @NxDevTools on X.
                      </p>
                    </a>
                  </div>
                </main>
              </article>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
