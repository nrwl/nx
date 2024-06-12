import Image from 'next/image';
import AuthorDetail from './author-detail';
import type { BlogAuthor } from '@nx/nx-dev/data-access-documents/node-only';

export function BlogAuthors({
  authors,
  showAuthorDetails = true,
}: {
  authors: BlogAuthor[];
  showAuthorDetails?: boolean;
}): JSX.Element {
  return (
    <div className="relative isolate flex items-center -space-x-2">
      {authors.map((author, index) => (
        <div key={index} className="group">
          <Image
            alt={author.name}
            title={author.name}
            loading="lazy"
            width="48"
            height="48"
            decoding="async"
            src={`/documentation/blog/images/authors/${author.name}.jpeg`}
            className="relative inline-block h-6 w-6 rounded-full ring-1 ring-white grayscale dark:ring-slate-900"
          />
          {showAuthorDetails && <AuthorDetail author={author} />}
        </div>
      ))}
    </div>
  );
}
