import Link from 'next/link';

export function ReferencesPackageCard(pkg: {
  id: string;
  name: string;
  path: string;
}): JSX.Element {
  const iconsMap: Record<string, string> = {
    angular: '/images/icons/angular.svg',
    cli: '/images/icons/nx.svg',
    cypress: '/images/icons/cypress.svg',
    detox: '/images/icons/react.svg',
    devkit: '/images/icons/nx.svg',
    'eslint-plugin-nx': '/images/icons/eslint.svg',
    express: '/images/icons/express.svg',
    jest: '/images/icons/jest.svg',
    js: '/images/icons/javascript.svg',
    linter: '/images/icons/eslint.svg',
    nest: '/images/icons/nestjs.svg',
    next: '/images/icons/nextdotjs.svg',
    node: '/images/icons/nodedotjs.svg',
    nx: '/images/icons/nx.svg',
    'nx-plugin': '/images/icons/nx.svg',
    react: '/images/icons/react.svg',
    'react-native': '/images/icons/react.svg',
    storybook: '/images/icons/storybook.svg',
    web: '/images/icons/html5.svg',
    workspace: '/images/icons/nx.svg',
  };

  return (
    <div className="relative block overflow-hidden rounded-lg p-8 shadow-md transition-all hover:shadow-lg">
      <span className="absolute inset-x-0 bottom-0 h-2  bg-gradient-to-r from-[#8154E8] to-[#47BC99]"></span>

      <div className="justify-between sm:flex">
        <div>
          <h5 className="text-2xl font-bold text-slate-900 lg:text-3xl">
            {pkg.name}
          </h5>
          <p className="mt-1 text-sm font-medium text-slate-600">
            {pkg.id === 'nx' ? 'nx' : `@nrwl/${pkg.id}`}
          </p>
        </div>

        <div className="ml-3 block flex-shrink-0">
          <img
            className="h-10 w-10 rounded-lg object-cover opacity-75 lg:h-16 lg:w-16"
            loading="lazy"
            src={iconsMap[pkg.id]}
            alt={pkg.name + ' illustration'}
            aria-hidden="true"
          />
        </div>
      </div>

      <dl className="mt-6 flex">
        <div className="flex flex-col-reverse">
          <dt className="text-sm font-medium text-slate-600">More details</dt>
          <dd className="text-xs text-slate-500">
            <Link href={pkg.path as string}>
              <a title="See package details">
                <span className="absolute inset-0"></span>
                nx.dev{pkg.path}
              </a>
            </Link>
          </dd>
        </div>
      </dl>
    </div>
  );
}
