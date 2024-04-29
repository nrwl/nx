import Image from 'next/image';

export function BlogAuthors({ authors }: { authors: string[] }): JSX.Element {
  return (
    <div className="isolate flex items-center -space-x-2 overflow-hidden">
      {authors.map((author, index) => (
        <Image
          key={index}
          alt={author}
          title={author}
          loading="lazy"
          width="48"
          height="48"
          decoding="async"
          src={`/documentation/blog/images/authors/${author}.jpeg`}
          className="relative inline-block h-6 w-6 rounded-full ring-1 ring-white grayscale dark:ring-slate-900"
        />
      ))}
    </div>
  );
}
