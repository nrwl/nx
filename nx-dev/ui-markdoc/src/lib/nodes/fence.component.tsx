import { ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import React, { ReactNode, useEffect, useState } from 'react';
// @ts-ignore
import { CopyToClipboard } from 'react-copy-to-clipboard';
// @ts-ignore
import SyntaxHighlighter from 'react-syntax-highlighter';
import { CodeOutput } from './fences/codeOutput.component';
import { TerminalOutput } from './fences/terminal-output.component';

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

function CodeWrapper(options: {
  fileName: string;
  command: string;
}): ({ children }: { children: ReactNode }) => JSX.Element {
  return ({ children }: { children: ReactNode }) =>
    options.command ? (
      <TerminalOutput content={children} command={options.command} />
    ) : (
      <CodeOutput content={children} fileName={options.fileName} />
    );
}

export function Fence({
  children,
  command,
  fileName,
  language,
}: {
  children: string;
  command: string;
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
            className="not-prose absolute top-7 right-2 z-10 flex opacity-0 transition-opacity group-hover:opacity-100"
          >
            <ClipboardDocumentIcon className="h-4 w-4" />
            <span className="ml-1 text-xs">{copied ? 'Copied!' : 'Copy'}</span>
          </button>
        </CopyToClipboard>
        <SyntaxHighlighter
          useInlineStyles={false}
          language={resolveLanguage(language)}
          children={children}
          PreTag={CodeWrapper({ fileName, command })}
        />
      </div>
    </div>
  );
}
