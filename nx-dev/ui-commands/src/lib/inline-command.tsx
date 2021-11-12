import React, { useEffect, useState } from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { CopyToClipboard } from 'react-copy-to-clipboard';

/* eslint-disable-next-line */
export interface InlineCommandProps {
  language: string;
  command: string;
  callback?: (command: string) => void;
}

export function InlineCommand({
  language,
  command,
  callback,
}: InlineCommandProps) {
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
    <div className="relative w-full sm:w-auto">
      <CopyToClipboard
        text={command}
        onCopy={() => {
          setCopied(true);
          if (typeof callback === 'function') callback(command);
        }}
      >
        <button
          type="button"
          className="sm:max-w-full w-full text-sm flex-none bg-white text-gray-400 hover:text-gray-800 font-input-mono leading-6 py-1 sm:px-3 border border-gray-300 rounded-md flex items-center justify-center space-x-2 sm:space-x-4 focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-gray-300 focus:outline-none transition-colors duration-180"
        >
          <span className="overflow-auto flex items-center text-gray-800">
            <span className="hidden sm:inline text-gray-500" aria-hidden="true">
              $
            </span>
            <SyntaxHighlighter
              showLineNumbers={false}
              useInlineStyles={false}
              language={language}
              children={command}
            />
          </span>
          <svg width="24" height="24" fill="none" stroke="currentColor">
            <path d="M8 16c0 1.886 0 2.828.586 3.414C9.172 20 10.114 20 12 20h4c1.886 0 2.828 0 3.414-.586C20 18.828 20 17.886 20 16v-4c0-1.886 0-2.828-.586-3.414C18.828 8 17.886 8 16 8m-8 8h4c1.886 0 2.828 0 3.414-.586C16 14.828 16 13.886 16 12V8m-8 8c-1.886 0-2.828 0-3.414-.586C4 14.828 4 13.886 4 12V8c0-1.886 0-2.828.586-3.414C5.172 4 6.114 4 8 4h4c1.886 0 2.828 0 3.414.586C16 5.172 16 6.114 16 8" />
          </svg>
        </button>
      </CopyToClipboard>
    </div>
  );
}

export default InlineCommand;
