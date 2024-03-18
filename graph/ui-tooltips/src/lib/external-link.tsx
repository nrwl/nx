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
      className="inline-flex items-center gap-2 text-slate-500 hover:underline dark:text-slate-400"
      target="_blank"
    >
      {text} <ArrowTopRightOnSquareIcon className="inline h-4 w-4" />
    </a>
  );
}
