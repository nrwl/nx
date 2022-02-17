import {
  BookOpenIcon,
  DocumentAddIcon,
  ShareIcon,
} from '@heroicons/react/solid';
import Link from 'next/link';
import { ReactComponentElement } from 'react';

export function CreateNxPlugin(): ReactComponentElement<any> {
  return (
    <article
      id="create-nx-plugin"
      className="items-center p-4 lg:mx-auto lg:grid lg:max-w-7xl lg:grid-flow-col-dense lg:grid-cols-2 lg:gap-24 lg:px-8"
    >
      <header className="mx-auto max-w-xl lg:col-start-1 lg:mx-0 lg:max-w-none">
        <h1 className="mb-4 text-3xl font-extrabold tracking-tight text-gray-900">
          <span className="sr-only">Nx </span>Community Plugins
        </h1>
        <p className="mb-4 text-lg text-gray-500">
          Core Nx plugins are created and maintained by the Nx team at Nrwl and
          you can see all the available plugins when you run the{' '}
          <code className="break-normal rounded border border-gray-200 bg-gray-50 px-2 py-1 font-mono text-sm leading-6 text-gray-600">
            nx list
          </code>{' '}
          command in your workspace.
        </p>
        <p className="mb-4 text-lg text-gray-500">
          The community plugins are created and maintained by members of the Nx
          community, will allow you to use the full power of the workspace while
          using different technologies!
        </p>

        <ul className="mx-4 mb-4 list-disc">
          <li className="mb-2">
            <Link href="/nx-plugin/overview#generating-a-plugin">
              <a className="text-lg font-normal  text-gray-500 hover:underline">
                Create your Nx Plugin
              </a>
            </Link>
          </li>
          <li className="mb-2">
            <Link href="/nx-plugin/overview#testing-your-plugin">
              <a className="text-lg font-normal text-gray-500 hover:underline">
                Test your plugin
              </a>
            </Link>
          </li>
          <li className="mb-2">
            <Link href="/nx-plugin/overview#generating-a-plugin">
              <a className="text-lg font-normal text-gray-500 hover:underline">
                Publish your Nx Plugin
              </a>
            </Link>
          </li>
        </ul>
      </header>
      <div className="lg:col-start-2">
        <div className="relative flex flex-col items-center justify-center lg:h-full">
          <iframe
            loading="lazy"
            className="max-w-screen-sm"
            width="100%"
            height="315"
            src="https://www.youtube.com/embed/XYO689PAhow"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          />
          <div className="mt-6 grid w-full grid-cols-1 items-center gap-4 lg:grid-cols-2">
            <div className="focus-within:ring-blue-nx-base relative flex flex flex-col items-center items-center overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm transition focus-within:ring-2 focus-within:ring-offset-2 hover:bg-gray-50">
              <div className="flex w-full px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link href="/nx-plugin/overview#generating-a-plugin">
                    <a className="focus:outline-none">
                      <span className="absolute inset-0" aria-hidden="true" />
                      <p className="text-md mb-0.5 font-bold text-gray-600">
                        Create a new Nx Plugin
                      </p>
                      <p className="text-xs text-gray-500">
                        Follow this guide to generate an Nx plugin to fit your
                        needs
                      </p>
                    </a>
                  </Link>
                </div>
                <div className="flex-shrink-0">
                  <div className="rounded-full border border-gray-100 bg-white p-2 text-white">
                    <DocumentAddIcon className="text-blue-nx-base h-6 w-6" />
                  </div>
                </div>
              </div>
              <div className="mt-2 flex w-full items-center space-x-2 border-t border-gray-200 bg-gray-50 px-4 py-3 text-gray-400">
                <BookOpenIcon className="h-4 w-4" />
                <p className="text-xs font-bold">nx-plugin/overview</p>
              </div>
            </div>
            <div className="focus-within:ring-blue-nx-base relative flex flex flex-col items-center items-center overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm transition focus-within:ring-2 focus-within:ring-offset-2 hover:bg-gray-50">
              <div className="flex w-full px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link href="/nx-plugin/overview#publishing-your-nx-plugin">
                    <a className="focus:outline-none">
                      <span className="absolute inset-0" aria-hidden="true" />
                      <p className="text-md mb-0.5 font-bold text-gray-600">
                        Publish an Nx Plugin
                      </p>
                      <p className="text-xs text-gray-500">
                        Follow this guide to publish your new and shiny Nx
                        plugin
                      </p>
                    </a>
                  </Link>
                </div>
                <div className="flex-shrink-0">
                  <div className="rounded-full border border-gray-100 bg-white p-2 text-white">
                    <ShareIcon className="text-blue-nx-base h-6 w-6" />
                  </div>
                </div>
              </div>
              <div className="mt-2 flex w-full items-center space-x-2 border-t border-gray-200 bg-gray-50 px-4 py-3 text-gray-400">
                <BookOpenIcon className="h-4 w-4" />
                <p className="text-xs font-bold">nx-plugin/overview</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export default CreateNxPlugin;
