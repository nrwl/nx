import Link from 'next/link';
import { cx } from '@nx/nx-dev/ui-primitives';
import { useHeadingsObserver } from './use-headings-observer';

interface Heading {
  id: string;
  level: number;
  title: string;
}

export function collectHeadings(
  node: any,
  sections: Heading[] = []
): Heading[] {
  if (node) {
    if (node.name && node.name === 'Heading') {
      const title = node.children[0];

      if (typeof title === 'string') {
        sections.push({
          id: node.attributes['id'],
          level: node.attributes['level'],
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
}: {
  elementRef: any;
  headings: Heading[];
  path: string;
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
                    'block w-full border-l-4 border-slate-100 py-1 pl-3 transition hover:border-slate-500 dark:border-slate-700/40 dark:hover:border-slate-700',
                    {
                      'border-slate-500 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60':
                        activeId === item.id,
                      'pl-6': item.level === 3,
                    }
                  )}
                >
                  {item.level === 1 ? 'Overview' : item.title}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </nav>
  );
}
