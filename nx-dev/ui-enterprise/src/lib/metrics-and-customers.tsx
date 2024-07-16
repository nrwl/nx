import { motion, Variants } from 'framer-motion';
import { DownloadCaseStudy } from './download-case-study';
import {
  BillColoredIcon,
  CapitalOneIcon,
  CaterpillarIcon,
  CiscoIcon,
  FicoIcon,
  HiltonIcon,
  ManIcon,
  RoyalBankOfCanadaColoredIcon,
  SevenElevenColoredIcon,
  ShopifyIcon,
  StorybookIcon,
  VmwareIcon,
} from '@nx/nx-dev/ui-icons';

export function MetricsAndCustomers(): JSX.Element {
  const downloadElement: Variants = {
    hidden: {
      opacity: 0,
      translateY: 90,
    },
    visible: {
      opacity: 1,
      translateY: 0,
      transition: {
        duration: 1,
        ease: 'easeInOut',
        type: 'tween',
      },
    },
  };
  return (
    <div className="relative isolate pb-24 pt-16">
      <svg
        className="absolute inset-0 -z-10 h-full w-full rotate-180 transform stroke-slate-100 [mask-image:radial-gradient(100%_100%_at_top,white,transparent)] dark:stroke-slate-800/60 dark:[mask-image:radial-gradient(100%_100%_at_top,black,transparent)]"
        aria-hidden="true"
      >
        <defs>
          <pattern
            id="83dwp7e5a-9d52-45fc-17c6-718e5d7fe918"
            width={200}
            height={200}
            x="50%"
            y={-1}
            patternUnits="userSpaceOnUse"
          >
            <path d="M100 200V.5M.5 .5H200" fill="none" />
          </pattern>
        </defs>
        <svg
          x="50%"
          y={-1}
          className="overflow-visible fill-slate-50/15 dark:fill-slate-900/10"
        >
          <path
            d="M-100.5 0h201v201h-201Z M699.5 0h201v201h-201Z M499.5 400h201v201h-201Z M-300.5 600h201v201h-201Z"
            strokeWidth={0}
          />
        </svg>
        <rect
          width="100%"
          height="100%"
          strokeWidth={0}
          fill="url(#83dwp7e5a-9d52-45fc-17c6-718e5d7fe918)"
        />
      </svg>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <dl className="grid grid-cols-1 gap-4 text-center md:grid-cols-3">
          <div className="p-4 text-xl">
            <dt className="text-center text-xs uppercase">Speed</dt>
            <dd className="mt-2 ">
              <span className="text-3xl font-semibold text-slate-950 dark:text-slate-50">
                30-70% Faster
              </span>
            </dd>
          </div>
          <div className="p-4 text-xl">
            <dt className="text-center text-xs uppercase">Infra Cost</dt>
            <dd className="mt-2 ">
              <span className="text-3xl font-semibold text-slate-950 dark:text-slate-50">
                40-75% Cheaper
              </span>
            </dd>
          </div>
          <div className="p-4 text-xl">
            <dt className="text-center text-xs uppercase">Compute</dt>
            <dd className="mt-2 ">
              <span className="text-3xl font-semibold text-slate-950 dark:text-slate-50">
                30-60% Less
              </span>
            </dd>
          </div>
        </dl>
        <div className="mt-12 grid grid-cols-2 justify-between gap-2 md:mt-0 md:flex">
          <div className="col-span-1 hidden h-14 items-center justify-center lg:flex lg:h-28">
            <ManIcon aria-hidden="true" className="h-14 w-14 text-[#E40045]" />
          </div>
          <div className="col-span-1 flex h-14 items-center justify-center lg:h-28">
            <CapitalOneIcon
              aria-hidden="true"
              className="h-28 w-28 text-black dark:text-white"
            />
          </div>
          <div className="col-span-1 hidden h-14 items-center justify-center lg:flex lg:h-28">
            <ShopifyIcon
              aria-hidden="true"
              className="h-12 w-12 text-[#7AB55C]"
            />
          </div>
          <div className="col-span-1 flex h-14 items-center justify-center lg:h-28">
            <RoyalBankOfCanadaColoredIcon
              aria-hidden="true"
              className="h-14 w-14"
            />
          </div>
          <div className="col-span-1 flex h-14 items-center justify-center lg:h-28">
            <VmwareIcon
              aria-hidden="true"
              className="h-28 w-28 text-black dark:text-white"
            />
          </div>
          <div className="col-span-1 hidden h-14 items-center justify-center lg:flex lg:h-28">
            <StorybookIcon
              aria-hidden="true"
              className="h-12 w-12 text-[#FF4785]"
            />
          </div>
          <div className="col-span-1 flex h-14 items-center justify-center lg:h-28">
            <FicoIcon aria-hidden="true" className="h-28 w-28 text-[#0A6DE6]" />
          </div>
          <div className="col-span-1 hidden h-14 items-center justify-center lg:flex lg:h-28">
            <CaterpillarIcon
              aria-hidden="true"
              className="h-14 w-14 text-[#FFCD11]"
            />
          </div>
        </div>
        <div className="relative mt-12 flex">
          <div className="hidden w-1/4 items-center gap-20 lg:flex">
            <div className="col-span-1 hidden h-14 items-center justify-center lg:flex lg:h-28">
              <CiscoIcon
                aria-hidden="true"
                className="h-16 w-16 text-[#1BA0D7]"
              />
            </div>
            <div className="col-span-1 hidden h-14 items-center justify-center lg:flex lg:h-28">
              <BillColoredIcon aria-hidden="true" className="h-14 w-14" />
            </div>
          </div>
          <div className="grow lg:w-1/2">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={downloadElement}
              whileInView="visible"
              className="mx-auto max-w-xl"
            >
              <DownloadCaseStudy />
            </motion.div>
          </div>
          <div className="hidden w-1/4 items-center justify-end gap-20 lg:flex">
            <div className="col-span-1 hidden h-14 items-center justify-center lg:flex lg:h-28">
              <SevenElevenColoredIcon
                aria-hidden="true"
                className="h-14 w-14"
              />
            </div>
            <div className="col-span-1 hidden h-14 items-center justify-center lg:flex lg:h-28">
              <HiltonIcon
                aria-hidden="true"
                className="h-20 w-20 text-black dark:text-white"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
