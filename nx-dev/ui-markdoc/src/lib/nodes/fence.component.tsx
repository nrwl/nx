import { ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import React, { ReactNode, useEffect, useState } from 'react';
// @ts-ignore
import { CopyToClipboard } from 'react-copy-to-clipboard';
// @ts-ignore
import SyntaxHighlighter from 'react-syntax-highlighter';

function resolveLanguage(lang: string) {
  switch (lang) {
    case 'ts':
      return 'typescript';
    case 'js':
      return 'javascript';
    default:
      return lang;
  }
}
function CodeWrapper(
  fileName: string
): ({ children }: { children: ReactNode }) => JSX.Element {
  return ({ children }: { children: ReactNode }) => (
    <div className="hljs not-prose my-4 w-full overflow-x-auto rounded-lg border border-slate-200 bg-slate-50/50 font-mono text-sm dark:border-slate-700 dark:bg-slate-800/60">
      {!!fileName && (
        <div className="flex border-b border-slate-100 bg-slate-50/60 px-4 py-2 italic text-slate-400 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-500">
          {fileName}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

export function Fence({
  children,
  fileName,
  language,
}: {
  children: string;
  fileName: string;
  language: string;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let t: NodeJS.Timeout;
    if (copied) {
      t = setTimeout(() => {
        setCopied(false);
      }, 3000);
    }
    return () => {
      t && clearTimeout(t);
    };
  }, [copied]);

  return (
    <div className="w-full">
      <div className="code-block group relative inline-flex w-auto min-w-[50%] max-w-full">
        <CopyToClipboard
          text={children}
          onCopy={() => {
            setCopied(true);
          }}
        >
          <button
            type="button"
            className="not-prose absolute top-7 right-2 flex opacity-0 transition-opacity group-hover:opacity-100"
          >
            <ClipboardDocumentIcon className="h-4 w-4" />
            <span className="ml-1 text-xs">{copied ? 'Copied!' : 'Copy'}</span>
          </button>
        </CopyToClipboard>
        <SyntaxHighlighter
          useInlineStyles={false}
          language={resolveLanguage(language)}
          children={children}
          PreTag={CodeWrapper(fileName)}
        />
      </div>
    </div>
  );
}
