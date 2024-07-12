import { SectionHeading } from '@nx/nx-dev/ui-common/src/lib/section-tags';
import {
  TanstackIcon,
  LernaIcon,
  EpicWebIcon,
  RedwoodJsIcon,
  StorybookIcon,
  RxJSIcon,
  SentryIcon,
  MuiIcon,
} from '@nx/nx-dev/ui-common';

export function OssProjects(): JSX.Element {
  return (
    <section>
      <div className="mx-auto max-w-7xl text-center">
        <SectionHeading as="h2" variant="subtitle">
          Popular OSS projects using Nx
        </SectionHeading>

        <div className="mt-20">
          <dl className="grid grid-cols-2 justify-between sm:grid-cols-4">
            <a
              rel="noreferrer"
              href="https://github.com/tanstack'"
              target="_blank"
              className="flex items-center justify-center border border-slate-200/20 p-12 transition hover:bg-slate-100/25 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10"
            >
              <TanstackIcon aria-hidden="true" className="h-14 w-14" />
            </a>
            <a
              rel="noreferrer"
              href="https://github.com/epicweb-dev/epicshop"
              target="_blank"
              className="flex cursor-pointer items-center justify-center border-y border-slate-200/20 p-12 transition hover:bg-slate-100/25 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10"
            >
              <EpicWebIcon aria-hidden="true" className="h-12 w-12" />
            </a>
            <a
              rel="noreferrer"
              href="https://redwoodjs.com/"
              target="_blank"
              className="flex items-center justify-center border border-slate-200/20 p-12 transition hover:bg-slate-100/25 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10"
            >
              <RedwoodJsIcon aria-hidden="true" className="h-12 w-12" />
            </a>
            <a
              rel="noreferrer"
              href="https://github.com/storybookjs/storybook"
              target="_blank"
              className="flex items-center justify-center border-y border-r border-slate-200/20 p-12 transition hover:bg-slate-100/25 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10"
            >
              <StorybookIcon aria-hidden="true" className="h-12 w-12" />
            </a>
            <a
              rel="noreferrer"
              href="https://lerna.js.org"
              target="_blank"
              className="flex items-center justify-center border-x border-b border-slate-200/20 p-12 transition hover:bg-slate-100/25 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10"
            >
              <LernaIcon aria-hidden="true" className="h-20 w-20" />
            </a>
            <a
              rel="noreferrer"
              href="https://github.com/ReactiveX/rxjs"
              target="_blank"
              className="flex items-center justify-center border-b border-slate-200/20 p-12 transition hover:bg-slate-100/25 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10"
            >
              {' '}
              <RxJSIcon aria-hidden="true" className="h-12 w-12" />
            </a>
            <a
              rel="noreferrer"
              href="https://github.com/getsentry/sentry-javascript"
              target="_blank"
              className="flex items-center justify-center border-x border-b border-slate-200/20 p-12 transition hover:bg-slate-100/25 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10"
            >
              <SentryIcon aria-hidden="true" className="h-16 w-16" />
            </a>
            <a
              rel="noreferrer"
              href="https://github.com/mui/material-ui"
              target="_blank"
              className="flex items-center justify-center border-b border-r border-slate-200/20 p-12 transition hover:bg-slate-100/25 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10"
            >
              <MuiIcon aria-hidden="true" className="h-12 w-12" />
            </a>
          </dl>
        </div>
      </div>
    </section>
  );
}
