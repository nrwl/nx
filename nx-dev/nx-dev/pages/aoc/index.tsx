import {
  ChevronRightIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { Footer, Header, SectionHeading } from '@nx/nx-dev/ui-common';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
import { useState } from 'react';

export default function Blog(): JSX.Element {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  return (
    <>
      <NextSeo
        title="ts-aoc-starter"
        description="Our ULTIMATE Typescript Starter Repo for Advent of Code 2023"
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'ts-aoc-starter',
          description:
            'Our ULTIMATE Typescript Starter Repo for Advent of Code 2023',
          images: [
            {
              url: 'https://nx.dev/socials/ultimate-typescript-aoc-2023.png',
              width: 800,
              height: 421,
              alt: 'The ULTIMATE Typescript Starter Repo for Advent of Code 2023',
              type: 'image/png',
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
            <article className="mx-auto py-4 px-4 sm:px-6 lg:items-center lg:py-4 lg:px-8">
              <header className="md:py-8">
                <div>
                  <SectionHeading as="h1" variant="display" id="blog-title">
                    ts-aoc-starter
                  </SectionHeading>
                </div>
              </header>
            </article>
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
            <div className="mx-auto py-4 px-4 sm:px-6 lg:items-center lg:py-4 lg:px-8">
              <SectionHeading as="h2" variant="display" id="getting-started">
                Getting Started
              </SectionHeading>
              <div className="mx-auto px-4 sm:px-6 lg:items-center lg:px-8 my-4 mt-8">
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
              <p className="mb-16 max-w-2xl text-2xl dark:text-slate-100 sm:mb-11">
                This will create a new workspace in the current directory with
                the following structure:
              </p>
              <div className="border-zinc-300 border-2 border-solid bg-slate-800 p-4 rounded-lg">
                <pre className="text-xl">ts-aoc-starter</pre>
                <pre className="text-xl">├── puzzles</pre>
                <pre className="text-xl">│ ├── day-1</pre>
                <pre className="text-xl">│ │ ├── day-1-a.data.txt</pre>
                <pre className="text-xl">│ │ ├── day-1-a.sample-data.txt</pre>
                <pre className="text-xl">│ │ ├── day-1-a.ts</pre>
                <pre className="text-xl">│ │ ├── day-1-b.data.txt</pre>
                <pre className="text-xl">│ │ ├── day-1-b.sample-data.txt</pre>
                <pre className="text-xl">│ │ └── day-1-b.ts</pre>
                <pre className="text-xl">│ ├── day-2</pre>
                <pre className="text-xl">│ ├── day-3</pre>
                <pre className="text-xl">...</pre>
              </div>
              <SectionHeading
                as="h2"
                variant="display"
                id="getting-started"
                className="my-4 mt-8"
              >
                Running the Puzzles
              </SectionHeading>
              <p className="mb-16 max-w-2xl py-3 text-2xl dark:text-slate-100 sm:mb-11">
                Copy and paste the sample data given in the problem into the
                `day-X-a.sample-data.txt` file.
              </p>
              <p className="mb-16 max-w-2xl py-3 text-2xl dark:text-slate-100 sm:mb-11">
                Copy and paste your larger unique actual data set into the
                `day-X-a.data.txt` file.
              </p>
              <p className="mb-16 max-w-2xl py-3 text-2xl dark:text-slate-100 sm:mb-11">
                Add your solution to the `day-X-a.ts` file.
              </p>
              <p className="mb-16 max-w-2xl py-3 text-2xl dark:text-slate-100 sm:mb-11">
                To run your solution against your sample data set, run the
                following command:
              </p>
              <CopyToClipboard
                text="nx day-1-a --data=sample"
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
                  nx day-1-a --data=sample
                </button>
              </CopyToClipboard>
              <p className="mb-16 max-w-2xl py-3 text-2xl dark:text-slate-100 sm:mb-11">
                or
              </p>
              <CopyToClipboard
                text="pnpm run day-1-a:sample"
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
                  pnpm run day-1-a:sample
                </button>
              </CopyToClipboard>
              <p className="mb-16 max-w-2xl py-3 text-2xl dark:text-slate-100 sm:mb-11">
                To run your solution against your actual data set, run the
                following command:
              </p>
              <CopyToClipboard
                text="nx day-1-a"
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
                  nx day-1-a
                </button>
              </CopyToClipboard>
              <p className="mb-16 max-w-2xl py-3 text-2xl dark:text-slate-100 sm:mb-11">
                or
              </p>
              <CopyToClipboard
                text="pnpm run day-1-a"
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
                  pnpm run day-1-a
                </button>
              </CopyToClipboard>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
