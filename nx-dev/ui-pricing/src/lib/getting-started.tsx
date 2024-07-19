export function GettingStarted() {
  return (
    <article
      id="getting-started"
      className="bg-gradient-to-r from-fuchsia-500 to-violet-500 shadow-inner"
    >
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:flex lg:items-center lg:justify-between lg:px-8 lg:py-24">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
            <span className="block">Ready to speed up your workflow?</span>
            <span className="block text-white">
              Connect your workspace to the cloud
            </span>
          </h2>
        </div>
        <div className="mt-8 flex lg:mt-0 lg:flex-shrink-0">
          <div className="inline-flex rounded-md">
            <a
              href="https://cloud.nx.app"
              title="Start using Nx Cloud by creating an account"
              className="w-full flex-none rounded-lg border border-transparent bg-white px-6 py-3 text-lg font-semibold leading-6 transition hover:bg-slate-200 focus:ring-2 focus:ring-offset-2 focus:ring-offset-white sm:w-auto dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
            >
              Sign up now!
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
