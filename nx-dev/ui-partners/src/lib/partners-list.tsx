import { SectionDescription, SectionHeading } from '@nx/nx-dev/ui-common';
import {
  EpicWebIcon,
  LernaIcon,
  RedwoodJsIcon,
  StorybookIcon,
  TanstackIcon,
} from '@nx/nx-dev/ui-icons';

export function PartnersList(): JSX.Element {
  return (
    <section>
      <div className="col-span-2 border-y border-slate-200 bg-slate-50 py-24 sm:py-32 md:col-span-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl text-center">
          <div className="mx-auto max-w-3xl">
            <SectionHeading
              as="h2"
              variant="subtitle"
              className=" text-slate-950 sm:text-3xl dark:text-white"
            >
              Meet Our Partners
            </SectionHeading>
            <SectionDescription as="p" className="my-6 text-left">
              We’re proud to collaborate with a diverse group of companies and
              individuals from around the globe that have gone through our Nx
              Experts Certification. Whether you’re looking for professional
              support, educational content, or even implementation specialists,
              our partners have you covered.
            </SectionDescription>
          </div>

          <div className="mt-16">
            <dl className="grid grid-cols-2 justify-between gap-4 sm:grid-cols-4">
              <a
                rel="noreferrer"
                href="https://github.com/tanstack"
                target="_blank"
                className={
                  'flex flex-col items-center justify-center border p-12 shadow-md transition' +
                  ' border-slate-400/50 bg-white hover:border-slate-800/50 hover:bg-slate-200/50 hover:text-slate-950' +
                  ' dark:border-slate-400/20 dark:bg-slate-950 dark:hover:border-slate-100/20 dark:hover:bg-slate-950/50 dark:hover:text-white'
                }
              >
                <TanstackIcon aria-hidden="true" className="mb-4 h-14 w-14" />
                Zyphyr Cloud
              </a>
              <a
                rel="noreferrer"
                href="https://redwoodjs.com/"
                target="_blank"
                className={
                  'flex flex-col items-center justify-center border p-12 shadow-md transition' +
                  ' border-slate-400/50 bg-white hover:border-slate-800/50 hover:bg-slate-200/50 hover:text-slate-950' +
                  ' dark:border-slate-400/20 dark:bg-slate-950 dark:hover:border-slate-100/20 dark:hover:bg-slate-950/50 dark:hover:text-white'
                }
              >
                <RedwoodJsIcon aria-hidden="true" className="mb-4 h-12 w-12" />
                HeroDevs
              </a>
              <a
                href="https://github.com/epicweb-dev/epicshop"
                rel="noreferrer"
                target="_blank"
                className={
                  'flex flex-col items-center justify-center border p-12 shadow-md transition' +
                  ' border-slate-400/50 bg-white hover:border-slate-800/50 hover:bg-slate-200/50 hover:text-slate-950' +
                  ' dark:border-slate-400/20 dark:bg-slate-950 dark:hover:border-slate-100/20 dark:hover:bg-slate-950/50 dark:hover:text-white'
                }
              >
                <EpicWebIcon aria-hidden="true" className="mb-4 h-12 w-12" />
                Bitovi
              </a>
              <a
                rel="noreferrer"
                href="https://github.com/storybookjs/storybook"
                target="_blank"
                className={
                  'flex flex-col items-center justify-center border p-12 shadow-md transition' +
                  ' border-slate-400/50 bg-white hover:border-slate-800/50 hover:bg-slate-200/50 hover:text-slate-950' +
                  ' dark:border-slate-400/20 dark:bg-slate-950 dark:hover:border-slate-100/20 dark:hover:bg-slate-950/50 dark:hover:text-white'
                }
              >
                <StorybookIcon aria-hidden="true" className="mb-4 h-12 w-12" />
                Push Based
              </a>
              <a
                rel="noreferrer"
                href="https://lerna.js.org"
                target="_blank"
                className={
                  'flex flex-col items-center justify-center border p-12 shadow-md transition' +
                  ' border-slate-400/50 bg-white hover:border-slate-800/50 hover:bg-slate-200/50 hover:text-slate-950' +
                  ' dark:border-slate-400/20 dark:bg-slate-950 dark:hover:border-slate-100/20 dark:hover:bg-slate-950/50 dark:hover:text-white'
                }
              >
                <LernaIcon aria-hidden="true" className="mb-4 h-20 w-20" />
                Callstack
              </a>
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
