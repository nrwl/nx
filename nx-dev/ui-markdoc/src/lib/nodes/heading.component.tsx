import { LinkIcon } from '@heroicons/react/outline';
import { ReactNode } from 'react';

export function Heading({
  id = '',
  level = 1,
  children,
  className,
}: {
  id: string;
  level: number;
  children: ReactNode;
  className: string;
}) {
  const Component: any = `h${level}`;

  return (
    <Component
      id={id}
      className={['not-prose group', className].filter(Boolean).join(' ')}
    >
      {children}
      <a aria-hidden="true" href={`#${id}`}>
        <LinkIcon className="ml-2 mb-1 inline h-5 w-5 opacity-0 group-hover:opacity-100" />
      </a>
    </Component>
  );
}
