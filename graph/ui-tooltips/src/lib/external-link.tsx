import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

export function ExternalLink({
  children,
  href,
  title,
}: {
  children?: React.ReactNode;
  href: string;
  title?: string;
}) {
  return (
    <a
      href={href}
      title={title}
      className="gap-2 text-slate-500 hover:underline dark:text-slate-400"
      target="_blank"
      rel="noreferrer"
    >
      {children} <ArrowTopRightOnSquareIcon className="inline h-4 w-4" />
    </a>
  );
}
