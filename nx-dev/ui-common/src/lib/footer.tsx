import { HeartIcon } from '@heroicons/react/24/solid';
import { ThemeSwitcher } from '@nx/nx-dev/ui-theme';
import Link from 'next/link';
import { DiscordIcon } from './discord-icon';
import { VersionPicker } from './version-picker';

const navigation = {
  nx: [
    { name: 'Status', href: 'https://status.nx.app' },
    { name: 'Security', href: 'https://security.nx.app' },
  ],
  nxCloud: [
    { name: 'App', href: 'https://cloud.nx.app' },
    { name: 'Docs', href: '/ci/intro/ci-with-nx' },
    { name: 'Pricing', href: '/pricing' },
  ],
  solutions: [
    { name: 'Nx', href: 'https://nx.dev' },
    { name: 'Nx Cloud', href: '/nx-cloud' },
    { name: 'Nx Enterprise', href: '/enterprise' },
  ],
  resources: [
    { name: 'Blog', href: '/blog' },
    {
      name: 'Youtube',
      href: 'https://youtube.com/@nxdevtools',
    },
    {
      name: 'Community',
      href: '/community',
    },
    {
      name: 'Customers',
      href: '/customers',
    },
  ],
  company: [
    { name: 'About us', href: '/company' },
    { name: 'Careers', href: '/careers' },
    {
      name: 'Brands & Guidelines',
      href: '/brands',
    },
    { name: 'Contact us', href: '/contact' },
  ],
  social: [
    {
      name: 'Discord',
      label: 'Community channel',
      href: 'https://go.nx.dev/community',
      icon: (props: any) => <DiscordIcon {...props} />,
    },
    {
      name: 'GitHub',
      label: 'Nx is open source, check the code on GitHub',
      href: 'https://github.com/nrwl/nx?utm_source=nx.dev',
      icon: (props: any) => (
        <svg fill="currentColor" viewBox="0 0 16 16" {...props}>
          {/*<title>GitHub</title>*/}
          <path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38l-.01-1.49c-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48l-.01 2.2c0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8a8 8 0 0 0-8-8z" />
        </svg>
      ),
    },
    {
      name: 'X',
      label: 'Latest news on X',
      href: 'https://x.com/NxDevTools?utm_source=nx.dev',
      icon: (props: any) => (
        <svg
          fill="currentColor"
          role="img"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          {...props}
        >
          {/*<title>X</title>*/}
          <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
        </svg>
      ),
    },
    {
      name: 'Bluesky',
      label: 'Latest news on Bluesky',
      href: 'https://bsky.app/profile/nx.dev?utm_source=nx.dev',
      icon: (props: any) => (
        <svg
          fill="currentColor"
          role="img"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          {...props}
        >
          {/*<title>Bluesky</title>*/}
          <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8Z" />
        </svg>
      ),
    },
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
      name: 'Newsletter',
      label: 'The Newsletter',
      href: 'https://go.nrwl.io/nx-newsletter?utm_source=nx.dev',
      icon: (props: any) => (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          {...props}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
          />
        </svg>
      ),
    },
  ],
};

export function Footer({
  className = '',
}: { className?: string } = {}): JSX.Element {
  return (
    <footer
      className={`bg-white dark:bg-slate-950 ${className}`}
      aria-labelledby="footer-heading"
    >
      <h2 id="footer-heading" className="sr-only">
        Footer
      </h2>
      <div className="mx-auto max-w-7xl px-4 pt-12 transition-opacity sm:px-6 lg:px-8 lg:pt-16 lg:opacity-50 lg:hover:opacity-100">
        <div className="xl:grid xl:grid-cols-3 xl:gap-8">
          <div className="space-y-4 text-slate-700 xl:col-span-1 dark:text-slate-300">
            <svg
              className="h-14 subpixel-antialiased"
              role="img"
              viewBox="0 0 24 24"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
            >
              <title>Nx</title>
              <path d="M11.987 14.138l-3.132 4.923-5.193-8.427-.012 8.822H0V4.544h3.691l5.247 8.833.005-3.998 3.044 4.759zm.601-5.761c.024-.048 0-3.784.008-3.833h-3.65c.002.059-.005 3.776-.003 3.833h3.645zm5.634 4.134a2.061 2.061 0 0 0-1.969 1.336 1.963 1.963 0 0 1 2.343-.739c.396.161.917.422 1.33.283a2.1 2.1 0 0 0-1.704-.88zm3.39 1.061c-.375-.13-.8-.277-1.109-.681-.06-.08-.116-.17-.176-.265a2.143 2.143 0 0 0-.533-.642c-.294-.216-.68-.322-1.18-.322a2.482 2.482 0 0 0-2.294 1.536 2.325 2.325 0 0 1 4.002.388.75.75 0 0 0 .836.334c.493-.105.46.36 1.203.518v-.133c-.003-.446-.246-.55-.75-.733zm2.024 1.266a.723.723 0 0 0 .347-.638c-.01-2.957-2.41-5.487-5.37-5.487a5.364 5.364 0 0 0-4.487 2.418c-.01-.026-1.522-2.39-1.538-2.418H8.943l3.463 5.423-3.379 5.32h3.54l1.54-2.366 1.568 2.366h3.541l-3.21-5.052a.7.7 0 0 1-.084-.32 2.69 2.69 0 0 1 2.69-2.691h.001c1.488 0 1.736.89 2.057 1.308.634.826 1.9.464 1.9 1.541a.707.707 0 0 0 1.066.596zm.35.133c-.173.372-.56.338-.755.639-.176.271.114.412.114.412s.337.156.538-.311c.104-.231.14-.488.103-.74z" />
            </svg>
            <p className="text-sm">Smart Monorepos · Fast CI</p>
            <div className="flex space-x-6">
              {navigation.social.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  title={item.label}
                  prefetch={false}
                  className="text-sm text-slate-500 hover:text-slate-600 dark:hover:text-slate-400"
                >
                  <span className="sr-only">{item.name}</span>
                  <item.icon className="h-6 w-6" aria-hidden="true" />
                </Link>
              ))}
            </div>
            <div className="flex items-center gap-3 text-sm">
              {navigation.nx.map((item) =>
                item.href.startsWith('http') ? (
                  <a
                    key={item.name}
                    href={item.href}
                    title={item.name}
                    target="_blank"
                    rel="noreferer"
                    className="text-slate-500 hover:text-slate-600 dark:hover:text-slate-400"
                  >
                    {item.name}
                  </a>
                ) : (
                  <Link
                    key={item.name}
                    href={item.href}
                    title={item.name}
                    prefetch={false}
                    className="text-slate-500 hover:text-slate-600 dark:hover:text-slate-400"
                  >
                    {item.name}
                  </Link>
                )
              )}
            </div>
            <div className="flex items-center text-sm">
              Nx Version <VersionPicker />
            </div>
            <div className="flex items-center text-sm">
              Theme <ThemeSwitcher />
            </div>
          </div>
          <div className="mt-12 grid grid-cols-2 gap-8 xl:col-span-2 xl:mt-0">
            <div className="md:grid md:grid-cols-2 md:gap-8">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                  Resources
                </h3>
                <ul role="list" className="mt-4 space-y-4">
                  {navigation.resources.map((item) => (
                    <li key={item.name}>
                      {item.href.startsWith('http') ? (
                        <a
                          href={item.href}
                          target="_blank"
                          title={item.name}
                          rel="noreferer"
                          className="text-sm text-slate-500 hover:text-slate-600 dark:hover:text-slate-400"
                        >
                          {item.name}
                        </a>
                      ) : (
                        <Link
                          href={item.href}
                          prefetch={false}
                          title={item.name}
                          className="text-sm text-slate-500 hover:text-slate-600 dark:hover:text-slate-400"
                        >
                          {item.name}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-12 md:mt-0">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                  Solutions
                </h3>
                <ul role="list" className="mt-4 space-y-4">
                  {navigation.solutions.map((item) => (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        prefetch={false}
                        title={item.name}
                        className="text-sm text-slate-500 hover:text-slate-600 dark:hover:text-slate-400"
                      >
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="md:grid md:grid-cols-2 md:gap-8">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                  Nx Cloud
                </h3>
                <ul role="list" className="mt-4 space-y-4">
                  {navigation.nxCloud.map((item) => (
                    <li key={item.name}>
                      {item.href.startsWith('http') ? (
                        <a
                          href={item.href}
                          title={item.name}
                          target="_blank"
                          rel="noreferer"
                          className="text-sm text-slate-500 hover:text-slate-600 dark:hover:text-slate-400"
                        >
                          {item.name}
                        </a>
                      ) : (
                        <Link
                          href={item.href}
                          prefetch={false}
                          title={item.name}
                          className="text-sm text-slate-500 hover:text-slate-600 dark:hover:text-slate-400"
                        >
                          {item.name}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-12 md:mt-0">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                  Company
                </h3>
                <ul role="list" className="mt-4 space-y-4">
                  {navigation.company.map((item) => (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        prefetch={false}
                        title={item.name}
                        className="text-sm text-slate-500 hover:text-slate-600 dark:hover:text-slate-400"
                      >
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-20 border-t border-slate-200 p-2 dark:border-slate-800">
          <p className="text-sm text-slate-400 xl:text-center">
            &copy; 2024 made with{' '}
            <HeartIcon className="-mt-0.5 inline h-4 w-4" /> by{' '}
            <Link href="/company" prefetch={false} title="Company">
              <svg
                role="img"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                fill="currentColor"
                className="-mt-1 ml-0.5 inline h-auto w-6"
              >
                <path d="m12 14.1-3.1 5-5.2-8.5v8.9H0v-15h3.7l5.2 8.9v-4l3 4.7zm.6-5.7V4.5H8.9v3.9h3.7zm5.6 4.1a2 2 0 0 0-2 1.3 2 2 0 0 1 2.4-.7c.4.2 1 .4 1.3.3a2.1 2.1 0 0 0-1.7-.9zm3.4 1c-.4 0-.8-.2-1.1-.6l-.2-.3a2.1 2.1 0 0 0-.5-.6 2 2 0 0 0-1.2-.3 2.5 2.5 0 0 0-2.3 1.5 2.3 2.3 0 0 1 4 .4.8.8 0 0 0 .9.3c.5 0 .4.4 1.2.5v-.1c0-.4-.3-.5-.8-.7zm2 1.3a.7.7 0 0 0 .4-.6c0-3-2.4-5.5-5.4-5.5a5.4 5.4 0 0 0-4.5 2.4l-1.5-2.4H8.9l3.5 5.4L9 19.5h3.6L14 17l1.6 2.4h3.5l-3.1-5a.7.7 0 0 1 0-.3 2.7 2.7 0 0 1 2.6-2.7c1.5 0 1.7.9 2 1.3.7.8 2 .5 2 1.5a.7.7 0 0 0 1 .6zm.4.2c-.2.3-.6.3-.8.6-.1.3.1.4.1.4s.4.2.6-.3V15z" />
              </svg>
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
