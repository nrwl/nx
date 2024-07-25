import { SectionHeading } from '@nx/nx-dev/ui-common';
import {
  AwsIcon,
  CypressIcon,
  ElectronIcon,
  EpicWebIcon,
  GhostIcon,
  LernaIcon,
  MicrosoftIcon,
  MuiIcon,
  RedwoodJsIcon,
  RxJSIcon,
  SentryIcon,
  ShopifyIcon,
  StorybookIcon,
  StrapiIcon,
  TanstackIcon,
  TypescriptEslintIcon,
} from '@nx/nx-dev/ui-icons';

export function OssProjects(): JSX.Element {
  return (
    <section>
      <div className="mx-auto max-w-7xl text-center">
        <SectionHeading as="h2" variant="subtitle" id="popular-oss">
          Popular OSS projects using Nx
        </SectionHeading>

        <div className="mt-20">
          <dl className="grid grid-cols-2 justify-between sm:grid-cols-4">
            <a
              rel="noreferrer"
              href="https://github.com/tanstack"
              target="_blank"
              className="flex items-center justify-center border border-slate-200/20 p-12 transition hover:bg-slate-100/25 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <TanstackIcon aria-hidden="true" className="h-14 w-14" />
            </a>
            <a
              rel="noreferrer"
              href="https://redwoodjs.com/"
              target="_blank"
              className="flex cursor-pointer items-center justify-center border-y border-slate-200/20 p-12 transition hover:bg-slate-100/25 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <RedwoodJsIcon aria-hidden="true" className="h-12 w-12" />
            </a>
            <a
              href="https://github.com/epicweb-dev/epicshop"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border border-slate-200/20 p-12 transition hover:bg-slate-100/25 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <EpicWebIcon aria-hidden="true" className="h-12 w-12" />
            </a>
            <a
              rel="noreferrer"
              href="https://github.com/storybookjs/storybook"
              target="_blank"
              className="flex items-center justify-center border-y border-r border-slate-200/20 p-12 transition hover:bg-slate-100/25 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <StorybookIcon aria-hidden="true" className="h-12 w-12" />
            </a>
            <a
              rel="noreferrer"
              href="https://lerna.js.org"
              target="_blank"
              className="flex items-center justify-center border-x border-b border-slate-200/20 p-12 transition hover:bg-slate-100/25 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <LernaIcon aria-hidden="true" className="h-20 w-20" />
            </a>
            <a
              rel="noreferrer"
              href="https://github.com/ReactiveX/rxjs"
              target="_blank"
              className="flex items-center justify-center border-b border-slate-200/20 p-12 transition hover:bg-slate-100/25 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <RxJSIcon aria-hidden="true" className="h-12 w-12" />
            </a>
            <a
              rel="noreferrer"
              href="https://github.com/getsentry/sentry-javascript"
              target="_blank"
              className="flex items-center justify-center border-x border-b border-slate-200/20 p-12 transition hover:bg-slate-100/25 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <SentryIcon aria-hidden="true" className="h-16 w-16" />
            </a>
            <a
              rel="noreferrer"
              href="https://github.com/mui/material-ui"
              target="_blank"
              className="flex items-center justify-center border-b border-r border-slate-200/20 p-12 transition hover:bg-slate-100/25 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <MuiIcon aria-hidden="true" className="h-12 w-12" />
            </a>

            <a
              rel="noreferrer"
              href="https://github.com/aws-amplify/amplify-cli"
              target="_blank"
              className="flex items-center justify-center border-x border-b  border-slate-200/20 p-12 transition hover:bg-slate-100/25 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <AwsIcon aria-hidden="true" className="h-16 w-16" />
            </a>
            <a
              href="https://github.com/Shopify/cli"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-b border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <ShopifyIcon aria-hidden="true" className="h-12 w-12" />
            </a>
            <a
              href="https://github.com/electron/forge"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-x border-b border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <ElectronIcon aria-hidden="true" className="h-14 w-14" />
            </a>
            <a
              rel="noreferrer"
              href="https://github.com/strapi/strapi"
              target="_blank"
              className="flex items-center justify-center border-b border-r border-slate-200/20 p-12 transition hover:bg-slate-100/25 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <StrapiIcon aria-hidden="true" className="h-12 w-12" />
            </a>

            <a
              href="https://github.com/typescript-eslint/typescript-eslint"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-x border-b border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <TypescriptEslintIcon aria-hidden="true" className="h-14 w-14" />
            </a>
            <a
              href="https://github.com/cypress-io/cypress"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-b border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <CypressIcon aria-hidden="true" className="h-14 w-14" />
            </a>
            <a
              href="https://github.com/microsoft/fluentui"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-x border-b border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <MicrosoftIcon aria-hidden="true" className="h-12 w-12" />
            </a>
            <a
              href="https://github.com/TryGhost/Ghost"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-b border-r border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <GhostIcon aria-hidden="true" className="h-14 w-14" />
            </a>
          </dl>
        </div>
      </div>
    </section>
  );
}
