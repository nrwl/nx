import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { twMerge } from 'tailwind-merge';

export function ExternalLink({
  children,
  href,
  title,
  className,
}: {
  children?: React.ReactNode;
  href: string;
  className?: string;
  title?: string;
}) {
  return (
    <a
      href={href}
      title={title}
      className={twMerge(
        'gap-2 text-slate-500 hover:underline dark:text-slate-400',
        className
      )}
      target="_blank"
      rel="noreferrer"
    >
      {children} <ArrowTopRightOnSquareIcon className="inline h-4 w-4" />
    </a>
  );
}
