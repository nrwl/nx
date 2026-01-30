import Markdoc from '@markdoc/markdoc';
import {
  LINK_ICON_PATH,
  optionSlug,
  TABLE_HEADERS_TO_MATCH,
} from '../plugins/utils/option-slug';

type MarkdocTag = InstanceType<typeof Markdoc.Tag>;

/**
 * Check if a value is a Markdoc Tag via `$$mdtype`
 * instead of `instanceof` to avoid the issue where the
 * `@markdoc/markdoc` instance loaded by this file differs from the one
 * loaded by `@astrojs/markdoc` at runtime.
 * otherwise the markdoc transform always noops for zero matches
 */
function isTag(value: unknown): value is MarkdocTag {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<string, unknown>).$$mdtype === 'Tag'
  );
}

function getTagText(tag: unknown): string {
  if (typeof tag === 'string') return tag;
  if (isTag(tag)) {
    return tag.children.map(getTagText).join('');
  }
  return '';
}

function findChildTag(
  parent: MarkdocTag,
  name: string
): MarkdocTag | undefined {
  return parent.children.find(
    (c): c is MarkdocTag => isTag(c) && c.name === name
  );
}

function makeAnchorIcon(): MarkdocTag {
  return new Markdoc.Tag(
    'span',
    { 'aria-hidden': 'true', class: 'sl-anchor-icon' },
    [
      new Markdoc.Tag(
        'svg',
        {
          width: '16',
          height: '16',
          viewBox: '0 0 24 24',
          fill: 'currentcolor',
        },
        [new Markdoc.Tag('path', { d: LINK_ICON_PATH }, [])]
      ),
    ]
  );
}

/**
 * Transform a Markdoc table node, adding anchor links to option rows.
 * Non-option/property list tables pass through unmodified.
 */
export function transformOptionsTable(
  node: Parameters<
    NonNullable<import('@markdoc/markdoc').Schema['transform']>
  >[0],
  config: Parameters<
    NonNullable<import('@markdoc/markdoc').Schema['transform']>
  >[1]
): MarkdocTag {
  const children = node.transformChildren(config);
  const table = new Markdoc.Tag(
    'table',
    node.transformAttributes(config),
    children
  );

  const thead = findChildTag(table, 'thead');
  const tbody = findChildTag(table, 'tbody');
  if (!thead || !tbody) return table;

  const headerRow = findChildTag(thead, 'tr');
  const firstTh = headerRow ? findChildTag(headerRow, 'th') : undefined;
  const headerText = firstTh ? getTagText(firstTh).trim() : '';

  // make sure the links only show up for tables that 'options'
  if (!TABLE_HEADERS_TO_MATCH.includes(headerText.toLowerCase())) return table;

  for (const row of tbody.children) {
    if (!isTag(row) || row.name !== 'tr') continue;

    const firstTd = findChildTag(row, 'td');
    if (!firstTd) continue;

    const codeTag = findChildTag(firstTd, 'code');
    if (!codeTag) continue;

    const slug = optionSlug(getTagText(codeTag).trim());
    if (!slug) continue;

    row.attributes.id = slug;

    const codeIndex = firstTd.children.indexOf(codeTag);
    firstTd.children[codeIndex] = new Markdoc.Tag(
      'a',
      { href: `#${slug}`, class: 'sl-option-link' },
      [codeTag, makeAnchorIcon()]
    );
  }

  return table;
}
