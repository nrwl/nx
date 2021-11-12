import React from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import Link from 'next/link';
import { Footer, Header, NxUsersShowcase } from '@nrwl/nx-dev/ui/common';
import { sendCustomEvent } from '@nrwl/nx-dev/feature-analytics';
import { useStorage } from '@nrwl/nx-dev/feature-storage';
import Head from 'next/head';
import { InlineCommand } from '@nrwl/nx-dev/ui-commands';

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
        'libs and apps by using the "npm" preset with "create-nx-workspace".\n\n',
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

  const { value: selectedFlavor } = useStorage('flavor');
  const { value: storedVersion } = useStorage('version');

  return (
    <>
      <Head>
        <title>Nx and Node</title>
        <meta
          name="description"
          content="Nx is a smart and extensible build framework to help you develop, test, build, and scale Node applications."
        />
        <meta name="twitter:title" content="Nx and Node" />
        <meta
          name="twitter:description"
          content="Nx is a smart and extensible build framework to help you develop, test, build, and scale Node applications."
        />
        <meta
          name="twitter:image"
          content="https://nx.dev/images/nx-media.jpg"
        />
        <meta
          name="twitter:image:alt"
          content="Nx: Smart, Extensible Build Framework"
        />
        <meta property="og:url" content="https://nx.dev/node" />
        <meta
          property="og:description"
          content="Nx is a smart and extensible build framework to help you develop, test, build, and scale Node applications."
        />
        <meta property="og:title" content="Nx and Node" />
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
          name: selectedFlavor || 'Node',
          value: selectedFlavor || 'n',
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
                    className="fill-current hidden md:block text-blue-nx-dark absolute -top-40 -left-72"
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
                      alt="Nx and node"
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
                    className="fill-current hidden md:block text-blue-nx-dark absolute -top-20 -right-32"
                  >
                    <circle cx="200" cy="200" r="200" />
                  </svg>
                  <div className="hidden sm:block pt-4">
                    <Image
                      src="/images/cubes-right-1.png"
                      width={488}
                      height={300}
                      alt="Nx and node"
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
                      alt="Nx and node"
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
                    <Link href="/l/r/getting-started/intro">
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
                  <Link href="/l/r/tutorial/01-create-application">
                    <a className="inline-flex items-center font-bold group">
                      <span className="group-hover:underline">
                        Nx Node App Tutorial
                      </span>
                      <svg
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
                  <Link href="/l/r/migration/adding-to-monorepo">
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
                <div className="grid grid-cols-4 gap-16">
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
                    id="nest-logo"
                    className="w-full opacity-25"
                    role="img"
                    viewBox="0 0 24 24"
                  >
                    <path d="M14.131.047c-.173 0-.334.037-.483.087.316.21.49.49.576.806.007.043.019.074.025.117a.681.681 0 0 1 .013.112c.024.545-.143.614-.26.936-.18.415-.13.861.086 1.22a.74.74 0 0 0 .074.137c-.235-1.568 1.073-1.803 1.314-2.293.019-.428-.334-.713-.613-.911a1.37 1.37 0 0 0-.732-.21zM16.102.4c-.024.143-.006.106-.012.18-.006.05-.006.112-.012.161-.013.05-.025.1-.044.149-.012.05-.03.1-.05.149l-.067.142c-.02.025-.031.05-.05.075l-.037.055a2.152 2.152 0 0 1-.093.124c-.037.038-.068.081-.112.112v.006c-.037.031-.074.068-.118.1-.13.099-.278.173-.415.266-.043.03-.087.056-.124.093a.906.906 0 0 0-.118.099c-.043.037-.074.074-.111.118-.031.037-.068.08-.093.124a1.582 1.582 0 0 0-.087.13c-.025.05-.043.093-.068.142-.019.05-.037.093-.05.143a2.007 2.007 0 0 0-.043.155c-.006.025-.006.056-.012.08-.007.025-.007.05-.013.075 0 .05-.006.105-.006.155 0 .037 0 .074.006.111 0 .05.006.1.019.155.006.05.018.1.03.15.02.049.032.098.05.148.013.03.031.062.044.087l-1.426-.552c-.241-.068-.477-.13-.719-.186l-.39-.093c-.372-.074-.75-.13-1.128-.167-.013 0-.019-.006-.031-.006A11.082 11.082 0 0 0 8.9 2.855c-.378.025-.756.074-1.134.136a12.45 12.45 0 0 0-.837.174l-.279.074c-.092.037-.18.08-.266.118l-.205.093c-.012.006-.024.006-.03.012-.063.031-.118.056-.174.087a2.738 2.738 0 0 0-.236.118c-.043.018-.086.043-.124.062a.559.559 0 0 1-.055.03c-.056.032-.112.063-.162.094a1.56 1.56 0 0 0-.148.093c-.044.03-.087.055-.124.086-.006.007-.013.007-.019.013-.037.025-.08.056-.118.087l-.012.012-.093.074c-.012.007-.025.019-.037.025-.031.025-.062.056-.093.08-.006.013-.019.02-.025.025-.037.038-.074.069-.111.106-.007 0-.007.006-.013.012a1.742 1.742 0 0 0-.111.106c-.007.006-.007.012-.013.012a1.454 1.454 0 0 0-.093.1c-.012.012-.03.024-.043.036a1.374 1.374 0 0 1-.106.112c-.006.012-.018.019-.024.03-.05.05-.093.1-.143.15l-.018.018c-.1.106-.205.211-.317.304-.111.1-.229.192-.347.273a3.777 3.777 0 0 1-.762.421c-.13.056-.267.106-.403.149-.26.056-.527.161-.756.18-.05 0-.105.012-.155.018l-.155.037-.149.056c-.05.019-.099.044-.148.068-.044.031-.093.056-.137.087a1.011 1.011 0 0 0-.124.106c-.043.03-.087.074-.124.111-.037.043-.074.08-.105.124-.031.05-.068.093-.093.143a1.092 1.092 0 0 0-.087.142c-.025.056-.05.106-.068.161-.019.05-.037.106-.056.161-.012.05-.025.1-.03.15 0 .005-.007.012-.007.018-.012.056-.012.13-.019.167C.006 7.95 0 7.986 0 8.03a.657.657 0 0 0 .074.31v.006c.019.037.044.075.069.112.024.037.05.074.08.111.031.031.068.069.106.1a.906.906 0 0 0 .117.099c.149.13.186.173.378.272.031.019.062.031.1.05.006 0 .012.006.018.006 0 .013 0 .019.006.031a1.272 1.272 0 0 0 .08.298c.02.037.032.074.05.111.007.013.013.025.02.031.024.05.049.093.073.137l.093.13c.031.037.069.08.106.118.037.037.074.068.118.105 0 0 .006.006.012.006.037.031.074.062.112.087a.986.986 0 0 0 .136.08c.043.025.093.05.142.069a.73.73 0 0 0 .124.043c.007.006.013.006.025.012.025.007.056.013.08.019-.018.335-.024.65.026.762.055.124.328-.254.6-.688-.036.428-.061.93 0 1.079.069.155.44-.329.763-.862 4.395-1.016 8.405 2.02 8.826 6.31-.08-.67-.905-1.041-1.283-.948-.186.458-.502 1.047-1.01 1.413.043-.41.025-.83-.062-1.24a4.009 4.009 0 0 1-.769 1.562c-.588.043-1.177-.242-1.487-.67-.025-.018-.031-.055-.05-.08-.018-.043-.037-.087-.05-.13a.515.515 0 0 1-.037-.13c-.006-.044-.006-.087-.006-.137v-.093a.992.992 0 0 1 .031-.13c.013-.043.025-.086.044-.13.024-.043.043-.087.074-.13.105-.298.105-.54-.087-.682a.706.706 0 0 0-.118-.062c-.024-.006-.055-.018-.08-.025l-.05-.018a.847.847 0 0 0-.13-.031.472.472 0 0 0-.13-.019 1.01 1.01 0 0 0-.136-.012c-.031 0-.062.006-.093.006a.484.484 0 0 0-.137.019c-.043.006-.086.012-.13.024a1.068 1.068 0 0 0-.13.044c-.043.018-.08.037-.124.056-.037.018-.074.043-.118.062-1.444.942-.582 3.148.403 3.787-.372.068-.75.148-.855.229l-.013.012c.267.161.546.298.837.416.397.13.818.247 1.004.297v.006a5.996 5.996 0 0 0 1.562.112c2.746-.192 4.996-2.281 5.405-5.033l.037.161c.019.112.043.23.056.347v.006c.012.056.018.112.025.162v.024c.006.056.012.112.012.162.006.068.012.136.012.204v.1c0 .03.007.067.007.098 0 .038-.007.075-.007.112v.087c0 .043-.006.08-.006.124 0 .025 0 .05-.006.08 0 .044-.006.087-.006.137-.006.018-.006.037-.006.055l-.02.143c0 .019 0 .037-.005.056-.007.062-.019.118-.025.18v.012l-.037.174v.018l-.037.167c0 .007-.007.02-.007.025a1.663 1.663 0 0 1-.043.168v.018c-.019.062-.037.118-.05.174-.006.006-.006.012-.006.012l-.056.186c-.024.062-.043.118-.068.18-.025.062-.043.124-.068.18-.025.062-.05.117-.074.18h-.007c-.024.055-.05.117-.08.173a.302.302 0 0 1-.019.043c-.006.006-.006.013-.012.019a5.867 5.867 0 0 1-1.742 2.082c-.05.031-.099.069-.149.106-.012.012-.03.018-.043.03a2.603 2.603 0 0 1-.136.094l.018.037h.007l.26-.037h.006c.161-.025.322-.056.483-.087.044-.006.093-.019.137-.031l.087-.019c.043-.006.086-.018.13-.024.037-.013.074-.02.111-.031.62-.15 1.221-.354 1.798-.595a9.926 9.926 0 0 1-3.85 3.142c.714-.05 1.426-.167 2.114-.366a9.903 9.903 0 0 0 5.857-4.68 9.893 9.893 0 0 1-1.667 3.986 9.758 9.758 0 0 0 1.655-1.376 9.824 9.824 0 0 0 2.61-5.268c.21.98.272 1.99.18 2.987 4.474-6.241.371-12.712-1.346-14.416-.006-.013-.012-.019-.012-.031-.006.006-.006.006-.006.012 0-.006 0-.006-.007-.012 0 .074-.006.148-.012.223a8.34 8.34 0 0 1-.062.415c-.03.136-.068.273-.105.41-.044.13-.093.266-.15.396a5.322 5.322 0 0 1-.185.378 4.735 4.735 0 0 1-.477.688c-.093.111-.192.21-.292.31a3.994 3.994 0 0 1-.18.155l-.142.124a3.459 3.459 0 0 1-.347.241 4.295 4.295 0 0 1-.366.211c-.13.062-.26.118-.39.174a4.364 4.364 0 0 1-.818.223c-.143.025-.285.037-.422.05a4.914 4.914 0 0 1-.297.012 4.66 4.66 0 0 1-.422-.025 3.137 3.137 0 0 1-.421-.062 3.136 3.136 0 0 1-.415-.105h-.007c.137-.013.273-.025.41-.05a4.493 4.493 0 0 0 .818-.223c.136-.05.266-.112.39-.174.13-.062.248-.13.372-.204.118-.08.235-.161.347-.248.112-.087.217-.18.316-.279.105-.093.198-.198.291-.304.093-.111.18-.223.26-.334.013-.019.026-.044.038-.062.062-.1.124-.199.18-.298a4.272 4.272 0 0 0 .334-.775c.044-.13.075-.266.106-.403.025-.142.05-.278.062-.415.012-.142.025-.285.025-.421 0-.1-.007-.199-.013-.298a6.726 6.726 0 0 0-.05-.415 4.493 4.493 0 0 0-.092-.415c-.044-.13-.087-.267-.137-.397-.05-.13-.111-.26-.173-.384-.069-.124-.137-.248-.211-.366a6.843 6.843 0 0 0-.248-.34c-.093-.106-.186-.212-.285-.317a3.878 3.878 0 0 0-.161-.155c-.28-.217-.57-.421-.862-.607a1.154 1.154 0 0 0-.124-.062 2.415 2.415 0 0 0-.589-.26Z" />
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
                      rel="noreferrer"
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
                      rel="noreferrer"
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
                      rel="noreferrer"
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
                      Tune into regular Nx Show livestreams
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

export default Node;
