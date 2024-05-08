import { ClipboardIcon } from '@heroicons/react/24/outline';
import { JSX, useEffect, useState } from 'react';

interface CopyToClipboardProps {
  onCopy: () => void;
  tooltipAlignment?: 'left' | 'right';
}

export function CopyToClipboard(props: CopyToClipboardProps): JSX.Element {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (copied) {
      const timeout = setTimeout(() => {
        setCopied(false);
      }, 3000);
      return () => clearTimeout(timeout);
    }
  });
  return (
    <span
      data-tooltip="Copy to clipboard"
      data-tooltip-align-right={props.tooltipAlignment === 'right'}
    >
      <ClipboardIcon
        className={`inline h-4 w-5 !cursor-pointer ${
          copied ? 'text-sky-500' : ''
        }`}
        onClick={(e) => {
          e.stopPropagation();
          setCopied(true);
          props.onCopy();
        }}
      ></ClipboardIcon>
    </span>
  );
}
