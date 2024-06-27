import { sendCustomEvent } from '@nx/nx-dev/feature-analytics';

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

export function GitHubStarWidget({ starsCount }: { starsCount: number }) {
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
    <div className="flex items-center justify-between space-x-2 rounded-md border border-slate-200 pl-2 pr-2 hover:border-slate-400 dark:border-slate-700 print:hidden">
      <a
        href="https://github.com/nrwl/nx"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between space-x-2"
        onClick={() => handleClick('githubstars_iconclick')}
      >
        <GithubIcon className="h-6 w-6" />
        <span className="text-md font-semibold">{formatStars(starsCount)}</span>
      </a>
      <a
        href="https://github.com/nrwl/nx"
        target="_blank"
        rel="noreferrer noopener"
        className="whitespace-nowrap border-transparent px-4 py-2 font-bold hover:text-slate-900 dark:hover:text-sky-400"
        onClick={() => handleClick('githubstars_buttonclick')}
      >
        Give us a Star!
      </a>
    </div>
  );
}
