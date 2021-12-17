import cx from 'classnames';
import Link from 'next/link';

export interface FooterProps {
  useDarkBackground?: boolean;
}
export function Footer({ useDarkBackground }: FooterProps) {
  const navigation = {
    solutions: [
      { name: 'Nx', href: 'https://nx.dev' },
      { name: 'NxCloud', href: 'https://nx.app/?utm_source=nx.dev' },
      { name: 'Nrwl', href: 'https://nrwl.io/?utm_source=nx.dev' },
    ],
    resources: [
      { name: 'Blog', href: 'https://blog.nrwl.io/?utm_source=nx.dev' },
      {
        name: 'Youtube Channel',
        href: 'https://youtube.com/nrwl_io?utm_source=nx.dev',
      },
      {
        name: 'Nx Playbook',
        href: 'https://nxplaybook.com/?utm_source=nx.dev',
      },
      { name: 'Nrwl', href: 'https://nrwl.io/?utm_source=nx.dev' },
    ],
    community: [
      { name: 'Twitter', href: 'https://twitter.com/NXdevtools' },
      { name: 'Github', href: 'https://github.com/nrwl/nx/' },
      {
        name: 'Newsletter',
        href: 'https://go.nrwl.io/nx-newsletter?utm_source=nx.dev',
      },
      {
        name: 'Slack',
        href: 'https://go.nrwl.io/join-slack?utm_source=nx.dev',
      },
      {
        name: 'Help Us',
        href: 'https://github.com/nrwl/nx/issues?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc+label%3Acommunity',
      },
    ],
    help: [
      { name: 'Documentation', href: '/getting-started/intro' },
      { name: 'Community', href: '/community' },
      {
        name: 'StackOverflow',
        href: 'https://stackoverflow.com/questions/tagged/nrwl-nx',
      },
      {
        name: 'Report Issues',
        href: 'https://github.com/nrwl/nx/issues?q=is%3Aopen+is%3Aissue',
      },
    ],
    social: [
      {
        name: 'Twitter',
        href: 'https://twitter.com/NXdevtools?utm_source=nx.dev',
        icon: (props: any) => (
          <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
            <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
          </svg>
        ),
      },
      {
        name: 'GitHub',
        href: 'https://github.com/nrwl/nx?utm_source=nx.dev',
        icon: (props: any) => (
          <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
            <path
              fillRule="evenodd"
              d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              clipRule="evenodd"
            />
          </svg>
        ),
      },
      {
        name: 'Slack',
        href: 'https://go.nrwl.io/join-slack?utm_source=nx.dev',
        icon: (props: any) => (
          <svg
            fill="currentColor"
            role="img"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
          >
            <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
          </svg>
        ),
      },
      {
        name: 'Newsletter',
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
  return (
    <footer
      className={cx(useDarkBackground ? 'bg-blue-nx-dark' : 'bg-white')}
      aria-labelledby="footer-heading"
    >
      <h2 id="footer-heading" className="sr-only">
        Footer
      </h2>
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:py-16 lg:px-8">
        <div className="xl:grid xl:grid-cols-3 xl:gap-8">
          <div className="text-gray-500 space-y-4 xl:col-span-1">
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
            <p className="text-base">Smart, Fast and Extensible Build System</p>
            <div className="flex space-x-6">
              {navigation.social.map((item) => (
                <Link key={item.name} href={item.href}>
                  <a
                    className={cx(
                      'text-gray-400',
                      useDarkBackground
                        ? 'hover:text-gray-300'
                        : 'hover:text-gray-500'
                    )}
                  >
                    <span className="sr-only">{item.name}</span>
                    <item.icon className="h-6 w-6" aria-hidden="true" />
                  </a>
                </Link>
              ))}
            </div>
          </div>
          <div className="mt-12 grid grid-cols-2 gap-8 xl:mt-0 xl:col-span-2">
            <div className="md:grid md:grid-cols-2 md:gap-8">
              <div>
                <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">
                  Resources
                </h3>
                <ul role="list" className="mt-4 space-y-4">
                  {navigation.resources.map((item) => (
                    <li key={item.name}>
                      <Link href={item.href}>
                        <a
                          className={cx(
                            'text-base text-gray-500',
                            useDarkBackground
                              ? 'hover:text-gray-200'
                              : 'hover:text-gray-900'
                          )}
                        >
                          {item.name}
                        </a>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-12 md:mt-0">
                <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">
                  Help
                </h3>
                <ul role="list" className="mt-4 space-y-4">
                  {navigation.help.map((item) => (
                    <li key={item.name}>
                      <Link href={item.href}>
                        <a
                          className={cx(
                            'text-base text-gray-500',
                            useDarkBackground
                              ? 'hover:text-gray-200'
                              : 'hover:text-gray-900'
                          )}
                        >
                          {item.name}
                        </a>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="md:grid md:grid-cols-2 md:gap-8">
              <div>
                <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">
                  Community
                </h3>
                <ul role="list" className="mt-4 space-y-4">
                  {navigation.community.map((item) => (
                    <li key={item.name}>
                      <Link href={item.href}>
                        <a
                          className={cx(
                            'text-base text-gray-500',
                            useDarkBackground
                              ? 'hover:text-gray-200'
                              : 'hover:text-gray-900'
                          )}
                        >
                          {item.name}
                        </a>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-12 md:mt-0">
                <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">
                  Solutions
                </h3>
                <ul role="list" className="mt-4 space-y-4">
                  {navigation.solutions.map((item) => (
                    <li key={item.name}>
                      <Link href={item.href}>
                        <a
                          className={cx(
                            'text-base text-gray-500',
                            useDarkBackground
                              ? 'hover:text-gray-200'
                              : 'hover:text-gray-900'
                          )}
                        >
                          {item.name}
                        </a>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-12 border-t border-gray-200 pt-6">
          <p className="text-base text-gray-400 xl:text-center">
            &copy; 2021 made with{' '}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="-mt-0.5 h-5 w-5 inline"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                clipRule="evenodd"
              />
            </svg>{' '}
            by{' '}
            <Link href="https://nrwl.io/?utm_source=nx.dev">
              <a target="_blank" rel="nofollow">
                <svg
                  className="-mt-0.5 ml-0.5 w-14 h-auto inline"
                  role="img"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="currentColor"
                >
                  <path d="M3.357 8.258a3.424 3.424 0 00-.845.123l.054-.02a3.437 3.437 0 00-.841.346 3.437 3.437 0 00-.262.168 3.437 3.437 0 00-.11.078 3.424 3.424 0 00-.025.022 3.437 3.437 0 00-.01.005 3.424 3.424 0 00-.103.084 3.437 3.437 0 00-.115.104 3.437 3.437 0 00-.05.045 3.424 3.424 0 00-.08.08 3.424 3.424 0 00-.099.107 3.437 3.437 0 00-.03.034 3.424 3.424 0 00-.071.086 3.437 3.437 0 00-.034.04 3.424 3.424 0 00-.066.088 3.437 3.437 0 00-.006.008 3.424 3.424 0 00-.072.1 3.437 3.437 0 00-.014.02 3.424 3.424 0 00-.082.132 3.424 3.424 0 00-.074.127 3.437 3.437 0 00-.012.026 3.424 3.424 0 00-.062.12 3.424 3.424 0 00-.067.143 3.424 3.424 0 00-.054.135 3.437 3.437 0 00-.008.02 3.424 3.424 0 00-.131.437 3.424 3.424 0 00-.031.152 3.424 3.424 0 00-.026.149 3.437 3.437 0 000 .013 3.424 3.424 0 00-.027.303A3.424 3.424 0 000 11.68a3.437 3.437 0 000 .04 3.424 3.424 0 00.004.124A3.424 3.424 0 00.016 12a3.424 3.424 0 00.015.14 3.437 3.437 0 00.01.057 3.424 3.424 0 00.018.108 3.437 3.437 0 000 .004 3.424 3.424 0 00.025.123 3.437 3.437 0 00.037.15 3.437 3.437 0 00.096.297 3.437 3.437 0 00.056.144 3.437 3.437 0 00.432.745c.014.02.025.024.04.043a3.424 3.424 0 00.007.01 3.424 3.424 0 00.305.33l.011.013c.1.09.16.132.137.129.008.006.02.01.03.018a3.424 3.424 0 00.017.017.711.711 0 01-.205-.08.683.683 0 00-.39-.088.696.696 0 00-.608.947 1.993 1.993 0 01.564-.12 2.088 2.088 0 01.34.007 1.707 1.707 0 00.283.006c.05-.004.098-.01.147-.018a1.714 1.714 0 00.584-.203 3.424 3.424 0 00.437.17 4.43 4.43 0 002.989-.193.528.528 0 00.115-.076.179.179 0 00.076.03l1.789.169v.863H8.75v-.734l1.12.105-4.204-.754a.111.111 0 00-.014-.004c-.01-.1-.095-.172-.13-.218a.134.134 0 01-.03-.07 1.64 1.64 0 00-1.496-1.52.504.504 0 00-.18-.193.503.503 0 01-.187-.4.56.56 0 00-.498.44 1.393 1.393 0 01-.377-2.222 1.798 1.798 0 011.312-.563A1.824 1.824 0 015.83 10.96a.914.914 0 01-.543.32.904.904 0 00-.736.748c.35 0 .585.477 1.236.477a.59.59 0 00.547-.367.592.592 0 00.549.367 1.17 1.17 0 00.49-.106v2.002l1.377.327v-1.592l2.193 2.605H12.1v-4.89h-1.38v2.605L8.53 10.852H7.373v.427c-.283-.05-.556-.255-.65-.52a3.424 3.424 0 00-3.366-2.501zM22.109 9.96v4.414c0 1.186.766 1.336 1.485 1.336.219 0 .406-.02.406-.02v-1.03s-.078.007-.164.007c-.305 0-.375-.12-.375-.453V9.96zm-6.816 1.932a2.057 2.057 0 00-.709.128 1.253 1.253 0 00-.535.385v-.453h-1.285v3.79h1.347v-1.74c0-.316.081-.551.244-.704.164-.154.39-.23.678-.23a2.937 2.937 0 01.307.017v-1.193a2.057 2.057 0 00-.047 0zm.584.06l1.094 3.787h1.306l.477-1.736.45 1.736h1.306l1.094-3.787h-1.186l-.54 1.932-.52-1.932h-1.15l-.542 1.912-.512-1.912zm-12.281 2.14c.03 0 .07.016.117.027.092.023.17.02.15.108a.171.171 0 01-.332-.08c.01-.044.033-.056.065-.055z" />
                </svg>
              </a>
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
