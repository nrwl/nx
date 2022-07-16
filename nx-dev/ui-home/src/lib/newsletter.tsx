export function Newsletter(): JSX.Element {
  const communityLinks = [
    {
      name: 'Youtube',
      label: 'Youtube channel',
      href: 'https://www.youtube.com/c/Nrwl_io?utm_source=nx.dev',
      icon: (props: any) => (
        <svg
          fill="currentColor"
          role="img"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          {...props}
        >
          {/*<title>YouTube</title>*/}
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      ),
    },
    {
      name: 'Slack',
      label: 'Community channel',
      href: 'https://go.nrwl.io/join-slack?utm_source=nx.dev',
      icon: (props: any) => (
        <svg
          fill="currentColor"
          role="img"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          {...props}
        >
          {/*<title>Slack</title>*/}
          <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
        </svg>
      ),
    },
    {
      name: 'Twitter',
      label: 'Latest news',
      href: 'https://twitter.com/NXdevtools?utm_source=nx.dev',
      icon: (props: any) => (
        <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
          {/*<title>Twitter</title>*/}
          <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
        </svg>
      ),
    },
    {
      name: 'Github',
      label: 'Nx is open source, check the code on Github',
      href: 'https://github.com/nrwl/nx?utm_source=nx.dev',
      icon: (props: any) => (
        <svg fill="currentColor" viewBox="0 0 16 16" {...props}>
          {/*<title>Github</title>*/}
          <path
            fillRule="evenodd"
            d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
          />
        </svg>
      ),
    },
  ];
  return (
    <div className="bg-gray-50 pt-28 dark:bg-slate-800/40">
      <div className="mx-auto max-w-7xl py-16 px-4 sm:px-6 lg:flex lg:items-center lg:py-24 lg:px-8">
        <div className="lg:w-0 lg:flex-1">
          <h1 className="text-lg font-semibold tracking-tight text-blue-500 dark:text-sky-500">
            Stay up to date
          </h1>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl">
            Nx is growing fast, stay in the loop!
          </h2>
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
        <div className="mt-8 lg:mt-0 lg:ml-8">
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
