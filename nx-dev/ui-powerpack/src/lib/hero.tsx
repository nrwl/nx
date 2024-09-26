'use client';
import { ButtonLink, SectionHeading, Strong } from '@nx/nx-dev/ui-common';
import { ReactElement, useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';

export function Hero(): ReactElement {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <SectionHeading as="h1" variant="display">
          Nx Powerpack
        </SectionHeading>
        <SectionHeading as="p" variant="subtitle" className="mt-6 text-center">
          A suite of paid extensions for the Nx CLI specifically designed for
          enterprises, <Strong>built and supported by the Nx core team</Strong>.
        </SectionHeading>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <ButtonLink
            href="https://cloud.nx.app/powerpack/purchase?utm_source=nx.dev&utm_medium=referral&utm_campaign=nx-powerpackurl"
            title="Talk to the engineering team"
            variant="primary"
            size="default"
          >
            Get Powerpack
          </ButtonLink>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setIsOpen(true);
            }}
            className="group text-sm font-semibold leading-6 text-slate-950 dark:text-white"
          >
            Watch the video{' '}
            <span
              aria-hidden="true"
              className="inline-block transition group-hover:translate-x-1"
            >
              →
            </span>
          </a>
        </div>
      </div>

      {/* Video Modal */}
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog
          as="div"
          open={isOpen}
          onClose={() => setIsOpen(false)}
          className="relative z-10"
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="relative w-auto transform overflow-hidden rounded-2xl border border-slate-600 text-left align-middle shadow-xl transition-all focus:outline-none dark:border-slate-800">
                  <iframe
                    width="812"
                    height="456"
                    src="https://www.youtube.com/embed/KZ0nh2lj8zE?si=D1hkyP3vy36e-VZt"
                    title="Introducing Nx Powerpack"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="max-w-full"
                  />
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}
