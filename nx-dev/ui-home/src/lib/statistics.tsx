const statistics = [
  {
    id: 1,
    name: 'use Nx every day',
    value: 2.5,
    suffix: ' million',
    associative: 'developers',
  },
  // Over
  {
    id: 2,
    name: 'companies use Nx to ship their products',
    prefix: 'Over ',
    value: 70,
    suffix: '%',
    associative: 'of Fortune 500',
  },
  {
    id: 3,
    name: 'on NPM every month',
    value: 24,
    suffix: ' million',
    associative: 'downloads',
  },
];

export function Statistics(): JSX.Element {
  return (
    <section id="statistics">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <dl className="grid grid-cols-1 justify-between gap-x-8 gap-y-16 text-center lg:grid-cols-3">
          {statistics.map((stat) => (
            <div
              key={stat.id}
              className="mx-auto flex max-w-sm flex-col gap-y-2"
            >
              <dt className="text-base leading-7 text-slate-600 dark:text-slate-400">
                {stat.name}
              </dt>
              <dd className="order-first text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
                <span className="text-blue-500 dark:text-sky-500">
                  {stat.prefix}
                  {stat.value}
                  {stat.suffix}
                </span>{' '}
                {stat.associative}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
