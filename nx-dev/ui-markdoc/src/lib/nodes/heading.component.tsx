import { LinkIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
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
      <Link aria-hidden="true" href={`#${id}`}>
        <LinkIcon className="mb-1 ml-2 inline h-5 w-5 opacity-0 group-hover:opacity-100" />
      </Link>
    </Component>
  );
}
