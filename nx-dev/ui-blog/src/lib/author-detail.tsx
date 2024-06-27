import type { BlogAuthor } from '@nx/nx-dev/data-access-documents/node-only';
import { GithubIcon, TwitterIcon } from '@nx/nx-dev/ui-common';
import Image from 'next/image';

interface AuthorDetailProps {
  author: BlogAuthor;
}

export default function AuthorDetail({ author }: AuthorDetailProps) {
  return (
    <div className="space-between invisible absolute left-[65%] right-0 z-30 mt-2 flex w-60 translate-x-[-50%] items-center gap-4 rounded bg-slate-50 p-4 text-sm text-slate-700 opacity-0 shadow-lg ring-1 ring-slate-200 transition-all delay-75 duration-300 ease-in-out md:group-hover:visible md:group-hover:opacity-100 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-800">
      <span>
        <Image
          alt={author.name}
          title={author.name}
          loading="lazy"
          width="40"
          height="40"
          decoding="async"
          src={`/documentation/blog/images/authors/${author.name}.jpeg`}
          className="rounded-full ring-1 ring-white grayscale dark:ring-slate-900"
        />
      </span>
      <span className="text-balance">{author.name}</span>
      <a
        href={`https://twitter.com/${author.twitter}`}
        target="_blank"
        aria-label={`Follow ${author.name} on X`}
      >
        <TwitterIcon aria-hidden="true" className="h-5 w-5" />
      </a>
      <a
        href={`https://github.com/${author.github}`}
        target="_blank"
        aria-label={`View ${author.name}'s GitHub profile`}
      >
        <GithubIcon aria-hidden="true" className="h-5 w-5" />
      </a>
    </div>
  );
}
