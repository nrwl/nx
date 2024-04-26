import Image from 'next/image';
export interface BlogAuthorsProps {
  authors: string[];
}

export function BlogAuthors({ authors }: BlogAuthorsProps) {
  return (
    <div className="center items-center inline-flex">
      {authors.map((author, index) => (
        <div
          key={index}
          className="flex items-center relative gap-2"
          style={{
            marginLeft: index > 0 ? '-0.8rem' : undefined,
          }}
        >
          <div className="w-8 h-8 overflow-hidden rounded-full relative grayscale">
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
