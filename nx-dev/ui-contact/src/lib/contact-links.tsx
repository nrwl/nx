import {
  AcademicCapIcon,
  BuildingOffice2Icon,
  EnvelopeIcon,
} from '@heroicons/react/24/solid';
import {
  ArrowUpRightIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';

export function ContactLinks(): JSX.Element {
  return (
    <article id="contact-links" className="mx-auto max-w-7xl px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
        <div>
          <div className="flex items-center gap-2">
            <svg
              aria-hidden="true"
              fill="currentColor"
              className="h-4 w-4"
              role="img"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <title>GitHub</title>
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
            </svg>
            <h4 className="text-lg font-medium text-slate-700 dark:text-slate-300">
              Contribute on GitHub
            </h4>
          </div>
          <p className="mt-2">
            File a bug report, check releases or contribute to the OSS products.
          </p>
          <a
            href="https://github.com/nrwl/nx"
            rel="noreferrer"
            target="_blank"
            title="Nx GitHub"
            className="mt-2 flex items-center gap-2 text-sm text-slate-500 transition hover:text-slate-800 dark:hover:text-slate-400"
          >
            <span>Contribute on GitHub</span>
            <ArrowUpRightIcon aria-hidden="true" className="h-3 w-3" />
          </a>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <svg
              aria-hidden="true"
              fill="currentColor"
              className="h-4 w-4"
              role="img"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <title>YouTube</title>
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
            <h4 className="text-lg font-medium text-slate-700 dark:text-slate-300">
              Livestreams on Youtube
            </h4>
          </div>
          <p className="mt-2">
            Get access to live Q&A sessions, podcasts and tutorials.
          </p>
          <a
            href="https://www.youtube.com/@NxDevtools/videos?utm_source=nx.dev"
            rel="noreferrer"
            target="_blank"
            title="Nx Youtube channel"
            className="mt-2 flex items-center gap-2 text-sm text-slate-500 transition hover:text-slate-800 dark:hover:text-slate-400"
          >
            <span>Join the Nx Youtube channel</span>
            <ArrowUpRightIcon aria-hidden="true" className="h-3 w-3" />
          </a>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <svg
              aria-hidden="true"
              fill="currentColor"
              className="h-4 w-4"
              role="img"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <title>X</title>
              <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
            </svg>
            <h4 className="text-lg font-medium text-slate-700 dark:text-slate-300">
              Follow us on X
            </h4>
          </div>
          <p className="mt-2">
            Stay up to date on everything about Nx like news, conferences,
            features, releases and more.
          </p>
          <a
            href="https://x.com/NxDevTools?utm_source=nx.dev"
            rel="noreferrer"
            target="_blank"
            title="Nx Official X account"
            className="mt-2 flex items-center gap-2 text-sm text-slate-500 transition hover:text-slate-800 dark:hover:text-slate-400"
          >
            <span>
              Follow <span className="font-medium">@nxdevtools</span>
            </span>
            <ArrowUpRightIcon aria-hidden="true" className="h-3 w-3" />
          </a>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <EnvelopeIcon aria-hidden="true" className="h-4 w-4" />
            <h4 className="text-lg font-medium text-slate-700 dark:text-slate-300">
              Nx monthly newsletter
            </h4>
          </div>
          <p className="mt-2">
            News about Nx releases, features, new plugins, resources straight to
            your inbox.
          </p>
          <a
            href="https://go.nx.dev/nx-newsletter?utm_source=nx.dev"
            rel="noreferrer"
            target="_blank"
            title="Nx monthly newsletter"
            className="mt-2 flex items-center gap-2 text-sm text-slate-500 transition hover:text-slate-800 dark:hover:text-slate-400"
          >
            <span>Subscribe to Nx newsletter</span>
            <ArrowUpRightIcon aria-hidden="true" className="h-3 w-3" />
          </a>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <AcademicCapIcon aria-hidden="true" className="h-4 w-4" />
            <h4 className="text-lg font-medium text-slate-700 dark:text-slate-300">
              Documentation
            </h4>
          </div>
          <p className="mt-2">
            Get an overview of Nx's features, integrations, and how to use them.
          </p>
          <Link
            href="/getting-started/intro"
            title="Nx documentation"
            className="mt-2 flex items-center gap-2 text-sm text-slate-500 transition hover:text-slate-800 dark:hover:text-slate-400"
            prefetch={false}
          >
            <span>Nx docs</span>
            <ChevronRightIcon aria-hidden="true" className="h-3 w-3" />
          </Link>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <BuildingOffice2Icon aria-hidden="true" className="h-4 w-4" />
            <h4 className="text-lg font-medium text-slate-700 dark:text-slate-300">
              Company
            </h4>
          </div>
          <p className="mt-2">
            Get to know the team behind Nx, Nx Cloud, Lerna and many other open
            source projects.
          </p>
          <a
            href="https://nx.app/company?utm_source=nx.dev"
            rel="noreferrer"
            target="_blank"
            title="Nx the company"
            className="mt-2 flex items-center gap-2 text-sm text-slate-500 transition hover:text-slate-800 dark:hover:text-slate-400"
          >
            <span>Nx the company</span>
            <ArrowUpRightIcon aria-hidden="true" className="h-3 w-3" />
          </a>
        </div>
      </div>
    </article>
  );
}
