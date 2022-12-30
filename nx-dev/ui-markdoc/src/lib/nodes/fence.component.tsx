import {
  ClipboardDocumentCheckIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';
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
  path: string;
}): ({ children }: { children: ReactNode }) => JSX.Element {
  return ({ children }: { children: ReactNode }) =>
    options.command ? (
      <TerminalOutput
        content={children}
        command={options.command}
        path={options.path}
      />
    ) : (
      <CodeOutput content={children} fileName={options.fileName} />
    );
}

export function Fence({
  children,
  command,
  path,
  fileName,
  language,
}: {
  children: string;
  command: string;
  path: string;
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
    <div className="my-8 w-full">
      <div className="code-block group relative inline-flex w-auto min-w-[50%] max-w-full">
        <CopyToClipboard
          text={children}
          onCopy={() => {
            setCopied(true);
          }}
        >
          <button
            type="button"
            className="not-prose absolute top-0 right-0 z-10 flex rounded-tr-lg border border-slate-200 bg-slate-50/50 p-2 opacity-0 transition-opacity group-hover:opacity-100 dark:border-slate-700 dark:bg-slate-800"
          >
            {copied ? (
              <ClipboardDocumentCheckIcon className="h-5 w-5 text-blue-500 dark:text-sky-500" />
            ) : (
              <ClipboardDocumentIcon className="h-5 w-5" />
            )}
          </button>
        </CopyToClipboard>
        <SyntaxHighlighter
          useInlineStyles={false}
          language={resolveLanguage(language)}
          children={children}
          PreTag={CodeWrapper({ fileName, command, path })}
        />
      </div>
    </div>
  );
}
