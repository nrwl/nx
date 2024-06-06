import { DiscordIcon, SectionHeading } from '@nx/nx-dev/ui-common';

export function Newsletter(): JSX.Element {
  const communityLinks = [
    {
      name: 'Youtube',
      label: 'Youtube channel',
      href: 'https://www.youtube.com/@NxDevtools?utm_source=nx.dev',
      icon: (props: any) => (
        <svg
          fill="currentColor"
          role="img"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          {...props}
        >
          {/*<title>YouTube</title>*/}
          <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14c-1.88-.5-9.38-.5-9.38-.5s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.87.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81zM9.54 15.57V8.43L15.82 12l-6.28 3.57z" />
        </svg>
      ),
    },
    {
      name: 'Discord',
      label: 'Community channel',
      href: 'https://go.nx.dev/community',
      icon: (props: any) => <DiscordIcon {...props} />,
    },
    {
      name: 'Twitter',
      label: 'Latest news',
      href: 'https://twitter.com/NXdevtools?utm_source=nx.dev',
      icon: (props: any) => (
        <svg
          fill="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          {...props}
        >
          {/*<title>Twitter</title>*/}
          <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
        </svg>
      ),
    },
    {
      name: 'GitHub',
      label: 'Nx is open source, check the code on GitHub',
      href: 'https://github.com/nrwl/nx?utm_source=nx.dev',
      icon: (props: any) => (
        <svg
          fill="currentColor"
          viewBox="0 0 16 16"
          xmlns="http://www.w3.org/2000/svg"
          {...props}
        >
          {/*<title>GitHub</title>*/}
          <path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38l-.01-1.49c-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48l-.01 2.2c0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8a8 8 0 0 0-8-8z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="bg-slate-50 pt-28 dark:bg-slate-800/40">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:flex lg:items-center lg:px-8 lg:py-24">
        <div className="lg:w-0 lg:flex-1">
          <SectionHeading as="h1" variant="title" id="stay-informed">
            Stay up to date
          </SectionHeading>
          <SectionHeading
            as="p"
            variant="display"
            id="nx-is-fast"
            className="mt-4"
          >
            Nx is growing fast, stay in the loop!
          </SectionHeading>
          <p className="mt-4 text-lg text-slate-700 dark:text-slate-400">
            Join the Nx community and stay updated on new releases and features,
            guides and recipes, events and fresh video tutorials.
          </p>
          {/*<p className="mt-4 text-lg text-slate-700 dark:text-slate-400">
            Or follow use directly, You chose!
          </p>*/}
          {/*<div className="mt-4 space-x-2">
            {communityLinks.map((item) => (
              <a
                key={item.name}
                title={item.label}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex p-1"
              >
                <span className="sr-only">{item.label}</span>
                <item.icon className="h-6 w-6" aria-hidden="true" />
              </a>
            ))}
          </div>*/}
        </div>
        <div className="mt-8 lg:ml-8 lg:mt-0">
          <div className="mt-4 space-x-12">
            {communityLinks.map((item) => (
              <a
                key={item.name}
                title={item.label}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex p-1 opacity-80 transition hover:opacity-100"
              >
                <span className="sr-only">{item.label}</span>
                <item.icon className="h-12 w-12" aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>
        {/*<div className="mt-8 lg:mt-0 lg:ml-8">
          <form className="sm:flex">
            <label htmlFor="email-address" className="sr-only">
              Email address
            </label>
            <input
              id="email-address"
              name="email-address"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-md border-0 bg-white py-1.5 px-2 text-sm leading-4 ring-1 ring-slate-300 transition dark:bg-slate-700 dark:ring-slate-900"
              placeholder="Enter your email"
            />
            <div className="mt-3 rounded-md shadow sm:mt-0 sm:ml-3 sm:flex-shrink-0">
              <button
                type="submit"
                className="flex w-full rounded-lg bg-blue-500 py-3 px-6 text-lg text-white dark:bg-sky-500"
              >
                Notify me
              </button>
            </div>
          </form>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-500">
            We care about the protection of your data. Read our{' '}
            <a
              href="https://nrwl.io/pages/privacy-policy"
              target="_blank"
              rel="noreferrer"
              className="font-medium underline"
            >
              Privacy Policy.
            </a>
          </p>
        </div>*/}
      </div>
    </div>
  );
}
