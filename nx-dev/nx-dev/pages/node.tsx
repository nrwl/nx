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
import Head from 'next/head';

export function Node() {
  const sectionItemList = [
    {
      title: 'Create Nx Plugins',
      content: [
        'Extend the power of Nx with your own custom built plugin that uses',
        '[@nrwl/devkit](https://www.npmjs.com/package/@nrwl/devkit) and',
        '[@nrwl/node](https://www.npmjs.com/package/@nrwl/node) or the',
        '[@nrwl/nx-plugin](https://www.npmjs.com/package/@nrwl/nx-plugin).',
      ].join(' '),
    },
    {
      title: 'Build APIs',
      content: [
        'Use the many API frameworks that are available for Node,',
        ' or use the ones provided by Nx for Express and Nest.',
      ].join(' '),
    },
    {
      title: 'Open Source Tool',
      content: [
        'Create a workspace that puts emphasis on packages rather than',
        'libs and apps by using the "oss" preset with "create-nx-workspace".\n\n',
        'Use TypeScript to build out projects that can scale infinitely.',
      ].join(' '),
    },
    {
      title: 'Nx Uses Computation Caching',
      content: [
        'Computation caching is a valuable way to improve performance.',
        'Computing (tests, arguments, operations, etc.) is expensive and',
        'time-consuming, but computation caching means you never have to rebuild',
        'the same code.\n\n',
        'WebPack, Jest, and TypeScript all perform computation caching.',
        'Nx builds on inspiration from Bazel and similar tools, and implements',
        'distributed computation caching in a way that works with any tool and',
        'requires no configuration. The result is much faster builds and ',
        'continuous integration.\n\n',
        'In addition, when connected to Nx Cloud, you can share the computation',
        'cache with everyone working on the same project.',
      ].join(' '),
    },
  ];
  const router = useRouter();

  const { value: storedFlavor } = useStorage('flavor');
  const { value: storedVersion } = useStorage('version');

  return (
    <>
      <Head>
        <title>Nx and Node</title>
        <meta
          name="description"
          content="Nx is a smart and extensible build framework to help you develop, test, build, and scale Node applications."
        />
      </Head>
      <Header
        showSearch={false}
        flavor={{
          name: storedFlavor || 'node',
          value: storedFlavor || 'node',
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
            <div
              className="max-w-screen-lg xl:max-w-screen-xl mx-auto px-5 py-5"
              style={{
                background:
                  'url(/images/cubes-top-1.png) no-repeat top center / contain',
              }}
            >
              <div className="mt-72 flex sm:flex-row flex-col">
                <div className="w-full sm:w-1/2 lg:w-2/5 flex flex-col items-start sm:pb-0 pb-10 mt-8 sm:mt-0 relative">
                  <svg
                    width="500"
                    height="500"
                    viewBox="0 0 400 400"
                    fill="currentColor"
                    xmlns="http://www.w3.org/2000/svg"
                    className="fill-current hidden md:block text-green-nx-base absolute -top-40 -left-72"
                  >
                    <circle cx="200" cy="200" r="200" />
                  </svg>
                  <h2 className="text-3xl sm:text-3xl lg:text-5xl leading-none font-extrabold tracking-tight mb-4 z-10">
                    Nx and Node
                  </h2>
                  <div className="hidden sm:block pt-4">
                    <Image
                      src="/images/cubes-left-1.png"
                      width={488}
                      height={300}
                    />
                  </div>
                </div>
                <div className="w-full sm:w-1/2 lg:w-3/5 flex flex-col items-start sm:pl-16 sm:pb-0 pb-10 mt-8 sm:mt-0">
                  <h3 className="text-xl sm:text-2xl lg:text-2xl leading-none font-extrabold tracking-tight mb-4">
                    The power and scalability of Node has helped pave the way
                    for increasingly complex and sophisticated applications.
                  </h3>
                  <p className="sm:text-lg mb-6">
                    Using Typescript in Node applications helps dev teams code
                    more consistently, avoid compatibility issues, and it can be
                    used to build libraries for NPM. Unfortunately, the setup is
                    often tedious and time consuming, and any mistakes in your
                    configuration can grind your work to a halt.
                  </p>
                </div>
              </div>
            </div>
            {/*What is Nx*/}
            <div className="max-w-screen-lg xl:max-w-screen-xl mx-auto px-5 py-5">
              <div className="my-32 flex sm:flex-row flex-col justify-center">
                <div className="w-full sm:w-1/2 flex flex-col justify-between items-start sm:pb-0 pb-10 mt-8 sm:mt-0">
                  <h3 className="text-xl sm:text-2xl lg:text-2xl leading-none font-extrabold tracking-tight mb-4">
                    Nx is a smart and extensible build framework that helps you
                    develop, test, build, and scale Node applications.
                  </h3>
                  <p className="sm:text-lg mb-6">
                    Nx is a set of tools that provides a standardized and
                    integrated development experience for all of your Node
                    workspaces. It takes care of things like Typescript
                    configuration and library sharing, so you can focus on
                    other, more interesting development tasks. In addition, Nx
                    provides...
                  </p>
                  <ul className="sm:text-lg list-disc list-inside">
                    <li>API creation using Express and Nest</li>
                    <li className="mt-4">Better linting</li>
                    <li className="mt-4">Better testing</li>
                    <li className="mt-4">
                      Support for popular community tools and frameworks
                    </li>
                    <li className="mt-4">
                      Nx’s own devkit for building plugins
                    </li>
                    <li className="mt-4">
                      And other Nx-specific features including dependency
                      graphs, code generation, and computation caching
                    </li>
                  </ul>
                </div>
                <div className="w-full sm:w-1/2 flex flex-col justify-between items-start sm:pl-16 sm:pb-0 pb-10 mt-8 sm:mt-0 relative">
                  <svg
                    width="400"
                    height="400"
                    viewBox="0 0 400 400"
                    fill="currentColor"
                    xmlns="http://www.w3.org/2000/svg"
                    className="fill-current hidden md:block text-green-nx-base absolute -top-20 -right-32"
                  >
                    <circle cx="200" cy="200" r="200" />
                  </svg>
                  <div className="hidden sm:block pt-4">
                    <Image
                      src="/images/cubes-right-1.png"
                      width={488}
                      height={300}
                    />
                  </div>
                  {/*<iframe*/}
                  {/*  width="560"*/}
                  {/*  height="315"*/}
                  {/*  src="https://www.youtube.com/embed/iIh5h_G52kI"*/}
                  {/*  title="YouTube video player"*/}
                  {/*  frameBorder="0"*/}
                  {/*  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"*/}
                  {/*  allowFullScreen*/}
                  {/*  className="w-full"*/}
                  {/*/>*/}
                </div>
              </div>
            </div>
          </div>
          {/*Call out*/}
          <div className="bg-blue-nx-base text-white">
            <div className="max-w-screen-lg xl:max-w-screen-xl mx-auto px-5 py-5">
              <div className="flex sm:flex-row flex-col justify-center py-16">
                <div className="sm:w-1/2 sm:flex flex-col justify-between items-start sm:pb-0 pb-10 mt-8 sm:mt-0 relative">
                  <div className="hidden sm:block absolute -top-40">
                    <Image
                      src="/images/cubes-left-2.png"
                      width={310}
                      height={240}
                    />
                  </div>
                </div>
                <div className="w-full sm:w-1/2 flex flex-col justify-between items-start sm:pb-0 pb-10 mt-8 sm:mt-0">
                  <p className="sm:text-lg mb-4 underline">
                    Get started right away by creating a modern Node workspace
                    with Nx, or learn more about the benefits Nx provides when
                    building Node applications.
                  </p>
                  <div className="inline-flex rounded-md shadow">
                    <Link href="/latest/node/getting-started/getting-started">
                      <a className="inline-flex items-center justify-center px-5 py-2 border border-transparent text-base font-medium rounded-md text-gray-700 bg-white">
                        Nx Node Doc
                      </a>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="max-w-screen-lg xl:max-w-screen-xl mx-auto px-5 py-5">
            {/*How to use Nx*/}
            <div className="mt-32 flex sm:flex-row flex-col justify-center">
              <div className="w-full sm:w-1/2 flex flex-col justify-between items-start sm:pb-0 pb-10 mt-8 sm:mt-0">
                <h3 className="text-2xl sm:text-2xl lg:text-3xl leading-none font-extrabold text-gray-900 tracking-tight mb-4">
                  Create a Node Workspace <br />
                  with Nx Nest or Express
                </h3>
              </div>
              <div className="w-full sm:w-1/2 flex flex-col justify-between items-start sm:pl-16 sm:pb-0 pb-10 mt-8 sm:mt-0">
                <p className="sm:text-lg mb-6">
                  Get started right away by creating a new Node workspace. If
                  you’re using Nest run the following command in your Terminal
                  or Command prompt:
                </p>

                <div className="w-full">
                  <InlineCommand
                    language={'bash'}
                    command={'npx create-nx-workspace --preset=nest'}
                    callback={() =>
                      sendCustomEvent('code-snippets', 'click', router.pathname)
                    }
                  />
                </div>

                <p className="sm:text-lg my-6">
                  For Express users, the command will be:
                </p>

                <div className="w-full">
                  <InlineCommand
                    language={'bash'}
                    command={'npx create-nx-workspace --preset=express'}
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
                  src="https://www.youtube.com/embed/UcBSBQYNlhE"
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full"
                />
              </div>
              <div className="w-full sm:w-1/2 flex flex-col justify-between items-start sm:pl-16 sm:pb-0 pb-10 mt-8 sm:mt-0">
                <p className="sm:text-lg mb-6">
                  Once you’ve created your Node workspace, follow the steps in
                  this tutorial to learn how to add testing, share code, view
                  dependency graphs, and much, much more.
                </p>
                <div className="inline-flex">
                  <Link href="/latest/node/tutorial/01-create-application">
                    <a className="inline-flex items-center font-bold group">
                      <span className="group-hover:underline">
                        Nx Node App Tutorial
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
                  If you want to add Nx to an existing Node project,{' '}
                  <Link href="/latest/node/migration/adding-to-monorepo">
                    <a className="underline pointer">check out this guide</a>
                  </Link>
                  .
                </p>
              </div>
            </div>
          </div>
          {/*VIDEO*/}
          <div className="bg-blue-nx-base text-white">
            <div className="max-w-screen-lg xl:max-w-screen-xl mx-auto px-5 py-5">
              <div className="py-32 w-full flex justify-center">
                <iframe
                  width="760"
                  height="440"
                  src="https://www.youtube.com/embed/iIh5h_G52kI"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-max-full mb-8"
                  style={{ boxShadow: '-48px 48px 0 0 hsla(162, 47%, 50%, 1)' }}
                />
              </div>
            </div>
          </div>
          <div className="max-w-screen-lg xl:max-w-screen-xl mx-auto px-5 py-5">
            {/*Nx technology*/}
            <div className="py-32 flex sm:flex-row flex-col items-center justify-center">
              <div className="w-full sm:w-2/5 flex flex-col justify-between items-center sm:pb-0 pb-10 mt-8 sm:mt-0">
                <div className="grid grid-cols-6 sm:grid-cols-2 md:grid-cols-3 gap-16 lg:gap-24">
                  <svg
                    id="jest-logo"
                    className="w-full opacity-25"
                    xmlns="http://www.w3.org/2000/svg"
                    role="img"
                    viewBox="0 0 24 24"
                  >
                    <path d="M22.251 11.82a3.117 3.117 0 0 0-2.328-3.01L22.911 0H8.104L11.1 8.838a3.116 3.116 0 0 0-2.244 2.988c0 1.043.52 1.967 1.313 2.536a8.279 8.279 0 0 1-1.084 1.244 8.14 8.14 0 0 1-2.55 1.647c-.834-.563-1.195-1.556-.869-2.446a3.11 3.11 0 0 0-.91-6.08 3.117 3.117 0 0 0-3.113 3.113c0 .848.347 1.626.903 2.182-.048.097-.097.195-.146.299-.465.959-.993 2.043-1.195 3.259-.403 2.432.257 4.384 1.849 5.489A5.093 5.093 0 0 0 5.999 24c1.827 0 3.682-.917 5.475-1.807 1.279-.632 2.599-1.292 3.898-1.612.48-.118.98-.187 1.508-.264 1.07-.153 2.175-.312 3.168-.89a4.482 4.482 0 0 0 2.182-3.091c.174-.994 0-1.994-.444-2.87.298-.48.465-1.042.465-1.647zm-1.355 0c0 .965-.785 1.75-1.75 1.75a1.753 1.753 0 0 1-1.085-3.126l.007-.007c.056-.042.118-.084.18-.125 0 0 .008 0 .008-.007.028-.014.055-.035.083-.05.007 0 .014-.006.021-.006.028-.014.063-.028.097-.042.035-.014.07-.027.098-.041.007 0 .013-.007.02-.007.028-.007.056-.021.084-.028.007 0 .02-.007.028-.007.034-.007.062-.014.097-.02h.007l.104-.022c.007 0 .02 0 .028-.007.028 0 .055-.007.083-.007h.035c.035 0 .07-.007.111-.007h.09c.028 0 .05 0 .077.007h.014c.055.007.111.014.167.028a1.766 1.766 0 0 1 1.396 1.723zM10.043 1.39h10.93l-2.509 7.4c-.104.02-.208.055-.312.09l-2.64-5.385-2.648 5.35c-.104-.034-.216-.055-.327-.076l-2.494-7.38zm4.968 9.825a3.083 3.083 0 0 0-.938-1.668l1.438-2.904 1.452 2.967c-.43.43-.743.98-.868 1.605H15.01zm-3.481-1.098c.034-.007.062-.014.097-.02h.02c.029-.008.056-.008.084-.015h.028c.028 0 .049-.007.076-.007h.271c.028 0 .049.007.07.007.014 0 .02 0 .035.007.027.007.048.007.076.014.007 0 .014 0 .028.007l.097.02h.007c.028.008.056.015.083.029.007 0 .014.007.028.007.021.007.049.014.07.027.007 0 .014.007.02.007.028.014.056.021.084.035h.007a.374.374 0 0 1 .09.049h.007c.028.014.056.034.084.048.007 0 .007.007.013.007.028.014.05.035.077.049l.007.007c.083.062.16.132.236.201l.007.007a1.747 1.747 0 0 1 .48 1.209 1.752 1.752 0 0 1-3.502 0 1.742 1.742 0 0 1 1.32-1.695zm-6.838-.049c.966 0 1.751.786 1.751 1.751s-.785 1.751-1.75 1.751-1.752-.785-1.752-1.75.786-1.752 1.751-1.752zm16.163 6.025a3.07 3.07 0 0 1-1.508 2.133c-.758.438-1.689.577-2.669.716a17.29 17.29 0 0 0-1.64.291c-1.445.355-2.834 1.05-4.182 1.717-1.724.854-3.35 1.66-4.857 1.66a3.645 3.645 0 0 1-2.154-.688c-1.529-1.056-1.453-3.036-1.272-4.12.167-1.015.632-1.966 1.077-2.877.028-.055.049-.104.077-.16.152.056.312.098.479.126-.264 1.473.486 2.994 1.946 3.745l.264.139.284-.104c1.216-.431 2.342-1.133 3.336-2.071a9.334 9.334 0 0 0 1.445-1.716c.16.027.32.034.48.034a3.117 3.117 0 0 0 3.008-2.327h1.167a3.109 3.109 0 0 0 3.01 2.327c.576 0 1.11-.16 1.57-.43.18.52.236 1.063.139 1.605z" />
                  </svg>
                  <svg
                    id="express-logo"
                    className="w-full opacity-25"
                    role="img"
                    viewBox="0 0 24 24"
                  >
                    <path d="M24 18.588a1.529 1.529 0 01-1.895-.72l-3.45-4.771-.5-.667-4.003 5.444a1.466 1.466 0 01-1.802.708l5.158-6.92-4.798-6.251a1.595 1.595 0 011.9.666l3.576 4.83 3.596-4.81a1.435 1.435 0 011.788-.668L21.708 7.9l-2.522 3.283a.666.666 0 000 .994l4.804 6.412zM.002 11.576l.42-2.075c1.154-4.103 5.858-5.81 9.094-3.27 1.895 1.489 2.368 3.597 2.275 5.973H1.116C.943 16.447 4.005 19.009 7.92 17.7a4.078 4.078 0 002.582-2.876c.207-.666.548-.78 1.174-.588a5.417 5.417 0 01-2.589 3.957 6.272 6.272 0 01-7.306-.933 6.575 6.575 0 01-1.64-3.858c0-.235-.08-.455-.134-.666A88.33 88.33 0 010 11.577zm1.127-.286h9.654c-.06-3.076-2.001-5.258-4.59-5.278-2.882-.04-4.944 2.094-5.071 5.264z" />
                  </svg>
                  <svg
                    id="eslint-logo"
                    className="w-full opacity-25"
                    role="img"
                    viewBox="0 0 24 24"
                  >
                    <path d="M7.257 9.132L11.816 6.5a.369.369 0 0 1 .368 0l4.559 2.632a.369.369 0 0 1 .184.32v5.263a.37.37 0 0 1-.184.319l-4.559 2.632a.369.369 0 0 1-.368 0l-4.559-2.632a.369.369 0 0 1-.184-.32V9.452a.37.37 0 0 1 .184-.32M23.852 11.53l-5.446-9.475c-.198-.343-.564-.596-.96-.596H6.555c-.396 0-.762.253-.96.596L.149 11.509a1.127 1.127 0 0 0 0 1.117l5.447 9.398c.197.342.563.517.959.517h10.893c.395 0 .76-.17.959-.512l5.446-9.413a1.069 1.069 0 0 0 0-1.086m-4.51 4.556a.4.4 0 0 1-.204.338L12.2 20.426a.395.395 0 0 1-.392 0l-6.943-4.002a.4.4 0 0 1-.205-.338V8.08c0-.14.083-.269.204-.338L11.8 3.74c.12-.07.272-.07.392 0l6.943 4.003a.4.4 0 0 1 .206.338z" />
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
                </div>
              </div>
              <div className="w-full sm:w-3/5 flex flex-col justify-between items-start sm:pl-16 sm:pb-0 pb-10 mt-8 sm:mt-0">
                <h3 className="text-2xl sm:text-2xl lg:text-3xl leading-none font-extrabold text-gray-900 tracking-tight mb-4">
                  Tools
                </h3>
                <p className="sm:text-lg mb-6">
                  Nx provides excellent tooling for Node in many ways,
                  including:
                </p>
                <ul className="sm:text-lg list-disc list-inside">
                  <li>
                    <a
                      className="underline pointer"
                      href="https://www.typescriptlang.org/"
                      target="_blank"
                    >
                      TypeScript
                    </a>{' '}
                    extends JavaScript by adding types and saves you time by
                    catching errors and providing fixes before you run code.
                  </li>
                  <li className="mt-4">
                    <a
                      className="underline pointer"
                      href="https://jestjs.io/"
                      target="_blank"
                    >
                      Jest
                    </a>{' '}
                    is a zero-config JavaScript testing framework that
                    prioritizes simplicity. With robust documentation and a
                    feature-full API, Jest is a great solution for JS developers
                    looking for a powerful, modern testing toolkit.
                  </li>
                  <li className="mt-4">
                    <a
                      className="underline pointer"
                      href="https://eslint.org/"
                      target="_blank"
                    >
                      ESLint
                    </a>{' '}
                    uses static analysis to identify problems in your code, many
                    of which are fixed automatically in a syntax-aware manner.
                    ESLint is highly configurable; customize your linting
                    preprocess code, use custom parsers, or write your own
                    rules.
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
          {/*Learn more*/}
          <div className="max-w-screen-lg xl:max-w-screen-xl mx-auto px-5 py-5">
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
      <Footer />
    </>
  );
}

export default Node;
