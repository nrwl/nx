import {
  ClipboardDocumentCheckIcon,
  ClipboardDocumentIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import React, { ReactNode, useEffect, useState } from 'react';
// @ts-ignore
import { CopyToClipboard } from 'react-copy-to-clipboard';
// @ts-ignore
import SyntaxHighlighter from 'react-syntax-highlighter';
import { CodeOutput } from './fences/code-output.component';
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
  isMessageBelow: boolean;
}): ({ children }: { children: ReactNode }) => JSX.Element {
  return ({ children }: { children: ReactNode }) =>
    options.command ? (
      <TerminalOutput
        content={children}
        command={options.command}
        path={options.path}
        isMessageBelow={options.isMessageBelow}
      />
    ) : (
      <CodeOutput
        content={children}
        fileName={options.fileName}
        isMessageBelow={options.isMessageBelow}
      />
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
  const showRescopeMessage =
    children.includes('@nx/') || command.includes('@nx/');
  return (
    <div className="my-8 w-full">
      <div className="code-block group relative w-full">
        <div>
          <CopyToClipboard
            text={command && command !== '' ? command : children}
            onCopy={() => {
              setCopied(true);
            }}
          >
            <button
              type="button"
              className="not-prose absolute top-0 right-0 z-10 flex rounded-tr-lg border border-slate-200 bg-slate-50/50 p-2 opacity-0 transition-opacity group-hover:opacity-100 dark:border-slate-700 dark:bg-slate-800/60"
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
            PreTag={CodeWrapper({
              fileName,
              command,
              path,
              isMessageBelow: showRescopeMessage,
            })}
          />
          {showRescopeMessage && (
            <a
              className="relative block rounded-b-md border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium no-underline hover:underline dark:border-slate-700 dark:bg-slate-800"
              href="/recipes/other/rescope"
              title="Nx 16 package name changes"
            >
              <InformationCircleIcon
                className="mr-2 inline-block h-5 w-5"
                aria-hidden="true"
              />
              Nx 15 and lower use @nrwl/ instead of @nx/
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
