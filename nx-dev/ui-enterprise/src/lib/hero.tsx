import { SectionHeading } from './temp/typography';

export function Hero(): JSX.Element {
  return (
    <section>
      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <SectionHeading id="fast-ci-for-monorepo" as="h1" variant="display">
            Nx Enterprise
          </SectionHeading>
          <SectionHeading
            as="p"
            variant="subtitle"
            className="mx-auto mt-6 max-w-xl "
          >
            Accelerate your organization's journey to tighter collaboration, better developer experience, and speed…lots of speed.
          </SectionHeading>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <a
              title="Get started"
              className="group relative inline-flex opacity-100 transition focus:outline-none disabled:cursor-not-allowed disabled:opacity-80"
              href="/contact/sales"
            >
              <span className="flex h-full w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent bg-blue-500 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm transition group-hover:bg-blue-400 group-focus:ring-2 group-focus:ring-blue-500 group-focus:ring-offset-2 dark:bg-sky-500 dark:group-hover:bg-sky-400 dark:group-focus:ring-sky-500">
                Contact
              </span>
            </a>
            <a
              target="_blank"
              className="group text-sm font-semibold leading-6 text-slate-950 dark:text-white"
              href="#"
            >
              Book a demo{' '}
              <span
                aria-hidden="true"
                className="inline-block transition group-hover:translate-x-1"
              >
                →
              </span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
