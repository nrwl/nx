import { BuildingStorefrontIcon } from '@heroicons/react/24/solid';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { transition, variants } from './motion.helpers';

export function GitHubIntegrationTab(): JSX.Element {
  return (
    <motion.div
      initial="hidden"
      variants={variants}
      animate="visible"
      transition={transition}
      exit="hidden"
      className="wrapper my-8 grid h-full gap-12 md:grid-cols-2 lg:grid-cols-3"
    >
      <div className="relative flex flex-col space-y-12 md:space-y-0">
        <div
          className="coding z-10 rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono
              text-xs leading-normal text-slate-800 subpixel-antialiased shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <div className="flex items-center">
            <p>
              <span className="text-base text-purple-600 dark:text-fuchsia-500">
                →
              </span>{' '}
              <span className="mx-1 text-green-600 dark:text-green-400">
                ~/workspace
              </span>{' '}
              <span>$</span>
            </p>
            <p className="typing mt-0.5 flex-1 pl-2">nx connect-to-nx-cloud</p>
          </div>
          <div className="mt-2 flex">
            <p className="typing flex-1 animate-pulse items-center space-x-0.5">
              <span className="inline-flex h-5 w-2 bg-slate-300 dark:bg-slate-700" />
              <span className="inline-flex h-5 w-2 bg-slate-300 dark:bg-slate-700" />
              <span className="inline-flex h-5 w-2 bg-slate-300 dark:bg-slate-700" />
              <span className="inline-flex h-5 w-2 bg-slate-300 dark:bg-slate-700" />
              <span className="inline-flex h-5 w-2 bg-slate-200 dark:bg-slate-700" />
              <span className="inline-flex h-5 w-2 bg-slate-200 dark:bg-slate-700" />
              <span className="inline-flex h-5 w-2 bg-slate-200 dark:bg-slate-700" />
              <span className="inline-flex h-5 w-2 bg-slate-200 dark:bg-slate-700" />
            </p>
          </div>
        </div>
        {/*HORIZONTAL LINK*/}
        <div className="absolute right-0 hidden w-48 translate-x-full translate-y-12 items-center md:flex">
          <span className="absolute top-0 left-0 -mt-1 -ml-1 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75 dark:bg-sky-500" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-slate-200 dark:bg-slate-700" />
          </span>
          <span className="absolute top-0 right-0 -mt-1 -mr-1 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75 dark:bg-sky-500" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-slate-200 dark:bg-slate-700" />
          </span>
          <div className="-m-0.5 h-0.5 w-full bg-slate-200 dark:bg-slate-700" />
        </div>
        {/*VERTICAL LINK*/}
        <div className="relative hidden grow flex-col justify-center md:flex">
          <span className="relative m-auto flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75 dark:bg-sky-500" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-slate-200 dark:bg-slate-700" />
          </span>
          <div className="m-auto h-32 w-0.5 bg-slate-200 dark:bg-slate-700" />
          <span className="relative m-auto flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75 dark:bg-sky-500" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-slate-200 dark:bg-slate-700" />
          </span>
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-2 text-slate-500 opacity-80">
            <div className="flex">
              <BuildingStorefrontIcon className="h-4 w-4" />
              <span className="ml-2 text-xs font-medium">
                GitHub Marketplace
              </span>
            </div>
            <svg
              className="h-10 w-10 translate-x-6 translate-y-2 rotate-12 text-slate-400"
              role="img"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
            >
              <title>GitHub</title>
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
            </svg>
          </div>
        </div>
        <div className="relative z-10 flex space-x-4 overflow-hidden rounded-lg rounded-t-none border border-slate-200 bg-white py-5 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
          <div className="absolute inset-x-0 top-0 h-1 w-full bg-blue-500 dark:bg-sky-500"></div>
          <div className="flex-shrink-0">
            <svg
              id="nx-cloud-header-logo"
              role="img"
              xmlns="http://www.w3.org/2000/svg"
              stroke="currentColor"
              fill="transparent"
              viewBox="0 0 24 24"
              className="h-10 w-10"
            >
              <path
                strokeWidth="2"
                d="M23 3.75V6.5c-3.036 0-5.5 2.464-5.5 5.5s-2.464 5.5-5.5 5.5-5.5 2.464-5.5 5.5H3.75C2.232 23 1 21.768 1 20.25V3.75C1 2.232 2.232 1 3.75 1h16.5C21.768 1 23 2.232 23 3.75Z"
                id="nx-cloud-header-logo-stroke-1"
              />
              <path
                strokeWidth="2"
                d="M23 6v14.1667C23 21.7307 21.7307 23 20.1667 23H6c0-3.128 2.53867-5.6667 5.6667-5.6667 3.128 0 5.6666-2.5386 5.6666-5.6666C17.3333 8.53867 19.872 6 23 6Z"
                id="nx-cloud-header-logo-stroke-2"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <a
              href="https://github.com/marketplace/official-nx-cloud-app"
              target="_blank"
              rel="noreferrer"
              className="focus:outline-none"
            >
              <span className="absolute inset-0" aria-hidden="true"></span>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-300">
                Official Nx Cloud App
              </p>
              <p className="text-sm text-slate-700 dark:text-slate-400">
                By nrwl
              </p>
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-400">
                The Nx Cloud GitHub App lets you access the result of every run
                — with all its logs and build insights — straight from your PR.
              </p>
            </a>
          </div>
        </div>
        {/*HORIZONTAL LINK*/}
        <div className="absolute bottom-80 right-0 hidden w-24 translate-x-full translate-y-12 items-center md:flex">
          <span className="absolute top-0 left-0 -mt-1 -ml-1 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75 dark:bg-sky-500" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-slate-200 dark:bg-slate-700" />
          </span>
          <span className="absolute top-0 right-0 -mt-1 -mr-1 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75 dark:bg-sky-500" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-slate-200 dark:bg-slate-700" />
          </span>
          <div className="-m-0.5 h-0.5 w-full bg-slate-200 dark:bg-slate-700" />
        </div>
        <div className="spacer h-56" />
      </div>
      <div
        aria-hidden="true"
        className="relative hidden px-4 pr-6 md:flex lg:col-span-2 lg:h-full lg:px-0"
      >
        <div className="absolute -top-28 left-36 mx-auto h-[510px] w-full w-auto max-w-none overflow-hidden rounded-xl border border-slate-200 shadow-xl dark:border-slate-700">
          <Image
            src="/images/nx-cloud.webp"
            alt="Nx Cloud app"
            loading="lazy"
            width={715}
            height={510}
          />
        </div>
        <div className="absolute left-12 -bottom-2 mx-auto flex w-full w-auto max-w-none overflow-hidden rounded-xl border border-slate-200 shadow-xl">
          <Image
            src="/images/github-nxcloud.webp"
            alt="Nx Cloud GitHub app"
            loading="lazy"
            width={715}
            height={510}
          />
        </div>
      </div>
    </motion.div>
  );
}
