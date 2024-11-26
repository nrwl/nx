import { LinkIcon } from '@heroicons/react/24/solid';
import { slugify } from '../slugify.utils';
import Link from 'next/link';

export const Heading1 = ({ title }: { title: string }) => (
  <h1
    id={slugify(title)}
    className="group mb-5 text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100"
  >
    <span>{title}</span>
    <Link aria-hidden="true" tabIndex={-1} href={'#' + slugify(title)}>
      <LinkIcon
        role="img"
        className="mb-1 ml-2 inline h-5 w-5 opacity-0 group-hover:opacity-100"
      />
    </Link>
  </h1>
);

export const Heading2 = ({ title }: { title: string }) => (
  <h2
    id={slugify(title)}
    className="group mb-5 text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-200"
  >
    <span>{title}</span>
    <Link aria-hidden="true" tabIndex={-1} href={'#' + slugify(title)}>
      <LinkIcon
        role="img"
        className="mb-1 ml-2 inline h-5 w-5 opacity-0 group-hover:opacity-100"
      />
    </Link>
  </h2>
);

export const Heading3 = ({ title }: { title: string }) => (
  <h3
    id={slugify(title)}
    className="group text-xl font-semibold tracking-tight text-slate-700 dark:text-slate-300"
  >
    <span>{title}</span>
    <Link aria-hidden="true" tabIndex={-1} href={'#' + slugify(title)}>
      <LinkIcon
        role="img"
        className="mb-1 ml-2 inline h-5 w-5 opacity-0 group-hover:opacity-100"
      />
    </Link>
  </h3>
);
