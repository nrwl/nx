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
        'hljs not-prose w-full overflow-x-auto',
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
  sourceMap: Record<string, Array<string>>;
  renderSource?: (source: Array<string>) => ReactNode;
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
      <div className="absolute top-0 right-0 z-10 flex">
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
        renderer={sourcesRenderer(props.sourceMap, props.renderSource)}
      />
    </div>
  );
}

export function sourcesRenderer(
  sourceMap: Record<string, Array<string>>,
  renderSource?: (source: Array<string>) => ReactNode
) {
  const sourceMapKeys = Object.keys(sourceMap);
  const rootSource = sourceMap['.'];
  return ({ rows, stylesheet }: any) => {
    return rows.map((node: any, idx: number) => {
      const element = createElement({
        node,
        stylesheet,
        useInlineStyles: true,
        key: `code-line-${idx}`,
      });
      let sourceInfo: null | Array<string> = null;
      const attrNode = node.children.find(
        (c: any) =>
          c.type === 'element' && c.properties?.className?.includes('hljs-attr')
      );
      if (attrNode?.children?.length) {
        // Match a key in source map to the attribute value, otherwise fallback to the root source if it exists.
        for (const sourceMapKey of sourceMapKeys) {
          if (
            attrNode.children?.some((c: any) => c.value === `"${sourceMapKey}"`)
          ) {
            sourceInfo = sourceMap[sourceMapKey];
            break;
          } else if (rootSource) {
            sourceInfo = rootSource;
            break;
          }
        }
      }
      return sourceInfo ? (
        <span className="flex group/line" key={`code-group${idx}`}>
          <span>{element}</span>
          <span className="hidden group-hover/line:inline pl-6">
            {renderSource
              ? renderSource(sourceInfo)
              : sourceInfo && (
                  <span className="text-slate-500 dark:text-slate-100">
                    {sourceInfo[0]} - {sourceInfo[1]}
                  </span>
                )}
          </span>
        </span>
      ) : (
        element
      );
    });
  };
}

export function filterSourceMap(
  filter: string,
  sourceMap: Record<string, Array<string>>
): Record<string, Array<string>> {
  const filtered: Record<string, Array<string>> = {};
  let rootKey: string | undefined;
  let rootSource: Array<string> | undefined;
  for (const [key, value] of Object.entries(sourceMap)) {
    const match = key.match(new RegExp(`^${filter}\\.(.*)`));
    if (match) {
      filtered[match[1]] = value;
    } else if (filter.startsWith(`${key}.`)) {
      // When the key is a prefix of the filter, we can record it as the root source.
      // Use the most specific key for the root "." source value.
      // e.g. `targets.build` takes precedence over `targets`
      if (!rootKey || key.startsWith(rootKey)) {
        rootKey = key;
        rootSource = value;
      }
    }
  }
  if (rootSource) {
    filtered['.'] = rootSource;
  }
  return filtered;
}
