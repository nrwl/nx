import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

export function ExternalLink({ text, href }: { text: string; href: string }) {
  return (
    <a
      href={href}
      className="text-slate-500 dark:text-slate-300 hover:underline inline-flex items-center gap-2"
      target="_blank"
    >
      {text} <ArrowTopRightOnSquareIcon className="w-4 h-4 inline" />
    </a>
  );
}
