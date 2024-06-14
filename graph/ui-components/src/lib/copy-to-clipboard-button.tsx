// @ts-ignore
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { JSX, ReactNode, useEffect, useState } from 'react';
import {
  ClipboardDocumentCheckIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';

export interface CopyToClipboardButtonProps {
  text: string;
  tooltipText?: string;
  tooltipAlignment?: 'left' | 'right';
  className?: string;
  children?: ReactNode;
}

export function CopyToClipboardButton({
  text,
  tooltipAlignment,
  tooltipText,
  className,
  children,
}: CopyToClipboardButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => {
      setCopied(false);
    }, 3000);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <CopyToClipboard
      text={text}
      onCopy={() => {
        setCopied(true);
      }}
    >
      <button
        type="button"
        data-tooltip={tooltipText ? tooltipText : false}
        data-tooltip-align-right={tooltipAlignment === 'right'}
        data-tooltip-align-left={tooltipAlignment === 'left'}
        className={className}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {copied ? (
          <ClipboardDocumentCheckIcon className="inline h-5 w-5 text-blue-500 dark:text-sky-500" />
        ) : (
          <ClipboardDocumentIcon className="inline h-5 w-5" />
        )}
        {children}
      </button>
    </CopyToClipboard>
  );
}
