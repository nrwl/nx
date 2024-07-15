import { ButtonLink } from '@nx/nx-dev/ui-common';
import { Fragment, useEffect, useState } from 'react';
import { Transition } from '@headlessui/react';
import { cx } from '@nx/nx-dev/ui-primitives';
import Link from 'next/link';

export function Hero(): JSX.Element {
  const [copied, setCopied] = useState(false);
  const [displayBuildSystem, setDisplayBuildSystem] = useState(false);
  const [displayTools, setDisplayTools] = useState(false);
  const [displayCi, setDisplayCi] = useState(false);
  useEffect(() => {
    let t: NodeJS.Timeout;
    if (copied) {
      t = setTimeout(() => {
        setCopied(false);
      }, 3000);
    }
    return () => {
      t && clearTimeout(t);
    };
  }, [copied]);

  return (
    <header className="bg-contain bg-fixed bg-clip-border bg-center bg-no-repeat bg-origin-border lg:bg-local">
      <div className="mx-auto max-w-3xl px-4 pt-20">
        <div className="hidden sm:mb-8 sm:flex sm:justify-center">
          <div className="relative rounded-full px-3 py-1 text-sm leading-6 ring-1 ring-slate-900/10 transition-all hover:ring-slate-900/20 dark:ring-slate-100/10 dark:hover:ring-slate-100/20">
            Introducing{' '}
            <span className="text-blue-500 dark:text-sky-500">Nx Agents</span>,
            the next leap in CI.{' '}
            <Link
              href="/ci/features/distribute-task-execution"
              title="Discover Nx Agents"
              className="font-semibold text-blue-500 dark:text-sky-500"
              prefetch={false}
            >
              <span className="absolute inset-0" aria-hidden="true"></span>Read
              more <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
        <div className="text-center">
          <h1
            className="text-3xl font-bold leading-none tracking-tight text-black sm:mt-6 sm:text-5xl md:text-6xl dark:text-white"
            data-cy="primary-heading"
          >
            <span className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent">
              Smart
            </span>{' '}
            Monorepos
            <svg
              viewBox="0 0 2 2"
              fill="currentColor"
              className="mx-4 inline-flex h-2 w-2"
            >
              <circle cx={1} cy={1} r={1} />
            </svg>
            <span className="rounded-lg bg-gradient-to-r from-pink-500 to-fuchsia-500 bg-clip-text text-transparent">
              Fast
            </span>{' '}
            CI
          </h1>
          <h2 className="mt-6 text-lg font-medium leading-8 dark:text-slate-100">
            Nx is a{' '}
            <span
              onClick={() => setDisplayBuildSystem(!displayBuildSystem)}
              className={cx(
                'text-md  my-0.5 inline-flex cursor-pointer items-center rounded-md px-1.5 py-0.5 font-medium ring-1 ring-inset ring-slate-500/10 transition hover:bg-slate-50 hover:underline dark:ring-slate-400/20 hover:dark:bg-slate-400/10',
                displayBuildSystem && 'bg-yellow-500/10 dark:bg-yellow-500/20'
              )}
            >
              build system
            </span>{' '}
            <Transition
              as={Fragment}
              show={displayBuildSystem}
              enter="transform transition duration-[400ms]"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="transform duration-200 transition ease-in-out"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <span className="rounded-md bg-gradient-to-r from-orange-500 to-yellow-500 bg-clip-text text-transparent">
                optimized for monorepos
              </span>
            </Transition>{' '}
            with{' '}
            <span
              onClick={() => setDisplayTools(!displayTools)}
              className={cx(
                'text-md my-0.5 inline-flex cursor-pointer items-center rounded-md px-1.5 py-0.5 font-medium ring-1 ring-inset ring-slate-500/10 transition hover:bg-slate-50 hover:underline dark:ring-slate-400/20 hover:dark:bg-slate-400/10',
                displayTools && 'bg-cyan-500/10 dark:bg-cyan-500/20'
              )}
            >
              built-in tooling
            </span>{' '}
            <Transition
              as={Fragment}
              show={displayTools}
              enter="transform transition duration-[400ms]"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="transform duration-200 transition ease-in-out"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <span className="rounded-md bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent">
                for code scaffolding, module boundary enforcement, automated
                updates
              </span>
            </Transition>{' '}
            and{' '}
            <span
              onClick={() => setDisplayCi(!displayCi)}
              className={cx(
                'text-md my-0.5 inline-flex cursor-pointer items-center rounded-md px-1.5 py-0.5 font-medium ring-1 ring-inset ring-slate-500/10 transition hover:bg-slate-50 hover:underline dark:ring-slate-400/20 hover:dark:bg-slate-400/10',
                displayCi && 'bg-fuchsia-500/10 dark:bg-fuchsia-500/20'
              )}
            >
              advanced CI capabilities
            </span>{' '}
            <Transition
              as={Fragment}
              show={displayCi}
              enter="transform transition duration-[400ms]"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="transform duration-200 transition ease-in-out"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <span className="rounded-md bg-gradient-to-r from-pink-500 to-fuchsia-500 bg-clip-text text-transparent">
                with caching and distribution
              </span>
            </Transition>{' '}
            . It helps you maintain and scale monorepos, both locally and on CI.
          </h2>
          <div className="mt-4 flex items-center justify-center gap-x-6">
            <ButtonLink
              href="/getting-started/intro"
              variant="primary"
              size="large"
              title="Start using Nx by creating a workspace"
            >
              Get started
            </ButtonLink>

            <ButtonLink
              href="/contact"
              variant="secondary"
              size="large"
              title="Contact us"
            >
              Contact us
            </ButtonLink>
          </div>
          <div className="text-md mt-4 flex items-center justify-center gap-2 italic">
            Built with
            <svg
              role="img"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="currentColor"
              aria-hidden="true"
            >
              <title>Rust</title>
              <path d="M23.8346 11.7033l-1.0073-.6236a13.7268 13.7268 0 00-.0283-.2936l.8656-.8069a.3483.3483 0 00-.1154-.578l-1.1066-.414a8.4958 8.4958 0 00-.087-.2856l.6904-.9587a.3462.3462 0 00-.2257-.5446l-1.1663-.1894a9.3574 9.3574 0 00-.1407-.2622l.49-1.0761a.3437.3437 0 00-.0274-.3361.3486.3486 0 00-.3006-.154l-1.1845.0416a6.7444 6.7444 0 00-.1873-.2268l.2723-1.153a.3472.3472 0 00-.417-.4172l-1.1532.2724a14.0183 14.0183 0 00-.2278-.1873l.0415-1.1845a.3442.3442 0 00-.49-.328l-1.076.491c-.0872-.0476-.1742-.0952-.2623-.1407l-.1903-1.1673A.3483.3483 0 0016.256.955l-.9597.6905a8.4867 8.4867 0 00-.2855-.086l-.414-1.1066a.3483.3483 0 00-.5781-.1154l-.8069.8666a9.2936 9.2936 0 00-.2936-.0284L12.2946.1683a.3462.3462 0 00-.5892 0l-.6236 1.0073a13.7383 13.7383 0 00-.2936.0284L9.9803.3374a.3462.3462 0 00-.578.1154l-.4141 1.1065c-.0962.0274-.1903.0567-.2855.086L7.744.955a.3483.3483 0 00-.5447.2258L7.009 2.348a9.3574 9.3574 0 00-.2622.1407l-1.0762-.491a.3462.3462 0 00-.49.328l.0416 1.1845a7.9826 7.9826 0 00-.2278.1873L3.8413 3.425a.3472.3472 0 00-.4171.4171l.2713 1.1531c-.0628.075-.1255.1509-.1863.2268l-1.1845-.0415a.3462.3462 0 00-.328.49l.491 1.0761a9.167 9.167 0 00-.1407.2622l-1.1662.1894a.3483.3483 0 00-.2258.5446l.6904.9587a13.303 13.303 0 00-.087.2855l-1.1065.414a.3483.3483 0 00-.1155.5781l.8656.807a9.2936 9.2936 0 00-.0283.2935l-1.0073.6236a.3442.3442 0 000 .5892l1.0073.6236c.008.0982.0182.1964.0283.2936l-.8656.8079a.3462.3462 0 00.1155.578l1.1065.4141c.0273.0962.0567.1914.087.2855l-.6904.9587a.3452.3452 0 00.2268.5447l1.1662.1893c.0456.088.0922.1751.1408.2622l-.491 1.0762a.3462.3462 0 00.328.49l1.1834-.0415c.0618.0769.1235.1528.1873.2277l-.2713 1.1541a.3462.3462 0 00.4171.4161l1.153-.2713c.075.0638.151.1255.2279.1863l-.0415 1.1845a.3442.3442 0 00.49.327l1.0761-.49c.087.0486.1741.0951.2622.1407l.1903 1.1662a.3483.3483 0 00.5447.2268l.9587-.6904a9.299 9.299 0 00.2855.087l.414 1.1066a.3452.3452 0 00.5781.1154l.8079-.8656c.0972.0111.1954.0203.2936.0294l.6236 1.0073a.3472.3472 0 00.5892 0l.6236-1.0073c.0982-.0091.1964-.0183.2936-.0294l.8069.8656a.3483.3483 0 00.578-.1154l.4141-1.1066a8.4626 8.4626 0 00.2855-.087l.9587.6904a.3452.3452 0 00.5447-.2268l.1903-1.1662c.088-.0456.1751-.0931.2622-.1407l1.0762.49a.3472.3472 0 00.49-.327l-.0415-1.1845a6.7267 6.7267 0 00.2267-.1863l1.1531.2713a.3472.3472 0 00.4171-.416l-.2713-1.1542c.0628-.0749.1255-.1508.1863-.2278l1.1845.0415a.3442.3442 0 00.328-.49l-.49-1.076c.0475-.0872.0951-.1742.1407-.2623l1.1662-.1893a.3483.3483 0 00.2258-.5447l-.6904-.9587.087-.2855 1.1066-.414a.3462.3462 0 00.1154-.5781l-.8656-.8079c.0101-.0972.0202-.1954.0283-.2936l1.0073-.6236a.3442.3442 0 000-.5892zm-6.7413 8.3551a.7138.7138 0 01.2986-1.396.714.714 0 11-.2997 1.396zm-.3422-2.3142a.649.649 0 00-.7715.5l-.3573 1.6685c-1.1035.501-2.3285.7795-3.6193.7795a8.7368 8.7368 0 01-3.6951-.814l-.3574-1.6684a.648.648 0 00-.7714-.499l-1.473.3158a8.7216 8.7216 0 01-.7613-.898h7.1676c.081 0 .1356-.0141.1356-.088v-2.536c0-.074-.0536-.0881-.1356-.0881h-2.0966v-1.6077h2.2677c.2065 0 1.1065.0587 1.394 1.2088.0901.3533.2875 1.5044.4232 1.8729.1346.413.6833 1.2381 1.2685 1.2381h3.5716a.7492.7492 0 00.1296-.0131 8.7874 8.7874 0 01-.8119.9526zM6.8369 20.024a.714.714 0 11-.2997-1.396.714.714 0 01.2997 1.396zM4.1177 8.9972a.7137.7137 0 11-1.304.5791.7137.7137 0 011.304-.579zm-.8352 1.9813l1.5347-.6824a.65.65 0 00.33-.8585l-.3158-.7147h1.2432v5.6025H3.5669a8.7753 8.7753 0 01-.2834-3.348zm6.7343-.5437V8.7836h2.9601c.153 0 1.0792.1772 1.0792.8697 0 .575-.7107.7815-1.2948.7815zm10.7574 1.4862c0 .2187-.008.4363-.0243.651h-.9c-.09 0-.1265.0586-.1265.1477v.413c0 .973-.5487 1.1846-1.0296 1.2382-.4576.0517-.9648-.1913-1.0275-.4717-.2704-1.5186-.7198-1.8436-1.4305-2.4034.8817-.5599 1.799-1.386 1.799-2.4915 0-1.1936-.819-1.9458-1.3769-2.3153-.7825-.5163-1.6491-.6195-1.883-.6195H5.4682a8.7651 8.7651 0 014.907-2.7699l1.0974 1.151a.648.648 0 00.9182.0213l1.227-1.1743a8.7753 8.7753 0 016.0044 4.2762l-.8403 1.8982a.652.652 0 00.33.8585l1.6178.7188c.0283.2875.0425.577.0425.8717zm-9.3006-9.5993a.7128.7128 0 11.984 1.0316.7137.7137 0 01-.984-1.0316zm8.3389 6.71a.7107.7107 0 01.9395-.3625.7137.7137 0 11-.9405.3635z" />
            </svg>
            <span className="sr-only">Rust</span> for speed &
            <svg
              role="img"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="currentColor"
              aria-hidden="true"
            >
              <title>TypeScript</title>
              <path d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.214.776.214 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z" />
            </svg>
            <span className="sr-only">TypeScript</span> for extensibility
          </div>
        </div>
      </div>
      <div className="relative overflow-hidden pt-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <img
            src="/images/illustrations/nxdev-light.webp"
            alt="light"
            aria-hidden="true"
            className="block dark:hidden"
          />
          <img
            src="/images/illustrations/nxdev-dark.webp"
            alt="dark"
            aria-hidden="true"
            className="hidden dark:block"
          />
          <div className="relative" aria-hidden="true">
            <div className="absolute -inset-x-20 bottom-0 bg-gradient-to-t from-white pt-[7%] dark:from-slate-900"></div>
          </div>
        </div>
      </div>
    </header>
  );
}
