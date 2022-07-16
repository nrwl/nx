import { ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import React, { useEffect, useState } from 'react';
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
function CodeWrapper({ children }: any) {
  return (
    <div className="hljs not-prose my-4 w-full overflow-x-scroll rounded-lg border border-slate-100 bg-slate-50/20 p-4 font-mono text-sm dark:border-slate-700 dark:bg-slate-800/60">
      {children}
    </div>
  );
}

export function Fence({
  children,
  language,
}: {
  children: string;
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
    <div className="code-block group relative inline-flex w-auto min-w-[50%] max-w-full">
      <CopyToClipboard
        text={children}
        onCopy={() => {
          setCopied(true);
        }}
      >
        <button
          type="button"
          className="not-prose absolute top-5 right-2 flex opacity-0 transition-opacity group-hover:opacity-100"
        >
          <ClipboardDocumentIcon className="h-4 w-4" />
          <span className="ml-1 text-xs">{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </CopyToClipboard>
      <SyntaxHighlighter
        useInlineStyles={false}
        language={resolveLanguage(language)}
        children={children}
        PreTag={CodeWrapper}
      />
    </div>
  );
}
