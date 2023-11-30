import {
  ChevronRightIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';
import { ButtonLink, Footer, Header } from '@nx/nx-dev/ui-common';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { CopyToClipboard } from 'react-copy-to-clipboard';

export default function Blog(): JSX.Element {
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
              url: 'https://nx.dev/socials/nx-media.png',
              width: 800,
              height: 421,
              alt: 'Nx: Smart, Fast and Extensible Build System',
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
          <div className="py-8 bg-slate-50 dark:bg-slate-800/40">
            <div className="video-responsive flex items-center justify-center">
              <iframe
                width="853"
                height="480"
                src={`https://www.youtube.com/embed/cOHIO5UXqMw`}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="Embedded youtube"
              />
            </div>
            <div className="flex flex-wrap space-y-4 sm:space-y-0 sm:space-x-4 items-center justify-center mt-8">
              <ButtonLink
                href="https://github.com/nrwl/ts-aoc-starter"
                variant="primary"
                size="large"
                title="Start using Nx by creating a workspace"
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
                  title="Create an Nx workspace"
                  className="group relative flex w-full items-center rounded-lg border border-slate-200 bg-white py-3 px-6 text-lg font-semibold leading-6 transition hover:bg-slate-100 focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 sm:w-auto"
                >
                  <span className="absolute top-1 right-1 flex opacity-0 transition-opacity group-hover:opacity-100">
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
            <article className="mx-auto px-4 sm:px-6 lg:items-center lg:px-8">
              <main className="grid grid-cols-1 gap-5 md:grid-cols-3 pt-10 pb-24">
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
                      Advent of Code is an Advent calendar of small programming
                      puzzles for a variety of skill sets and skill levels that
                      can be solved in any programming language you like.
                    </p>
                  </a>
                </div>
                <div className="group relative rounded-lg border border-slate-200 bg-white/60 p-5 transition duration-200 ease-out hover:border-indigo-300 dark:border-slate-800/40 dark:bg-slate-800/60 dark:hover:border-indigo-900 dark:hover:bg-slate-800">
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
                  <h4 className="mb-2 text-lg font-bold">Follow Us On X</h4>
                  <a
                    href="https://x.com/nxdevtools"
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
                      Follow us on X for the latest news, updates, and
                      conversations with the Nx community.
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
                  <h4 className="mb-2 text-lg font-bold">
                    Like Video Content?
                  </h4>
                  <a
                    href="https://www.youtube.com/@NxDevtools/videos?utm_source=nx.dev"
                    rel="noreferrer"
                    target="_blank"
                    title="Nx Youtube channel"
                    className="focus:outline-none"
                  >
                    <span
                      className="absolute inset-0"
                      aria-hidden="true"
                    ></span>
                    <p className="leading-relaxed">
                      Enjoying this video? Then go to our YT channel to enjoy
                      some short informative clips, release videos or live Q&A
                      sessions. Don't forget to subscribe while you're there!
                    </p>
                  </a>
                </div>
              </main>
            </article>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
