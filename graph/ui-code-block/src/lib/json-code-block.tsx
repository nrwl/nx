import {
  ClipboardDocumentCheckIcon,
  ClipboardDocumentIcon,
  InformationCircleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
// @ts-ignore
import { CopyToClipboard } from 'react-copy-to-clipboard';
// @ts-ignore
import SyntaxHighlighter from 'react-syntax-highlighter';
import { Children, JSX, ReactNode, useEffect, useState } from 'react';
import { twMerge } from 'tailwind-merge';

export function JsonCodeBlockPreTag({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  return (
    <div
      className={twMerge(
        'hljs not-prose w-full overflow-x-auto',
        'font-mono text-sm',
        'border border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/60'
      )}
    >
      <div className="p-4">{children}</div>
    </div>
  );
}

export function JsonCodeBlock(props: { children: ReactNode }): JSX.Element {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => {
      setCopied(false);
    }, 3000);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <div className="code-block group relative w-full">
      <div className="absolute top-0 right-0 z-10 flex">
        <CopyToClipboard
          text={props.children}
          onCopy={() => {
            setCopied(true);
          }}
        >
          <button
            type="button"
            className={twMerge(
              'not-prose flex',
              'border border-slate-200 bg-slate-50/50 p-2 dark:border-slate-700 dark:bg-slate-800/60',
              'opacity-0 transition-opacity group-hover:opacity-100'
            )}
          >
            {copied ? (
              <ClipboardDocumentCheckIcon className="h-5 w-5 text-blue-500 dark:text-sky-500" />
            ) : (
              <ClipboardDocumentIcon className="h-5 w-5" />
            )}
          </button>
        </CopyToClipboard>
      </div>
      <SyntaxHighlighter
        useInlineStyles={false}
        showLineNumbers={false}
        language="json"
        children={props.children}
        PreTag={JsonCodeBlockPreTag}
      />
    </div>
  );
}
