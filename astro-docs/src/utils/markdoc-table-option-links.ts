/**
 * Markdoc table node transform that adds anchor links to option names.
 *
 * Inspects the table's first <th> for "Option"/"Options". If matched,
 * each <tbody> row gets an `id` and its first <code> is wrapped in an
 * `<a>` link with the Starlight-style chain-link icon.
 */

import Markdoc from '@markdoc/markdoc';
import { LINK_ICON_PATH, optionSlug } from '../plugins/utils/option-slug.js';

function getTagText(tag: unknown): string {
  if (typeof tag === 'string') return tag;
  if (tag instanceof Markdoc.Tag) {
    return tag.children.map(getTagText).join('');
  }
  return '';
}

function findChildTag(
  parent: InstanceType<typeof Markdoc.Tag>,
  name: string
): InstanceType<typeof Markdoc.Tag> | undefined {
  return parent.children.find(
    (c): c is InstanceType<typeof Markdoc.Tag> =>
      c instanceof Markdoc.Tag && c.name === name
  );
}

function makeAnchorIcon(): InstanceType<typeof Markdoc.Tag> {
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

const tableHeadersToMatch = ['option', 'options'];
/**
 * Transform a Markdoc table node, adding anchor links to option rows.
 * Non-option tables pass through unmodified.
 */
export function transformOptionsTable(
  node: Parameters<
    NonNullable<import('@markdoc/markdoc').Schema['transform']>
  >[0],
  config: Parameters<
    NonNullable<import('@markdoc/markdoc').Schema['transform']>
  >[1]
): InstanceType<typeof Markdoc.Tag> {
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
  if (!tableHeadersToMatch.includes(headerText.toLowerCase())) return table;

  for (const row of tbody.children) {
    if (!(row instanceof Markdoc.Tag) || row.name !== 'tr') continue;

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
