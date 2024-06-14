// @ts-ignore
import SyntaxHighlighter, { createElement } from 'react-syntax-highlighter';
import { JSX, ReactNode, useMemo } from 'react';
import { twMerge } from 'tailwind-merge';
import { CopyToClipboardButton } from '@nx/graph/ui-components';

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
  copyTooltipText: string;
}

export function JsonCodeBlock(props: JsonCodeBlockProps): JSX.Element {
  const jsonString = useMemo(
    () => JSON.stringify(props.data, null, 2),
    [props.data]
  );
  return (
    <div className="code-block group relative w-full">
      <div className="absolute right-0 top-0 z-10 flex">
        <CopyToClipboardButton
          text={jsonString}
          tooltipAlignment="right"
          tooltipText={props.copyTooltipText}
          className={twMerge(
            'not-prose flex',
            'border border-slate-200 bg-slate-50/50 p-2 dark:border-slate-700 dark:bg-slate-800/60',
            'opacity-0 transition-opacity group-hover:opacity-100'
          )}
        />
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
