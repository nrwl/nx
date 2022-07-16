export function NxStatistics(): JSX.Element {
  return (
    <div className="bg-white pt-12 dark:bg-slate-900 sm:pt-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl">
            Trusted by developers, OSS & Enterprise
          </h2>
          <p className="mt-3 text-lg text-slate-700 dark:text-slate-400 sm:mt-4">
            Works for projects of any size, Whether you have one project or one
            thousand, Nx will keep your CI fast and your workspace maintainable.
          </p>
        </div>
      </div>
      <div className="mt-10 bg-gray-50 pb-12 dark:bg-slate-800/40 sm:pb-16">
        <div className="relative">
          <div className="absolute inset-0 h-1/2 border-b border-slate-100 bg-white dark:border-black dark:bg-slate-900"></div>
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl">
              <dl className="overflow-hidden rounded-lg bg-white shadow dark:bg-slate-900 sm:grid sm:grid-cols-3">
                <div className="flex flex-col border-b border-slate-50 p-6 text-center dark:border-slate-800/40 sm:border-0 sm:border-r">
                  <dt className="order-2 mt-2 text-base font-medium leading-6">
                    Of developers using it every day for work and OSS
                  </dt>
                  <dd className="order-1 text-4xl font-semibold text-slate-800 drop-shadow-sm dark:text-slate-200 dark:drop-shadow-[0_1px_1px_rgba(255,255,255,0.35)]">
                    1M+
                  </dd>
                </div>
                <div className="flex flex-col border-t border-b border-slate-50 p-6 text-center dark:border-slate-800/40 sm:border-0 sm:border-l sm:border-r">
                  <dt className="order-2 mt-2 text-base font-medium leading-6">
                    Of Fortune 500 using it internally
                  </dt>
                  <dd className="order-1 text-4xl font-semibold text-slate-800 drop-shadow-sm dark:text-slate-200 dark:drop-shadow-[0_1px_1px_rgba(255,255,255,0.35)]">
                    50%
                  </dd>
                </div>
                <div className="flex flex-col border-t border-slate-50 p-6 text-center dark:border-slate-800/40 sm:border-0 sm:border-l">
                  <dt className="order-2 mt-2 text-base font-medium leading-6">
                    Weekly downloads on npmjs.com
                  </dt>
                  <dd className="order-1 text-4xl font-semibold text-slate-800 drop-shadow-sm dark:text-slate-200 dark:drop-shadow-[0_1px_1px_rgba(255,255,255,0.35)]">
                    2M+
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
