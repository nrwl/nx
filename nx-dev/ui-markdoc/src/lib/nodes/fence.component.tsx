import React, { useEffect, useState } from 'react';
// @ts-ignore
import { CopyToClipboard } from 'react-copy-to-clipboard';
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
    <div className="code-block group relative">
      <CopyToClipboard
        text={children}
        onCopy={() => {
          setCopied(true);
        }}
      >
        <button
          type="button"
          className="absolute top-2 right-2 flex opacity-0 transition-opacity group-hover:opacity-100"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          <span className="ml-1 text-sm">{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </CopyToClipboard>
      <SyntaxHighlighter
        showLineNumbers={!['bash', 'text', 'treeview'].includes(language)}
        useInlineStyles={false}
        language={resolveLanguage(language)}
        children={children}
      />
    </div>
  );
}
