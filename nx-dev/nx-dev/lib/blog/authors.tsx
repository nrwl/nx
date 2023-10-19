export interface BlogAuthorsProps {
  authors: string[];
}

export function BlogAuthors({ authors }: BlogAuthorsProps) {
  return (
    <div className="flex center items-center gap-10 text-sm text-gray-700 dark:text-gray-300">
      <div className="flex ">
        {authors.map((author, index) => (
          <div
            className="flex items-center relative gap-2"
            key={index}
            style={{
              // zIndex: index + 10,
              marginLeft: index > 0 ? '-0.8rem' : undefined,
            }}
          >
            <div className="w-8 h-8 overflow-hidden rounded-full relative">
              <img
                alt={author}
                loading="lazy"
                width="54"
                height="54"
                decoding="async"
                src={`/documentation/blog/images/authors/${author}.jpeg`}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="truncate pl-2">
        {authors.slice(0, 2).join(', ')}
        {authors.length > 2 && `, +${authors.length - 2} more`}
      </div>
    </div>
  );
}
