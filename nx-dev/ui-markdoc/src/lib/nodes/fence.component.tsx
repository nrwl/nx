import {
  ClipboardDocumentCheckIcon,
  ClipboardDocumentIcon,
  InformationCircleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import React, { ReactNode, useEffect, useState } from 'react';
// @ts-ignore
import { CopyToClipboard } from 'react-copy-to-clipboard';
// @ts-ignore
import SyntaxHighlighter from 'react-syntax-highlighter';
import { CodeOutput } from './fences/code-output.component';
import { TerminalOutput } from './fences/terminal-output.component';
import { useRouter } from 'next/router';
import { Selector } from '@nx/nx-dev/ui-common';

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
  language: string;
  children: string; // intentionally typed as such
}): ({ children }: { children: ReactNode }) => JSX.Element {
  return ({ children }: { children: ReactNode }) =>
    options.language === 'shell' ? (
      <TerminalOutput
        command={options.children}
        path=""
        content={null}
        isMessageBelow={options.isMessageBelow}
      />
    ) : options.command ? (
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

const useUrlHash = (initialValue: string) => {
  const router = useRouter();
  const [hash, setHash] = useState(initialValue);

  const updateHash = (str: string) => {
    if (!str) return;
    setHash(str.split('#')[1]);
  };

  useEffect(() => {
    const onWindowHashChange = () => updateHash(window.location.hash);
    const onNextJSHashChange = (url: string) => updateHash(url);

    router.events.on('hashChangeStart', onNextJSHashChange);
    window.addEventListener('hashchange', onWindowHashChange);
    window.addEventListener('load', onWindowHashChange);
    return () => {
      router.events.off('hashChangeStart', onNextJSHashChange);
      window.removeEventListener('load', onWindowHashChange);
      window.removeEventListener('hashchange', onWindowHashChange);
    };
  }, [router.asPath, router.events]);

  return hash;
};

export function Fence({
  children,
  command,
  path,
  fileName,
  lineGroups,
  highlightLines,
  language,
  enableCopy,
}: {
  children: string;
  command: string;
  path: string;
  fileName: string;
  highlightLines: number[];
  lineGroups: Record<string, number[]>;
  language: string;
  enableCopy: boolean;
}) {
  const { push, asPath } = useRouter();
  const hash = decodeURIComponent(useUrlHash(''));

  function lineNumberStyle(lineNumber: number) {
    if (
      (highlightLines && highlightLines.includes(lineNumber)) ||
      (lineGroups[hash] && lineGroups[hash].includes(lineNumber))
    ) {
      return {
        fontSize: 0,
        display: 'inline-block',
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: -1,
        borderLeftStyle: 'solid',
        borderLeftWidth: 10,
        lineHeight: '21px',
      };
    }
    return {
      fontSize: 0,
      position: 'absolute',
    };
  }
  const highlightOptions = Object.keys(lineGroups).map((lineNumberKey) => ({
    label: lineNumberKey,
    value: lineNumberKey,
  }));
  if (highlightOptions.length > 0) {
    highlightOptions.unshift({
      label: 'No highlighting',
      value: '',
    });
  }
  let selectedOption =
    highlightOptions.find((option) => option.value === hash) ||
    highlightOptions[0];
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
  function highlightChange(item: { label: string; value: string }) {
    push(asPath.split('#')[0] + '#' + item.value);
  }
  return (
    <div className="my-8 w-full">
      <div className="code-block group relative w-full">
        <div>
          <div className="absolute top-0 right-0 z-10 flex">
            {enableCopy && enableCopy === true && (
              <CopyToClipboard
                text={command && command !== '' ? command : children}
                onCopy={() => {
                  setCopied(true);
                }}
              >
                <button
                  type="button"
                  className={
                    'opacity-0 transition-opacity group-hover:opacity-100 not-prose flex border border-slate-200 bg-slate-50/50 p-2 dark:border-slate-700 dark:bg-slate-800/60' +
                    (highlightOptions && highlightOptions[0]
                      ? ''
                      : ' rounded-tr-lg')
                  }
                >
                  {copied ? (
                    <ClipboardDocumentCheckIcon className="h-5 w-5 text-blue-500 dark:text-sky-500" />
                  ) : (
                    <ClipboardDocumentIcon className="h-5 w-5" />
                  )}
                </button>
              </CopyToClipboard>
            )}
            {highlightOptions && highlightOptions[0] && (
              <Selector
                className="rounded-tr-lg"
                items={highlightOptions}
                selected={selectedOption}
                onChange={highlightChange}
              >
                <SparklesIcon className="h-5 w-5 mr-1"></SparklesIcon>
              </Selector>
            )}
          </div>
          <SyntaxHighlighter
            useInlineStyles={false}
            showLineNumbers={true}
            lineNumberStyle={lineNumberStyle}
            language={resolveLanguage(language)}
            children={children}
            PreTag={CodeWrapper({
              fileName,
              command,
              path,
              isMessageBelow: showRescopeMessage,
              language,
              children,
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
