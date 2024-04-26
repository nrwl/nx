import Image from 'next/image';
export interface BlogAuthorsProps {
  authors: string[];
}

export function BlogAuthors({ authors }: BlogAuthorsProps) {
  return (
    <div className="center inline-flex items-center">
      {authors.map((author, index) => (
        <div
          key={index}
          className="relative flex items-center gap-2"
          style={{
            marginLeft: index > 0 ? '-0.8rem' : undefined,
          }}
        >
          <div className="relative h-8 w-8 overflow-hidden rounded-full grayscale">
            <Image
              alt={author}
              title={author}
              loading="lazy"
              width="48"
              height="48"
              decoding="async"
              src={`/documentation/blog/images/authors/${author}.jpeg`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
