import {
  ClipboardDocumentCheckIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';
// @ts-ignore
import { CopyToClipboard } from 'react-copy-to-clipboard';
// @ts-ignore
import SyntaxHighlighter, { createElement } from 'react-syntax-highlighter';
import { JSX, ReactNode, useEffect, useMemo, useState } from 'react';
import { twMerge } from 'tailwind-merge';

export function JsonCodeBlockPreTag({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  return (
    <div
      className={twMerge(
        'hljs not-prose w-full overflow-hidden rounded-md',
        'font-mono text-sm',
        'border border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/60'
      )}
    >
      <div className="p-4">{children}</div>
    </div>
  );
}

export interface JsonCodeBlockProps {
  data: any;
  renderSource: (propertyName: string) => ReactNode;
}

export function JsonCodeBlock(props: JsonCodeBlockProps): JSX.Element {
  const [copied, setCopied] = useState(false);
  const jsonString = useMemo(
    () => JSON.stringify(props.data, null, 2),
    [props.data]
  );
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => {
      setCopied(false);
    }, 3000);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <div className="code-block group relative w-full">
      <div className="absolute right-0 top-0 z-10 flex">
        <CopyToClipboard
          text={jsonString}
          onCopy={() => {
            setCopied(true);
          }}
        >
          <button
            type="button"
            className={twMerge(
              'not-prose flex',
              'border border-slate-200 bg-slate-50/50 p-2 dark:border-slate-700 dark:bg-slate-800/60',
              'opacity-0 transition-opacity group-hover:opacity-100'
            )}
          >
            {copied ? (
              <ClipboardDocumentCheckIcon className="h-5 w-5 text-blue-500 dark:text-sky-500" />
            ) : (
              <ClipboardDocumentIcon className="h-5 w-5" />
            )}
          </button>
        </CopyToClipboard>
      </div>
      <SyntaxHighlighter
        language="json"
        children={jsonString}
        PreTag={JsonCodeBlockPreTag}
        renderer={sourcesRenderer(props.renderSource)}
      />
    </div>
  );
}

export function sourcesRenderer(
  renderSource: (propertyName: string) => ReactNode
) {
  return ({ rows, stylesheet }: any) => {
    return rows.map((node: any, idx: number) => {
      const element = createElement({
        node,
        stylesheet,
        useInlineStyles: false,
        key: `code-line-${idx}`,
      });
      let sourceElement: ReactNode;
      const attrNode = node.children.find(
        (c: any) =>
          c.type === 'element' && c.properties?.className?.includes('hljs-attr')
      );
      if (attrNode?.children?.length) {
        for (const child of attrNode.children) {
          sourceElement = renderSource(child.value); // e.g. command
          if (sourceElement) break;
        }
      }
      return (
        <span className="group/line flex" key={`code-group${idx}`}>
          <span>{element}</span>
          {sourceElement && (
            <span className="min-w-0 flex-1 pl-2 opacity-0 transition-opacity duration-150 ease-in-out group-hover/line:opacity-100">
              {sourceElement}
            </span>
          )}
        </span>
      );
    });
  };
}
