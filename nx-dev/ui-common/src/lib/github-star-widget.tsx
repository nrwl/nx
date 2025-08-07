import { sendCustomEvent } from '@nx/nx-dev-feature-analytics';
import type { ReactElement } from 'react';

export const GithubIcon = (props: any) => {
  return (
    <svg
      fill="currentColor"
      role="img"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      {...props}
    >
      {/*<title>GitHub</title>*/}
      <path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38l-.01-1.49c-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48l-.01 2.2c0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8a8 8 0 0 0-8-8z" />
    </svg>
  );
};

export function GitHubStarWidget({
  starsCount,
}: {
  starsCount: number;
}): ReactElement {
  const formatStars = (count: number) => {
    if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'k';
    } else {
      return count;
    }
  };

  const handleClick = (eventAction: string) => {
    sendCustomEvent(
      eventAction,
      'githubstars-toc-sidebar',
      'githubstarswidget'
    );
  };

  return (
    <div className="relative flex items-center justify-center gap-2 rounded-md bg-slate-950 p-2 text-xs text-white transition hover:bg-slate-900 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white print:hidden">
      <div className="flex items-center gap-2">
        <GithubIcon aria-hidden="true" className="h-4 w-4" />
        <span className="font-semibold">{formatStars(starsCount)}</span>
      </div>
      <a
        href="https://github.com/nrwl/nx"
        target="_blank"
        rel="noreferrer noopener"
        className="flex items-center gap-2 border-transparent font-bold"
        onClick={() => handleClick('githubstars_buttonclick')}
      >
        <span className="absolute inset-0" />
        <span className="whitespace-nowrap">Give us a Star!</span>
      </a>
    </div>
  );
}
