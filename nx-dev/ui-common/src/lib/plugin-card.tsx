import {
  ArrowDownTrayIcon,
  ClockIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';

export interface PluginCardProps {
  name: string;
  description: string;
  url: string;
  isOfficial: boolean;
  lastPublishedDate?: string;
  npmDownloads?: string;
  githubStars?: string;
  nxVersion?: string;
}

export function PluginCard({
  name,
  description,
  url,
  isOfficial,
  lastPublishedDate,
  npmDownloads,
  githubStars,
  nxVersion,
}: PluginCardProps): JSX.Element {
  return (
    <div className="focus-within:ring-focus-within:ring-blue-500 relative flex w-full rounded-lg border border border-slate-200 bg-white shadow-sm transition hover:bg-slate-50 dark:border-slate-900 dark:bg-slate-800/60 dark:focus-within:ring-sky-500 dark:hover:bg-slate-800">
      <div className="flex w-full flex-col px-4 py-3">
        <h3 className="mb-4 flex items-center font-semibold leading-tight">
          <svg
            className="mr-3 h-5 w-5"
            role="img"
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <title>GitHub</title>
            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
          </svg>{' '}
          <span className="truncate">{name}</span>
        </h3>
        <Link
          href={url}
          target={isOfficial ? undefined : '_blank'}
          rel={isOfficial ? undefined : 'noreferrer'}
          className="flex grow flex-col focus:outline-none"
          prefetch={false}
        >
          <span className="absolute inset-0" aria-hidden="true" />
          <p className="mb-2 line-clamp-3 grow text-sm">{description}</p>

          <div className="flex flex-wrap items-center justify-between py-0.5 text-xs font-medium capitalize">
            <div className="my-1 mr-1">
              <LastPublishedWidget
                lastPublishedDate={lastPublishedDate}
              ></LastPublishedWidget>
            </div>
            <div className="mx-1 my-1">
              <NpmDownloadsWidget
                npmDownloads={npmDownloads}
              ></NpmDownloadsWidget>
            </div>
            <div className="mx-1 my-1">
              <GithubStarsWidget githubStars={githubStars}></GithubStarsWidget>
            </div>
            <div className="flex flex-grow justify-end">
              {isOfficial ? (
                <div
                  data-tooltip="Maintained by the Nx Team"
                  data-tooltip-align-right
                  className="my-1 ml-1 inline-block rounded-full border border-green-300 bg-green-50 px-3 py-0.5 text-xs font-medium capitalize text-green-600 dark:border-green-900 dark:bg-green-900/30 dark:text-green-400"
                >
                  Nx Team
                </div>
              ) : (
                <div className="my-1 ml-1">
                  <NxVersionWidget nxVersion={nxVersion}></NxVersionWidget>
                </div>
              )}
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}

export function LastPublishedWidget({
  lastPublishedDate,
}: {
  lastPublishedDate: string | undefined;
}) {
  if (!lastPublishedDate) {
    return <div className="w-20"></div>;
  }
  return (
    <abbr data-tooltip="Most Recent Release Date" data-tooltip-align-right>
      <ClockIcon className="mx-0.5 inline-block h-4 w-4 align-bottom"></ClockIcon>
      {/* yyyy-MM-dd */}
      <span>{new Date(lastPublishedDate).toISOString().slice(0, 10)}</span>
      <span className="md:hidden">
        <br />
        <small>Most Recent Release Date</small>
      </span>
    </abbr>
  );
}

function NpmDownloadsWidget({
  npmDownloads,
}: {
  npmDownloads: string | undefined;
}) {
  if (!npmDownloads) {
    return <div className="w-8"></div>;
  }
  return (
    <abbr data-tooltip="Monthly NPM Downloads" data-tooltip-align-right>
      <ArrowDownTrayIcon className="mx-0.5 inline-block h-4 w-4 align-bottom"></ArrowDownTrayIcon>
      {shortenNumber(npmDownloads)}
      <span className="md:hidden">
        <br />
        <small>Monthly NPM Downloads</small>
      </span>
    </abbr>
  );
}

function GithubStarsWidget({
  githubStars,
}: {
  githubStars: string | undefined;
}) {
  if (!githubStars || githubStars == '-1') {
    return <div className="w-8"></div>;
  }
  return (
    <abbr data-tooltip="GitHub Stars" data-tooltip-align-right>
      <StarIcon className="mx-0.5 inline-block h-4 w-4 align-bottom"></StarIcon>
      {shortenNumber(githubStars)}
      <span className="md:hidden">
        <br />
        <small>GitHub Stars</small>
      </span>
    </abbr>
  );
}

function shortenNumber(number: string | number): string {
  const num = Number.parseInt(number + '');
  if (num > 1000000) {
    return Math.floor(num / 1000000) + 'M';
  }
  if (num > 1000) {
    return Math.floor(num / 1000) + 'k';
  }
  return num + '';
}

function NxVersionWidget({ nxVersion }: { nxVersion: string | undefined }) {
  if (!nxVersion) {
    return <div className="w-20"></div>;
  }
  return (
    <abbr data-tooltip="Supported Nx Versions" data-tooltip-align-right>
      {/* Nx Logo */}
      <svg
        role="img"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        className="mx-0.5 inline-block h-4 w-4 align-bottom"
        fill="currentColor"
      >
        <title>Nx</title>
        <path d="M11.987 14.138l-3.132 4.923-5.193-8.427-.012 8.822H0V4.544h3.691l5.247 8.833.005-3.998 3.044 4.759zm.601-5.761c.024-.048 0-3.784.008-3.833h-3.65c.002.059-.005 3.776-.003 3.833h3.645zm5.634 4.134a2.061 2.061 0 0 0-1.969 1.336 1.963 1.963 0 0 1 2.343-.739c.396.161.917.422 1.33.283a2.1 2.1 0 0 0-1.704-.88zm3.39 1.061c-.375-.13-.8-.277-1.109-.681-.06-.08-.116-.17-.176-.265a2.143 2.143 0 0 0-.533-.642c-.294-.216-.68-.322-1.18-.322a2.482 2.482 0 0 0-2.294 1.536 2.325 2.325 0 0 1 4.002.388.75.75 0 0 0 .836.334c.493-.105.46.36 1.203.518v-.133c-.003-.446-.246-.55-.75-.733zm2.024 1.266a.723.723 0 0 0 .347-.638c-.01-2.957-2.41-5.487-5.37-5.487a5.364 5.364 0 0 0-4.487 2.418c-.01-.026-1.522-2.39-1.538-2.418H8.943l3.463 5.423-3.379 5.32h3.54l1.54-2.366 1.568 2.366h3.541l-3.21-5.052a.7.7 0 0 1-.084-.32 2.69 2.69 0 0 1 2.69-2.691h.001c1.488 0 1.736.89 2.057 1.308.634.826 1.9.464 1.9 1.541a.707.707 0 0 0 1.066.596zm.35.133c-.173.372-.56.338-.755.639-.176.271.114.412.114.412s.337.156.538-.311c.104-.231.14-.488.103-.74z" />
      </svg>
      {nxVersion}
      <span className="md:hidden">
        <br />
        <small>Supported Nx Versions</small>
      </span>
    </abbr>
  );
}
