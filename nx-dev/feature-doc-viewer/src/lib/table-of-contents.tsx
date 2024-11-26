import Link from 'next/link';
import { cx } from '@nx/nx-dev/ui-primitives';
import { useHeadingsObserver } from './use-headings-observer';
import { ProcessedDocument } from '@nx/nx-dev/models-document';

interface Heading {
  id: string;
  level: number;
  title: string;
  highlightColor?: 'blue' | 'yellow' | 'green' | 'red';
}

export function collectHeadings(
  node: any,
  sections: Heading[] = []
): Heading[] {
  if (node) {
    if (node.name && node.name === 'Heading') {
      function childToString(child: any) {
        if (typeof child === 'string') {
          return child;
        }
        if (child.children) {
          return child.children.map(childToString).join(' ');
        }
        return '';
      }
      const title = node.children.map(childToString).join(' ');

      if (typeof title === 'string') {
        sections.push({
          ...node.attributes,
          title,
        });
      }
    }

    if (node.children) {
      for (const child of node.children) {
        collectHeadings(child, sections);
      }
    }
  }

  return sections;
}

export function TableOfContents({
  elementRef,
  headings,
  path,
  children,
  document,
}: {
  elementRef: any;
  headings: Heading[];
  path: string;
  children: React.ReactNode;
  document: ProcessedDocument;
}): JSX.Element {
  const headingLevelTargets: number[] = [1, 2, 3]; // matching to: H1, H2, H3...
  const items = headings.filter(
    (item) => item.id && headingLevelTargets.includes(item.level)
  );

  const activeId = useHeadingsObserver(
    elementRef,
    {
      threshold: [0, 0.25, 0.5, 0.75, 1],
      root: null,
      rootMargin: '-10% 0% -45% 0%',
    },
    headings.find((i) => i.level === 1)?.title || null
  );

  return (
    <>
      <nav className="toc">
        <span className="pl-4 font-medium">On this page</span>
        {!!items.length ? (
          <ul className="mt-4 flex-col">
            {items.map((item) => {
              const href = `${path}#${item.id}`;
              return (
                <li key={item.title}>
                  <Link
                    href={href}
                    className={cx(
                      'block w-full border-l-4 border-slate-200 py-1 pl-3 transition hover:border-slate-500 dark:border-slate-700/40 dark:hover:border-slate-700',
                      {
                        'border-slate-500 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60':
                          activeId === item.id && !item.highlightColor,
                        // region Highlight Color
                        'border-blue-200 bg-blue-50 hover:border-blue-500 dark:border-blue-700/40 dark:bg-blue-800/40 dark:hover:border-blue-700':
                          item.highlightColor === 'blue' &&
                          activeId !== item.id,
                        'border-blue-500 bg-blue-100 hover:border-blue-500 dark:border-blue-700 dark:bg-blue-800/60 dark:hover:border-blue-700':
                          item.highlightColor === 'blue' &&
                          activeId === item.id,
                        'border-green-200 bg-green-50 hover:border-green-500 dark:border-green-700/40 dark:bg-green-800/40 dark:hover:border-green-700':
                          item.highlightColor === 'green' &&
                          activeId !== item.id,
                        'border-green-500 bg-green-100 hover:border-green-500 dark:border-green-700 dark:bg-green-800/60 dark:hover:border-green-700':
                          item.highlightColor === 'green' &&
                          activeId === item.id,
                        'border-yellow-200 bg-yellow-50 hover:border-yellow-500 dark:border-yellow-700/40 dark:bg-yellow-800/40 dark:hover:border-yellow-700':
                          item.highlightColor === 'yellow' &&
                          activeId !== item.id,
                        'border-yellow-500 bg-yellow-100 hover:border-yellow-500 dark:border-yellow-700 dark:bg-yellow-800/60 dark:hover:border-yellow-700':
                          item.highlightColor === 'yellow' &&
                          activeId === item.id,
                        'border-red-200 bg-red-50 hover:border-red-500 dark:border-red-700/40 dark:bg-red-800/40 dark:hover:border-red-700':
                          item.highlightColor === 'red' && activeId !== item.id,
                        'border-red-500 bg-red-100 hover:border-red-500 dark:border-red-700 dark:bg-red-800/60 dark:hover:border-red-700':
                          item.highlightColor === 'red' && activeId === item.id,
                        // endregion Highlight Color
                        'pl-6': item.level === 3,
                      }
                    )}
                    prefetch={false}
                  >
                    {item.level === 1 ? 'Overview' : item.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
      </nav>
      <div className="p-4">{children}</div>
    </>
  );
}
