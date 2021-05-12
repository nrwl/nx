import React, { useEffect, useState } from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { CopyToClipboard } from 'react-copy-to-clipboard';

export function CodeBlock({
  text,
  language,
  ...rest
}: {
  text: string;
  language: string;
  [key: string]: any;
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
    <div className="relative group">
      <CopyToClipboard text={text} onCopy={() => setCopied(true)}>
        <button className="flex absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
        showLineNumbers={language !== 'bash' && language !== 'treeview'}
        useInlineStyles={false}
        language={language}
        children={text}
        style=""
        {...rest}
      />
    </div>
  );
}
