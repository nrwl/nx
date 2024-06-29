import { ButtonLink } from '@nx/nx-dev/ui-common';

export function Migrate(): JSX.Element {
  return (
    <article
      id="getting-started"
      className="bg-gradient-to-r from-pink-500 to-fuchsia-500"
    >
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:flex lg:items-center lg:justify-between lg:px-8 lg:py-24">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
            <span className="block">Already have a monorepo?</span>
            <span className="block text-white">
              Nxify your workspace in less than a day.
            </span>
          </h2>
        </div>
        <div className="mt-8 flex lg:mt-0 lg:flex-shrink-0">
          <div className="inline-flex rounded-md">
            <ButtonLink
              href="/recipes/adopting-nx/adding-to-monorepo"
              title="Start using Nx by creating a workspace"
              variant="secondary"
              size="large"
            >
              Add Nx now!
            </ButtonLink>
          </div>
        </div>
      </div>
    </article>
  );
}
