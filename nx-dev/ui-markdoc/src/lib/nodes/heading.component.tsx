import { LinkIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { ReactNode } from 'react';

export function Heading({
  id = '',
  level = 1,
  children,
  className,
  highlightColor,
}: {
  id: string;
  level: number;
  children: ReactNode;
  className: string;
  highlightColor?: 'green' | 'blue' | 'yellow' | 'red';
}) {
  const Component: any = `h${level}`;

  return (
    <Component
      id={id}
      className={[
        'group',
        highlightColor && 'xl:-ml-5 xl:border-l-4 xl:pl-4',
        highlightColor === 'blue' && 'xl:border-blue-500',
        highlightColor === 'green' && 'xl:border-green-500',
        highlightColor === 'yellow' && 'xl:border-yellow-500',
        highlightColor === 'red' && 'xl:border-red-500',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
      <Link aria-hidden="true" href={`#${id}`}>
        <LinkIcon className="mb-1 ml-2 inline h-5 w-5 opacity-0 group-hover:opacity-100" />
      </Link>
    </Component>
  );
}
