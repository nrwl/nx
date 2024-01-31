import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

export function ExternalLink({
  text,
  href,
  title,
}: {
  text: string;
  href: string;
  title?: string;
}) {
  return (
    <a
      href={href}
      title={title}
      className="text-slate-500 dark:text-slate-400 hover:underline inline-flex items-center gap-2"
      target="_blank"
    >
      {text} <ArrowTopRightOnSquareIcon className="w-4 h-4 inline" />
    </a>
  );
}
