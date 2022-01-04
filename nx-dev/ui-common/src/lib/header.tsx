import cx from 'classnames';
import Link from 'next/link';
import { AlgoliaSearch } from '@nrwl/nx-dev/feature-search';

interface HeaderPropsWithoutFlavorAndVersion {
  showSearch: false;
  useDarkBackground?: boolean;
}

interface HeaderPropsWithFlavorAndVersion {
  showSearch: boolean;
  useDarkBackground?: boolean;
  flavor: { name: string; value: string };
  version: { name: string; value: string };
}

export type HeaderProps =
  | HeaderPropsWithFlavorAndVersion
  | HeaderPropsWithoutFlavorAndVersion;

export function Header(props: HeaderProps) {
  const showSearch = props.showSearch;
  const version =
    'version' in props ? props.version : { name: 'Latest', value: 'l' };
  const flavor =
    'flavor' in props ? props.flavor : { name: 'React', value: 'r' };
  return (
    <header
      className={cx(
        'h-16 px-5 py-5 flex items-center justify-between print:hidden',
        props.useDarkBackground ? 'bg-blue-nx-dark' : 'bg-blue-nx-base'
      )}
    >
      <div className="flex items-center justify-between w-full max-w-screen-xl mx-auto sm:space-x-10">
        {/*LOGO*/}
        <div className="flex items-center">
          <a href="/" className="flex items-center">
            <svg width="40" height="40" viewBox="0 0 262 163" className="mr-2">
              <polygon
                id="Path"
                fill="#ffffff"
                points="130.68 104.59 97.49 52.71 97.44 96.3 40.24 0 0 0 0 162.57 39.79 162.57 39.92 66.39 96.53 158.26"
              />
              <polygon
                id="Path"
                fill="#ffffff"
                points="97.5 41.79 137.24 41.79 137.33 41.33 137.33 0 97.54 0 97.49 41.33"
              />
              <path
                d="M198.66,86.86 C189.139872,86.6795216 180.538723,92.516445 177.19,101.43 C182.764789,93.0931021 193.379673,89.7432211 202.73,93.37 C207.05,95.13 212.73,97.97 217.23,96.45 C212.950306,90.4438814 206.034895,86.8725952 198.66,86.86 L198.66,86.86 Z"
                id="Path"
                fill="#96D8E9"
              />
              <path
                d="M243.75,106.42 C243.75,101.55 241.1,100.42 235.6,98.42 C231.52,97 226.89,95.4 223.52,91 C222.86,90.13 222.25,89.15 221.6,88.11 C220.14382,85.4164099 218.169266,83.037429 215.79,81.11 C212.58,78.75 208.37,77.6 202.91,77.6 C191.954261,77.6076705 182.084192,84.2206169 177.91,94.35 C183.186964,87.0278244 191.956716,83.0605026 200.940147,83.9314609 C209.923578,84.8024193 217.767888,90.3805017 221.54,98.58 C223.424615,101.689762 227.141337,103.174819 230.65,102.22 C236.02,101.07 235.65,106.15 243.76,107.87 L243.75,106.42 Z"
                id="Path"
                fill="#48C4E5"
              />
              <path
                d="M261.46,105.38 L261.46,105.27 C261.34,73.03 235.17,45.45 202.91,45.45 C183.207085,45.4363165 164.821777,55.3450614 154,71.81 L153.79,71.45 L137.23,45.45 L97.5,45.4499858 L135.25,104.57 L98.41,162.57 L137,162.57 L153.79,136.78 L170.88,162.57 L209.48,162.57 L174.48,107.49 C173.899005,106.416838 173.583536,105.220114 173.56,104 C173.557346,96.2203871 176.64661,88.7586448 182.147627,83.2576275 C187.648645,77.7566101 195.110387,74.6673462 202.89,74.67 C219.11,74.67 221.82,84.37 225.32,88.93 C232.23,97.93 246.03,93.99 246.03,105.73 L246.03,105.73 C246.071086,108.480945 247.576662,111.001004 249.979593,112.340896 C252.382524,113.680787 255.317747,113.636949 257.679593,112.225896 C260.041438,110.814842 261.471086,108.250945 261.43,105.5 L261.43,105.5 L261.43,105.38 L261.46,105.38 Z"
                id="Path"
                fill="#ffffff"
              />
              <path
                d="M261.5,113.68 C261.892278,116.421801 261.504116,119.218653 260.38,121.75 C258.18,126.84 254.51,125.14 254.51,125.14 C254.51,125.14 251.35,123.6 253.27,120.65 C255.4,117.36 259.61,117.74 261.5,113.68 Z"
                id="Path"
                fill="#022f56"
              />
            </svg>
          </a>
        </div>
        {/*SEARCH*/}
        <div className="inline">
          {!!showSearch ? (
            <AlgoliaSearch flavorId={flavor.value} versionId={version.value} />
          ) : null}
        </div>
        {/*NAVIGATION*/}
        <div className="text-sm flex-shrink-0">
          <nav className="flex items-justified justify-center space-x-1">
            <Link href="/getting-started/intro">
              <a className="font-bold px-3 py-2 text-white leading-tight">
                Docs
              </a>
            </Link>
            <Link href="/getting-started/nx-devkit">
              <a className="px-3 py-2 hidden md:inline-flex text-white leading-tight">
                Plugins
              </a>
            </Link>
            <Link href="/community">
              <a className="px-3 py-2 hidden md:inline-flex text-white leading-tight">
                Community
              </a>
            </Link>
            <Link href="/conf">
              <a className="px-3 py-2 hidden md:inline-flex text-white leading-tight">
                Nx Conf
              </a>
            </Link>

            <a
              href="https://nx.app/?utm_source=nx.dev"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 text-white lg:inline-flex leading-tight group relative"
            >
              Nx Cloud
            </a>
            <a
              href="https://nrwl.io/services/?utm_source=nx.dev"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 text-white hidden lg:inline-flex leading-tight"
            >
              Nx Consulting
            </a>
            <a
              href="https://github.com/nrwl/nx"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 text-white"
            >
              <span className="sr-only">Nx on Github</span>
              <svg
                width="20"
                height="20"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
                />
              </svg>
            </a>
          </nav>
        </div>
      </div>
    </header>
  );
}

export default Header;
