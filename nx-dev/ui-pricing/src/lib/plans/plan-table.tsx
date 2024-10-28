'use client';
import { Popover, Transition } from '@headlessui/react';

import {
  CheckIcon,
  InformationCircleIcon,
  QuestionMarkCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { ButtonLink } from '@nx/nx-dev/ui-common';
import { Fragment } from 'react';

export function PlanTable(): JSX.Element {
  return (
    <div className="relative overflow-auto">
      <table
        cellPadding="2"
        cellSpacing="0"
        className="relative w-full border-separate"
      >
        <thead>
          <tr className="text-sm">
            <th scope="col" className="sr-only">
              Available plans
            </th>
            <th
              scope="col"
              className="w-[18.75%] min-w-[144px] space-y-3 rounded-tl-lg border-l border-t border-slate-200 p-2 pb-1.5 text-left align-top md:min-w-[200px] md:p-3 md:pb-2 lg:p-4 lg:pb-3 dark:border-slate-800"
            >
              <div className="flex flex-col">
                <span className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  Hobby
                </span>
                <span className="text-secondary text-sm font-normal">
                  Get started quickly, upgrade when ready.
                </span>
              </div>
              <div>
                <span className="text-green text-2xl font-semibold">$0</span>
                <span
                  className="pl-sm text-secondary text-base font-normal"
                  aria-hidden="true"
                >
                  / month
                </span>
              </div>
            </th>
            <th
              scope="col"
              className="w-[18.75%] min-w-[180px] space-y-3 border-l border-t border-slate-200 p-2 pb-1.5 text-left align-top md:min-w-[200px] md:p-3 md:pb-2 lg:p-4 lg:pb-3 dark:border-slate-800"
            >
              <div className="flex flex-col">
                <span className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  Pro
                </span>
                <span className="text-secondary text-sm font-normal">
                  Scales with your needs. <br /> &nbsp;
                </span>
              </div>
              <div>
                <span className="text-red text-2xl font-semibold">$249</span>
                <span
                  className="pl-sm text-secondary text-base font-normal"
                  aria-hidden="true"
                >
                  / month
                </span>
              </div>
            </th>
            <th
              scope="col"
              className="w-[18.75%] min-w-[180px] space-y-3 rounded-tr-lg border-l border-r border-t border-slate-200 bg-slate-50/60 p-2 pb-1.5 text-left align-top font-semibold md:min-w-[200px] md:p-3 md:pb-2 lg:p-4 lg:pb-3 dark:border-slate-800 dark:bg-slate-800/60"
            >
              <div className="flex flex-col">
                <span className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  Enterprise
                </span>
                <span className="text-secondary text-sm font-normal">
                  The ultimate Nx toolchain, tailored to your needs of speed.
                </span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr className="text-sm">
            <th scope="row"></th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              <ButtonLink
                href="https://cloud.nx.app"
                aria-describedby="hobby-plan"
                title="Hobby"
                size="small"
                className="my-2 w-full"
              >
                Get started now
              </ButtonLink>
            </td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              <ButtonLink
                href="https://cloud.nx.app"
                aria-describedby="pro-plan"
                title="Pro plan"
                size="small"
                variant="secondary"
                className="my-2 w-full"
              >
                Get started
              </ButtonLink>
            </td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              <ButtonLink
                href="/enterprise"
                aria-describedby="enterprise-plan"
                title="Enterprise"
                size="small"
                variant="secondary"
                className="my-2 w-full"
              >
                Learn more
              </ButtonLink>
            </td>
          </tr>
          <tr className="text-sm">
            <th
              className="min-w-[124px] rounded-tl-lg border-l border-t border-slate-200 px-2 py-1.5 text-left text-lg font-medium leading-tight text-slate-900 md:min-w-[180px] md:p-2 md:px-3 lg:w-[25%] lg:px-4 lg:pl-8 lg:pt-12 dark:border-slate-800 dark:text-slate-100"
              scope="row"
            >
              Usages
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800"></td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800"></td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60"></td>
          </tr>
          <tr className="text-sm transition hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left font-normal leading-tight md:min-w-[180px] md:p-2 md:px-3 lg:w-[325px] lg:px-4 lg:py-2.5 lg:pl-8 dark:border-slate-800"
              scope="row"
            >
              Credits included
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              50k credits per month
            </td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              300k credits per month
            </td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              Custom
            </td>
          </tr>
          <tr className="bg-slate-50/40 text-sm transition hover:bg-slate-50/60 dark:bg-slate-800/40 dark:hover:bg-slate-800/60">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 bg-green-50 px-2 py-1.5 text-left font-normal leading-tight text-green-700 md:min-w-[180px] md:p-2 md:px-3 lg:w-[325px] lg:px-4 lg:py-2.5 lg:pl-8 dark:border-slate-800 dark:bg-green-500/10 dark:text-green-400"
              scope="row"
            >
              <span className="font-semibold">Exclusive benefits</span>
            </th>
            <td className="border-l border-t border-slate-200 bg-green-50 px-2 py-1.5 text-green-700 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-green-500/10 dark:text-green-400">
              <XMarkIcon className="h-5 w-5 flex-none" aria-hidden="true" />
              <span className="sr-only">no</span>
            </td>
            <td className="border-l border-t border-slate-200 bg-green-50 px-2 py-1.5 text-green-700 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-green-500/10 dark:text-green-400">
              <Popover className="relative">
                <Popover.Button as="p" className="cursor-pointer font-semibold">
                  <InformationCircleIcon className="float-right inline h-4 w-4 align-top" />
                  14-day free trial, no credit card required
                </Popover.Button>

                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-300"
                  enterFrom="opacity-0 translate-y-1"
                  enterTo="opacity-100 translate-y-0"
                  leave="transition ease-in duration-150"
                  leaveFrom="opacity-100 translate-y-0"
                  leaveTo="opacity-0 translate-y-1"
                >
                  <Popover.Panel className="absolute z-10 mt-2 w-96 overflow-hidden rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
                    <p>
                      Your organization will be deactivated upon reaching any
                      Pro plan limit unless a credit card is set up in your
                      account.
                    </p>
                  </Popover.Panel>
                </Transition>
              </Popover>
            </td>
            <td className="border-l border-r border-t border-slate-200 bg-green-50 px-2 py-1.5 text-green-700 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-green-500/10 dark:text-green-400">
              <p className="font-semibold">
                Volume discounts on credits available.
              </p>
            </td>
          </tr>
          <tr className="text-sm transition hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left font-normal leading-tight md:min-w-[180px] md:p-2 md:px-3 lg:w-[325px] lg:px-4 lg:py-2.5 lg:pl-8 dark:border-slate-800"
              scope="row"
            >
              Can buy extra credits
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              <XMarkIcon className="h-5 w-5 flex-none" aria-hidden="true" />
              <span className="sr-only">no</span>
            </td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              $5.50 per 10,000 credits
            </td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              $5.00 per 10,000 credits
            </td>
          </tr>
          <tr className="text-sm transition hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left font-normal leading-tight md:min-w-[180px] md:p-2 md:px-3 lg:w-[325px] lg:px-4 lg:py-2.5 lg:pl-8 dark:border-slate-800"
              scope="row"
            >
              <Popover className="relative">
                <Popover.Button as="p" className="cursor-pointer">
                  CI Pipeline Executions (CIPE)
                  <QuestionMarkCircleIcon className="ml-2 inline h-4 w-4 align-top" />
                </Popover.Button>

                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-300"
                  enterFrom="opacity-0 translate-y-1"
                  enterTo="opacity-100 translate-y-0"
                  leave="transition ease-in duration-150"
                  leaveFrom="opacity-100 translate-y-0"
                  leaveTo="opacity-0 translate-y-1"
                >
                  <Popover.Panel className="absolute z-10 mt-2 w-96 overflow-hidden rounded-md border border-slate-200 bg-white p-4 text-sm shadow dark:border-slate-800 dark:bg-slate-800">
                    <p className="mb-2">
                      By default, a CI pipeline execution is a 1:1 match to your
                      CI provider of choice's concept of a "workflow".
                    </p>
                  </Popover.Panel>
                </Transition>
              </Popover>
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              500 credits per CIPE
            </td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              500 credits per CIPE
            </td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              500 credits per CIPE
            </td>
          </tr>
          <tr className="text-sm transition hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left font-normal leading-tight md:min-w-[180px] md:p-2 md:px-3 lg:w-[325px] lg:px-4 lg:py-2.5 lg:pl-8 dark:border-slate-800"
              scope="row"
            >
              <Popover className="relative">
                <Popover.Button as="p" className="cursor-pointer">
                  Concurrent CI connections{' '}
                  <QuestionMarkCircleIcon className="ml-2 inline h-4 w-4 align-top" />
                </Popover.Button>

                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-300"
                  enterFrom="opacity-0 translate-y-1"
                  enterTo="opacity-100 translate-y-0"
                  leave="transition ease-in duration-150"
                  leaveFrom="opacity-100 translate-y-0"
                  leaveTo="opacity-0 translate-y-1"
                >
                  <Popover.Panel className="absolute z-10 mt-2 w-96 overflow-hidden rounded-md border border-slate-200 bg-white p-4 text-sm shadow dark:border-slate-800 dark:bg-slate-800">
                    <p>
                      The number of agents capable of doing work at the same
                      time.
                    </p>
                  </Popover.Panel>
                </Transition>
              </Popover>
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              Max 10
            </td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              Max 70
            </td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              Custom
            </td>
          </tr>
          <tr className="text-sm transition hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left font-normal leading-tight md:min-w-[180px] md:p-2 md:px-3 lg:w-[325px] lg:px-4 lg:py-2.5 lg:pl-8 dark:border-slate-800"
              scope="row"
            >
              <Popover className="relative">
                <Popover.Button as="p" className="cursor-pointer">
                  Contributors{' '}
                  <QuestionMarkCircleIcon className="ml-2 inline h-4 w-4 align-top" />
                </Popover.Button>

                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-300"
                  enterFrom="opacity-0 translate-y-1"
                  enterTo="opacity-100 translate-y-0"
                  leave="transition ease-in duration-150"
                  leaveFrom="opacity-100 translate-y-0"
                  leaveTo="opacity-0 translate-y-1"
                >
                  <Popover.Panel className="absolute z-10 mt-2 w-96 overflow-hidden rounded-md border border-slate-200 bg-white p-4 text-sm shadow dark:border-slate-800 dark:bg-slate-800">
                    <p>
                      A contributor is a person having access to the repository
                      and able to trigger a CI Pipeline Execution. Usually,
                      contributors are developers on the project.
                    </p>
                  </Popover.Panel>
                </Transition>
              </Popover>
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              Max 5 contributors
            </td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              Max 30 contributors
            </td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              Custom
            </td>
          </tr>
          <tr className="text-sm transition hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left font-normal leading-tight md:min-w-[180px] md:p-2 md:px-3 lg:w-[325px] lg:px-4 lg:py-2.5 lg:pl-8 dark:border-slate-800"
              scope="row"
            >
              <Popover className="relative">
                <Popover.Button as="p" className="cursor-pointer">
                  Nx Runs
                  <QuestionMarkCircleIcon className="ml-2 inline h-4 w-4 align-top" />
                </Popover.Button>

                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-300"
                  enterFrom="opacity-0 translate-y-1"
                  enterTo="opacity-100 translate-y-0"
                  leave="transition ease-in duration-150"
                  leaveFrom="opacity-100 translate-y-0"
                  leaveTo="opacity-0 translate-y-1"
                >
                  <Popover.Panel className="absolute z-10 mt-2 w-96 overflow-hidden rounded-md border border-slate-200 bg-white p-4 text-sm shadow dark:border-slate-800 dark:bg-slate-800">
                    <p className="mb-2">
                      Each time Nx is executes a batch of tasks it is considered
                      an Nx Run.
                    </p>
                  </Popover.Panel>
                </Transition>
              </Popover>
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              Max 50k
            </td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              Max 1m
            </td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              Unlimited
            </td>
          </tr>
          <tr className="text-sm transition hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left font-normal leading-tight md:min-w-[180px] md:p-2 md:px-3 lg:w-[325px] lg:px-4 lg:py-2.5 lg:pl-8 dark:border-slate-800"
              scope="row"
            >
              Workspace per organization
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              Unlimited
            </td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              Unlimited
            </td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              Custom
            </td>
          </tr>
          <tr className="text-sm transition hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left font-normal leading-tight md:min-w-[180px] md:p-2 md:px-3 lg:w-[325px] lg:px-4 lg:py-2.5 lg:pl-8 dark:border-slate-800"
              scope="row"
            >
              Workspace visibility
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              Private/Public
            </td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              Private/Public
            </td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              Private/Public
            </td>
          </tr>
          <tr className="text-sm transition hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left font-normal leading-tight md:min-w-[180px] md:p-2 md:px-3 lg:w-[325px] lg:px-4 lg:py-2.5 lg:pl-8 dark:border-slate-800"
              scope="row"
            >
              Connect to GitHub repository
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              Private/Public
            </td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              Private/Public
            </td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              Private/Public
            </td>
          </tr>
          <tr className="text-sm transition hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left font-normal leading-tight md:min-w-[180px] md:p-2 md:px-3 lg:w-[325px] lg:px-4 lg:py-2.5 lg:pl-8 dark:border-slate-800"
              scope="row"
            >
              App users
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              Unlimited
            </td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              Unlimited
            </td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              Unlimited
            </td>
          </tr>
          <tr className="text-sm transition hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left font-normal leading-tight md:min-w-[180px] md:p-2 md:px-3 lg:w-[325px] lg:px-4 lg:py-2.5 lg:pl-8 dark:border-slate-800"
              scope="row"
            >
              Admin accounts
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              Unlimited
            </td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              Unlimited
            </td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              Unlimited
            </td>
          </tr>
          <tr className="text-sm">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left text-lg font-medium leading-tight text-slate-900 md:min-w-[180px] md:p-2 md:px-3 lg:w-[25%] lg:px-4 lg:pl-8 lg:pt-12 dark:border-slate-800 dark:text-slate-100"
              scope="row"
            >
              Features
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800"></td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800"></td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60"></td>
          </tr>
          <tr className="bg-slate-50/40 text-sm transition hover:bg-slate-50/60 dark:bg-slate-800/40 dark:hover:bg-slate-800/60">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left font-normal leading-tight md:min-w-[180px] md:p-2 md:px-3 lg:w-[325px] lg:px-4 lg:py-2.5 lg:pl-8 dark:border-slate-800"
              scope="row"
            >
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Nx Agents
              </span>
              : native task distribution solution for CI
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              <CheckIcon
                className="h-6 w-5 flex-none text-blue-600 dark:text-sky-600"
                aria-hidden="true"
              />
              <span className="sr-only">yes</span>
            </td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              <CheckIcon
                className="h-6 w-5 flex-none text-blue-600 dark:text-sky-600"
                aria-hidden="true"
              />
              <span className="sr-only">yes</span>
            </td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              <CheckIcon
                className="h-6 w-5 flex-none text-blue-600 dark:text-sky-600"
                aria-hidden="true"
              />
              <span className="sr-only">yes</span>
            </td>
          </tr>
          <tr className="text-sm transition hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left font-normal leading-tight md:min-w-[180px] md:p-2 md:px-3 lg:w-[325px] lg:px-4 lg:py-2.5 lg:pl-8 dark:border-slate-800"
              scope="row"
            >
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Nx Replay
              </span>
              : remote caching
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              <CheckIcon
                className="h-6 w-5 flex-none text-blue-600 dark:text-sky-600"
                aria-hidden="true"
              />
              <span className="sr-only">yes</span>
            </td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              <CheckIcon
                className="h-6 w-5 flex-none text-blue-600 dark:text-sky-600"
                aria-hidden="true"
              />
              <span className="sr-only">yes</span>
            </td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              <CheckIcon
                className="h-6 w-5 flex-none text-blue-600 dark:text-sky-600"
                aria-hidden="true"
              />
              <span className="sr-only">yes</span>
            </td>
          </tr>
          <tr className="text-sm transition hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left font-normal leading-tight md:min-w-[180px] md:p-2 md:px-3 lg:w-[325px] lg:px-4 lg:py-2.5 lg:pl-8 dark:border-slate-800"
              scope="row"
            >
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Explain with AI
              </span>
              : provide detailed explanations and insights for failed task
              outputs
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              <XMarkIcon className="h-6 w-5 flex-none" aria-hidden="true" />
              <span className="sr-only">no</span>
            </td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              <CheckIcon
                className="h-6 w-5 flex-none text-blue-600 dark:text-sky-600"
                aria-hidden="true"
              />
              <span className="sr-only">yes</span>
            </td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              <CheckIcon
                className="h-6 w-5 flex-none text-blue-600 dark:text-sky-600"
                aria-hidden="true"
              />
              <span className="sr-only">yes</span>
            </td>
          </tr>
          <tr className="text-sm transition hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left font-normal leading-tight md:min-w-[180px] md:p-2 md:px-3 lg:w-[325px] lg:px-4 lg:py-2.5 lg:pl-8 dark:border-slate-800"
              scope="row"
            >
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Nx Powerpack
              </span>
              : a suite of premium extensions for the Nx CLI specifically
              designed for enterprises
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              Sold separately
            </td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              Sold separately
            </td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              Included
            </td>
          </tr>
          <tr className="text-sm transition hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left font-normal leading-tight md:min-w-[180px] md:p-2 md:px-3 lg:w-[325px] lg:px-4 lg:py-2.5 lg:pl-8 dark:border-slate-800"
              scope="row"
            >
              Distributed Task Execution
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              <CheckIcon
                className="h-6 w-5 flex-none text-blue-600 dark:text-sky-600"
                aria-hidden="true"
              />
              <span className="sr-only">yes</span>
            </td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              <CheckIcon
                className="h-6 w-5 flex-none text-blue-600 dark:text-sky-600"
                aria-hidden="true"
              />
              <span className="sr-only">yes</span>
            </td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              <CheckIcon
                className="h-6 w-5 flex-none text-blue-600 dark:text-sky-600"
                aria-hidden="true"
              />
              <span className="sr-only">yes</span>
            </td>
          </tr>
          <tr className="text-sm transition hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left font-normal leading-tight md:min-w-[180px] md:p-2 md:px-3 lg:w-[325px] lg:px-4 lg:py-2.5 lg:pl-8 dark:border-slate-800"
              scope="row"
            >
              <Popover className="relative">
                <Popover.Button as="p" className="cursor-pointer">
                  Nx Run detailed reports
                  <QuestionMarkCircleIcon className="ml-2 inline h-4 w-4 align-top" />
                </Popover.Button>

                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-300"
                  enterFrom="opacity-0 translate-y-1"
                  enterTo="opacity-100 translate-y-0"
                  leave="transition ease-in duration-150"
                  leaveFrom="opacity-100 translate-y-0"
                  leaveTo="opacity-0 translate-y-1"
                >
                  <Popover.Panel className="absolute z-10 mt-2 w-96 overflow-hidden rounded-md border border-slate-200 bg-white p-4 text-sm shadow dark:border-slate-800 dark:bg-slate-800">
                    <p className="mb-2">
                      Get a detailed report of each Nx Run with machine specs,
                      tasks statuses, logs statistics and share the result to
                      your team.
                    </p>
                  </Popover.Panel>
                </Transition>
              </Popover>
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              <CheckIcon
                className="h-6 w-5 flex-none text-blue-600 dark:text-sky-600"
                aria-hidden="true"
              />
              <span className="sr-only">yes</span>
            </td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              <CheckIcon
                className="h-6 w-5 flex-none text-blue-600 dark:text-sky-600"
                aria-hidden="true"
              />
              <span className="sr-only">yes</span>
            </td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              <CheckIcon
                className="h-6 w-5 flex-none text-blue-600 dark:text-sky-600"
                aria-hidden="true"
              />
              <span className="sr-only">yes</span>
            </td>
          </tr>
          <tr className="text-sm transition hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left font-normal leading-tight md:min-w-[180px] md:p-2 md:px-3 lg:w-[325px] lg:px-4 lg:py-2.5 lg:pl-8 dark:border-slate-800"
              scope="row"
            >
              Structured log visualization
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              <CheckIcon
                className="h-6 w-5 flex-none text-blue-600 dark:text-sky-600"
                aria-hidden="true"
              />
              <span className="sr-only">yes</span>
            </td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              <CheckIcon
                className="h-6 w-5 flex-none text-blue-600 dark:text-sky-600"
                aria-hidden="true"
              />
              <span className="sr-only">yes</span>
            </td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              <CheckIcon
                className="h-6 w-5 flex-none text-blue-600 dark:text-sky-600"
                aria-hidden="true"
              />
              <span className="sr-only">yes</span>
            </td>
          </tr>
          <tr className="text-sm transition hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left font-normal leading-tight md:min-w-[180px] md:p-2 md:px-3 lg:w-[325px] lg:px-4 lg:py-2.5 lg:pl-8 dark:border-slate-800"
              scope="row"
            >
              <Popover className="relative">
                <Popover.Button as="p" className="cursor-pointer">
                  GitHub PR with Nx Cloud live status
                  <QuestionMarkCircleIcon className="ml-2 inline h-4 w-4 align-top" />
                </Popover.Button>

                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-300"
                  enterFrom="opacity-0 translate-y-1"
                  enterTo="opacity-100 translate-y-0"
                  leave="transition ease-in duration-150"
                  leaveFrom="opacity-100 translate-y-0"
                  leaveTo="opacity-0 translate-y-1"
                >
                  <Popover.Panel className="absolute z-10 mt-2 w-96 overflow-hidden rounded-md border border-slate-200 bg-white p-4 text-sm shadow dark:border-slate-800 dark:bg-slate-800">
                    <p className="mb-2">
                      We provide a GitHub application allowing you to see what
                      tasks are being executed on the related CI pipeline from
                      your PR. See easily what failed and succeeded, with direct
                      link to full status report.
                    </p>
                  </Popover.Panel>
                </Transition>
              </Popover>
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              <CheckIcon
                className="h-6 w-5 flex-none text-blue-600 dark:text-sky-600"
                aria-hidden="true"
              />
              <span className="sr-only">yes</span>
            </td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              <CheckIcon
                className="h-6 w-5 flex-none text-blue-600 dark:text-sky-600"
                aria-hidden="true"
              />
              <span className="sr-only">yes</span>
            </td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              <CheckIcon
                className="h-6 w-5 flex-none text-blue-600 dark:text-sky-600"
                aria-hidden="true"
              />
              <span className="sr-only">yes</span>
            </td>
          </tr>
          <tr className="text-sm transition hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left font-normal leading-tight md:min-w-[180px] md:p-2 md:px-3 lg:w-[325px] lg:px-4 lg:py-2.5 lg:pl-8 dark:border-slate-800"
              scope="row"
            >
              Analytics
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              Basic (7 days)
            </td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              Advanced (30 days)
            </td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              Advanced (30 days)
            </td>
          </tr>
          <tr className="text-sm transition hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left font-normal leading-tight md:min-w-[180px] md:p-2 md:px-3 lg:w-[325px] lg:px-4 lg:py-2.5 lg:pl-8 dark:border-slate-800"
              scope="row"
            >
              <Popover className="relative">
                <Popover.Button as="p" className="cursor-pointer">
                  Allowed Email Domains{' '}
                  <QuestionMarkCircleIcon className="ml-2 inline h-4 w-4 align-top" />
                </Popover.Button>

                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-300"
                  enterFrom="opacity-0 translate-y-1"
                  enterTo="opacity-100 translate-y-0"
                  leave="transition ease-in duration-150"
                  leaveFrom="opacity-100 translate-y-0"
                  leaveTo="opacity-0 translate-y-1"
                >
                  <Popover.Panel className="absolute z-10 mt-2 w-96 overflow-hidden rounded-md border border-slate-200 bg-white p-4 text-sm shadow dark:border-slate-800 dark:bg-slate-800">
                    <p>
                      Give member access to anyone with an email belonging to a
                      specific domain.
                    </p>
                  </Popover.Panel>
                </Transition>
              </Popover>
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              <CheckIcon
                className="h-6 w-5 flex-none text-blue-600 dark:text-sky-600"
                aria-hidden="true"
              />
              <span className="sr-only">yes</span>
            </td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              <CheckIcon
                className="h-6 w-5 flex-none text-blue-600 dark:text-sky-600"
                aria-hidden="true"
              />
              <span className="sr-only">yes</span>
            </td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              <CheckIcon
                className="h-6 w-5 flex-none text-blue-600 dark:text-sky-600"
                aria-hidden="true"
              />
              <span className="sr-only">yes</span>
            </td>
          </tr>
          <tr className="text-sm transition hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left font-normal leading-tight md:min-w-[180px] md:p-2 md:px-3 lg:w-[325px] lg:px-4 lg:py-2.5 lg:pl-8 dark:border-slate-800"
              scope="row"
            >
              Server location
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              US
            </td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              US
            </td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              Custom
            </td>
          </tr>
          <tr className="text-sm transition hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left font-normal leading-tight md:min-w-[180px] md:p-2 md:px-3 lg:w-[325px] lg:px-4 lg:py-2.5 lg:pl-8 dark:border-slate-800"
              scope="row"
            >
              SSO/SAML Login
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              <XMarkIcon className="h-5 w-5 flex-none" aria-hidden="true" />
              <span className="sr-only">no</span>
            </td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              <XMarkIcon className="h-5 w-5 flex-none" aria-hidden="true" />
              <span className="sr-only">no</span>
            </td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              <CheckIcon
                className="h-6 w-5 flex-none text-blue-600 dark:text-sky-600"
                aria-hidden="true"
              />
              <span className="sr-only">yes</span>
            </td>
          </tr>
          <tr className="text-sm transition hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left font-normal leading-tight md:min-w-[180px] md:p-2 md:px-3 lg:w-[325px] lg:px-4 lg:py-2.5 lg:pl-8 dark:border-slate-800"
              scope="row"
            >
              Payment options
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              <XMarkIcon className="h-5 w-5 flex-none" aria-hidden="true" />
              <span className="sr-only">no</span>
            </td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              Credit card
            </td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              Credit card, Invoicing, Prepaid
            </td>
          </tr>
          <tr id="resource-classes" className="text-sm">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left text-lg font-medium leading-tight text-slate-900 md:min-w-[180px] md:p-2 md:px-3 lg:w-[25%] lg:px-4 lg:pl-8 lg:pt-12 dark:border-slate-800 dark:text-slate-100"
              scope="row"
            >
              Resource classes for Nx Agents
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800"></td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800"></td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60"></td>
          </tr>
          <tr className="text-sm transition hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left font-normal leading-tight md:min-w-[180px] md:p-2 md:px-3 lg:w-[325px] lg:px-4 lg:py-2.5 lg:pl-8 dark:border-slate-800"
              scope="row"
            >
              Extra credits
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              <XMarkIcon className="h-5 w-5 flex-none" aria-hidden="true" />
              <span className="sr-only">no</span>
            </td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              $5.50 per 10,000 credits
            </td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              $5.00 per 10,000 credits
            </td>
          </tr>
          <tr className="transition hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left text-sm font-normal leading-tight md:min-w-[180px] md:p-2 md:px-3 lg:w-[325px] lg:px-4 lg:py-2.5 lg:pl-8 dark:border-slate-800"
              scope="row"
            >
              Docker / Linux AMD64
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              <CheckIcon
                className="h-6 w-5 flex-none text-blue-600 dark:text-sky-600"
                aria-hidden="true"
              />
              <span className="sr-only">yes</span>
            </td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              <CheckIcon
                className="h-6 w-5 flex-none text-blue-600 dark:text-sky-600"
                aria-hidden="true"
              />
              <span className="sr-only">yes</span>
            </td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              <CheckIcon
                className="h-6 w-5 flex-none text-blue-600 dark:text-sky-600"
                aria-hidden="true"
              />
              <span className="sr-only">yes</span>
            </td>
          </tr>
          <tr className="text-sm transition hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left font-normal leading-tight md:min-w-[180px] md:p-2 md:px-3 lg:w-[325px] lg:px-4 lg:py-2.5 lg:pl-8 dark:border-slate-800"
              scope="row"
            >
              <p className="ml-4">Small</p>
              <p className="ml-4 mt-2 block text-xs">1 vCPU, 2GB RAM</p>
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              5 credits/min
            </td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              5 credits/min
            </td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              5 credits/min
            </td>
          </tr>
          <tr className="text-sm transition hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left font-normal leading-tight md:min-w-[180px] md:p-2 md:px-3 lg:w-[325px] lg:px-4 lg:py-2.5 lg:pl-8 dark:border-slate-800"
              scope="row"
            >
              <p className="ml-4">Medium</p>
              <p className="ml-4 mt-2 block text-xs">2 vCPU, 4GB RAM</p>
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              10 credits/min
            </td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              10 credits/min
            </td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              10 credits/min
            </td>
          </tr>
          <tr className="text-sm transition hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left font-normal leading-tight md:min-w-[180px] md:p-2 md:px-3 lg:w-[325px] lg:px-4 lg:py-2.5 lg:pl-8 dark:border-slate-800"
              scope="row"
            >
              <p className="ml-4">Medium Plus</p>
              <p className="ml-4 mt-2 block text-xs">3 vCPU, 6GB RAM</p>
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              15 credits/min
            </td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              15 credits/min
            </td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              15 credits/min
            </td>
          </tr>
          <tr className="text-sm transition hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left font-normal leading-tight md:min-w-[180px] md:p-2 md:px-3 lg:w-[325px] lg:px-4 lg:py-2.5 lg:pl-8 dark:border-slate-800"
              scope="row"
            >
              <p className="ml-4">Large</p>
              <p className="ml-4 mt-2 block text-xs">4 vCPU, 8GB RAM</p>
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              20 credits/min
            </td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              20 credits/min
            </td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              20 credits/min
            </td>
          </tr>
          <tr className="text-sm transition hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left font-normal leading-tight md:min-w-[180px] md:p-2 md:px-3 lg:w-[325px] lg:px-4 lg:py-2.5 lg:pl-8 dark:border-slate-800"
              scope="row"
            >
              <p className="ml-4">Large Plus</p>
              <p className="ml-4 mt-2 block text-xs">4 vCPU, 10GB RAM</p>
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              30 credits/min
            </td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              30 credits/min
            </td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              30 credits/min
            </td>
          </tr>
          <tr className="text-sm transition hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left font-normal leading-tight md:min-w-[180px] md:p-2 md:px-3 lg:w-[325px] lg:px-4 lg:py-2.5 lg:pl-8 dark:border-slate-800"
              scope="row"
            >
              <p className="ml-4">Extra Large</p>
              <p className="ml-4 mt-2 block text-xs">8 vCPU, 16GB RAM</p>
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              40 credits/min
            </td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              40 credits/min
            </td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              40 credits/min
            </td>
          </tr>
          <tr className="text-sm transition hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left font-normal leading-tight md:min-w-[180px] md:p-2 md:px-3 lg:w-[325px] lg:px-4 lg:py-2.5 lg:pl-8 dark:border-slate-800"
              scope="row"
            >
              <p className="ml-4">Extra Large Plus</p>
              <p className="ml-4 mt-2 block text-xs">10 vCPU, 20GB RAM</p>
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              60 credits/min
            </td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              60 credits/min
            </td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              60 credits/min
            </td>
          </tr>

          <tr className="transition hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left text-sm font-normal leading-tight md:min-w-[180px] md:p-2 md:px-3 lg:w-[325px] lg:px-4 lg:py-2.5 lg:pl-8 dark:border-slate-800"
              scope="row"
            >
              Docker / Linux ARM64
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              <CheckIcon
                className="h-6 w-5 flex-none text-blue-600 dark:text-sky-600"
                aria-hidden="true"
              />
              <span className="sr-only">yes</span>
            </td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              <CheckIcon
                className="h-6 w-5 flex-none text-blue-600 dark:text-sky-600"
                aria-hidden="true"
              />
              <span className="sr-only">yes</span>
            </td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              <CheckIcon
                className="h-6 w-5 flex-none text-blue-600 dark:text-sky-600"
                aria-hidden="true"
              />
              <span className="sr-only">yes</span>
            </td>
          </tr>
          <tr className="text-sm transition hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left font-normal leading-tight md:min-w-[180px] md:p-2 md:px-3 lg:w-[325px] lg:px-4 lg:py-2.5 lg:pl-8 dark:border-slate-800"
              scope="row"
            >
              <p className="ml-4">Medium</p>
              <p className="ml-4 mt-2 block text-xs">2 vCPU, 8GB RAM</p>
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              13 credits/min
            </td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              13 credits/min
            </td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              13 credits/min
            </td>
          </tr>

          <tr className="text-sm transition hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left font-normal leading-tight md:min-w-[180px] md:p-2 md:px-3 lg:w-[325px] lg:px-4 lg:py-2.5 lg:pl-8 dark:border-slate-800"
              scope="row"
            >
              <p className="ml-4">Large</p>
              <p className="ml-4 mt-2 block text-xs">4 vCPU, 16GB RAM</p>
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              26 credits/min
            </td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              26 credits/min
            </td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              26 credits/min
            </td>
          </tr>

          <tr className="text-sm transition hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left font-normal leading-tight md:min-w-[180px] md:p-2 md:px-3 lg:w-[325px] lg:px-4 lg:py-2.5 lg:pl-8 dark:border-slate-800"
              scope="row"
            >
              <p className="ml-4">Extra Large</p>
              <p className="ml-4 mt-2 block text-xs">8 vCPU, 32GB RAM</p>
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              52 credits/min
            </td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              52 credits/min
            </td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              52 credits/min
            </td>
          </tr>

          <tr className="transition hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left text-sm font-normal leading-tight md:min-w-[180px] md:p-2 md:px-3 lg:w-[325px] lg:px-4 lg:py-2.5 lg:pl-8 dark:border-slate-800"
              scope="row"
            >
              Docker / Windows
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              <CheckIcon
                className="h-6 w-5 flex-none text-blue-600 dark:text-sky-600"
                aria-hidden="true"
              />
              <span className="sr-only">yes</span>
            </td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              <CheckIcon
                className="h-6 w-5 flex-none text-blue-600 dark:text-sky-600"
                aria-hidden="true"
              />
              <span className="sr-only">yes</span>
            </td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              <CheckIcon
                className="h-6 w-5 flex-none text-blue-600 dark:text-sky-600"
                aria-hidden="true"
              />
              <span className="sr-only">yes</span>
            </td>
          </tr>
          <tr className="text-sm transition hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left font-normal leading-tight md:min-w-[180px] md:p-2 md:px-3 lg:w-[325px] lg:px-4 lg:py-2.5 lg:pl-8 dark:border-slate-800"
              scope="row"
            >
              <p className="ml-4">Medium</p>
              <p className="ml-4 mt-2 block text-xs">3 vCPU, 6GB RAM</p>
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              40 credits/min
            </td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              40 credits/min
            </td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              40 credits/min
            </td>
          </tr>

          <tr className="text-sm">
            <th
              className="min-w-[124px] border-l border-t border-slate-200 px-2 py-1.5 text-left text-lg font-medium leading-tight text-slate-900 md:min-w-[180px] md:p-2 md:px-3 lg:w-[25%] lg:px-4 lg:pl-8 lg:pt-12 dark:border-slate-800 dark:text-slate-100"
              scope="row"
            >
              Support
            </th>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800"></td>
            <td className="border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800"></td>
            <td className="border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60"></td>
          </tr>
          <tr className="text-sm transition hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
            <th
              className="min-w-[124px] rounded-bl-lg border-b border-l border-t border-slate-200 px-2 py-1.5 text-left font-normal leading-tight md:min-w-[180px] md:p-2 md:px-3 lg:w-[325px] lg:px-4 lg:py-2.5 lg:pl-8 dark:border-slate-800"
              scope="row"
            >
              Support type
            </th>
            <td className="border-b border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              Basic support
            </td>
            <td className="border-b border-l border-t border-slate-200 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800">
              High-priority support
            </td>
            <td className="rounded-br-lg border-b border-l border-r border-t border-slate-200 bg-slate-50/60 px-2 py-1.5 md:px-3 lg:px-4 lg:py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              Enterprise-grade support, SLA available
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
