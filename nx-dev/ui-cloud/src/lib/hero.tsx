import { Dialog, Transition } from '@headlessui/react';
import { cx } from '@nx/nx-dev/ui-primitives';
import { PlayIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import { ComponentProps, Fragment, useState } from 'react';
import { ButtonLink } from '@nx/nx-dev/ui-common';
import { SectionHeading } from './elements/section-tags';
import { MovingBorder } from './elements/moving-border';
import Link from 'next/link';
import Image from 'next/image';

export function Hero(): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <SectionHeading as="h1" variant="display">
          Fast CI <br /> Built for Monorepos
        </SectionHeading>
        <SectionHeading
          as="p"
          variant="subtitle"
          className="mx-auto mt-6 max-w-xl"
        >
          Nx Cloud is the end-to-end solution for smart, efficient and
          maintainable CI.
        </SectionHeading>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <ButtonLink
            href="https://cloud.nx.app"
            title="Get started"
            variant="primary"
            size="default"
          >
            Get started
          </ButtonLink>
          <ButtonLink
            href="/ci/intro/ci-with-nx"
            title="Learn More"
            variant="secondary"
            size="default"
          >
            Learn More
          </ButtonLink>
          <a
            href="https://staging.nx.app/orgs/62d013d4d26f260059f7765e/workspaces/62d013ea0852fe0a2df74438/overview"
            target="_blank"
            rel="noreferrer"
            title="Live demo"
            className="group text-sm font-semibold leading-6 text-slate-950 dark:text-white"
          >
            Live demo{' '}
            <span
              aria-hidden="true"
              className="inline-block transition group-hover:translate-x-1"
            >
              →
            </span>
          </a>
        </div>
      </div>
      <div className="relative overflow-hidden pt-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="relative mb-6 mt-0 overflow-hidden rounded-xl bg-transparent p-[0.5px] text-xl shadow-lg">
            <div className="absolute inset-0">
              <MovingBorder duration={4500} rx="5%" ry="5%">
                <div className="h-20 w-20 bg-[radial-gradient(var(--blue-500)_40%,transparent_60%)] opacity-[0.8] dark:bg-[radial-gradient(var(--pink-500)_40%,transparent_60%)]" />
              </MovingBorder>
            </div>
            <picture className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-slate-50 antialiased backdrop-blur-xl dark:border-slate-900 dark:bg-slate-900/[0.8]">
              <Image
                src="/images/cloud/nrwl-ocean.avif"
                alt="App screenshot: overview"
                width={2550}
                height={1622}
                loading="eager"
              />
            </picture>
            <div className="absolute inset-0 z-10 grid h-full w-full items-center justify-center">
              <PlayButton onClick={() => setIsOpen(true)} />
            </div>
          </div>
        </div>
      </div>
      {/*MODAL*/}
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
                    height="468"
                    src="https://www.youtube.com/embed/4VI-q943J3o?si=3tR-EkCKLfLvHYzL"
                    title="YouTube video player"
                    frameBorder="0"
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

function PlayButton({
  className,
  ...props
}: ComponentProps<'div'>): JSX.Element {
  const parent = {
    initial: {
      width: 82,
      transition: {
        when: 'afterChildren',
      },
    },
    hover: {
      width: 296,
      transition: {
        duration: 0.125,
        type: 'tween',
        ease: 'easeOut',
      },
    },
  };
  const child = {
    initial: {
      opacity: 0,
      x: -6,
    },
    hover: {
      x: 0,
      opacity: 1,
      transition: {
        duration: 0.015,
        type: 'tween',
        ease: 'easeOut',
      },
    },
  };

  return (
    <div
      className={cx(
        'group relative overflow-hidden rounded-full bg-transparent p-[1px] shadow-md',
        className
      )}
      {...props}
    >
      <div className="absolute inset-0">
        <MovingBorder duration={5000} rx="5%" ry="5%">
          <div className="h-20 w-20 bg-[radial-gradient(var(--blue-500)_40%,transparent_60%)] opacity-[0.8] dark:bg-[radial-gradient(var(--pink-500)_40%,transparent_60%)]" />
        </MovingBorder>
      </div>
      <motion.div
        initial="initial"
        whileHover="hover"
        variants={parent}
        className="relative isolate flex h-20 w-20 cursor-pointer items-center justify-center gap-6 rounded-full border border-slate-100 bg-white/[0.6] p-6 text-sm text-slate-950 antialiased backdrop-blur-xl"
      >
        <PlayIcon
          aria-hidden="true"
          className="absolute left-6 top-6 h-8 w-8"
        />
        <motion.div variants={child} className="absolute left-20 top-4 w-48">
          <p className="text-base font-medium">See how Nx Cloud works</p>
          <p className="text-slate-700">In under 9 minutes</p>
        </motion.div>
      </motion.div>
    </div>
  );
}
