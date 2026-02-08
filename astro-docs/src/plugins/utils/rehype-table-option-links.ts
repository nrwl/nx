/**
 * Rehype plugin that adds anchor links to option names in documentation tables.
 *
 * Targets tables whose first header cell contains "Option". For each data row,
 * it extracts the option name from the first cell's `<code>` element, generates
 * an anchor slug, sets an `id` on the `<tr>`, and wraps the `<code>` in an
 * `<a>` link with the Starlight-style anchor icon.
 */

import type { Element, ElementContent, Root, Text } from 'hast';
import {
  LINK_ICON_PATH,
  optionSlug,
  TABLE_HEADERS_TO_MATCH,
} from './option-slug';

function getTextContent(node: ElementContent | Root): string {
  if (node.type === 'text') return (node as Text).value;
  if ('children' in node) {
    return (node.children as ElementContent[]).map(getTextContent).join('');
  }
  return '';
}

function isElement(node: ElementContent, tag?: string): node is Element {
  return node.type === 'element' && (!tag || node.tagName === tag);
}

function findElement(
  children: ElementContent[],
  tag: string
): Element | undefined {
  for (const child of children) {
    if (isElement(child)) {
      if (child.tagName === tag) return child;
      const found = findElement(child.children, tag);
      if (found) return found;
    }
  }
  return undefined;
}

function findAllElements(children: ElementContent[], tag: string): Element[] {
  const results: Element[] = [];
  for (const child of children) {
    if (isElement(child, tag)) results.push(child);
    if (isElement(child)) {
      results.push(...findAllElements(child.children, tag));
    }
  }
  return results;
}

function makeAnchorIcon(): Element {
  return {
    type: 'element',
    tagName: 'span',
    properties: { ariaHidden: 'true', className: ['sl-anchor-icon'] },
    children: [
      {
        type: 'element',
        tagName: 'svg',
        properties: {
          width: '16',
          height: '16',
          viewBox: '0 0 24 24',
          fill: 'currentcolor',
        },
        children: [
          {
            type: 'element',
            tagName: 'path',
            properties: { d: LINK_ICON_PATH },
            children: [],
          },
        ],
      },
    ],
  };
}

function isOptionsTable(table: Element): boolean {
  const thead = findElement(table.children as ElementContent[], 'thead');
  if (!thead) return false;
  const firstTh = findElement(thead.children as ElementContent[], 'th');
  if (!firstTh) return false;
  const text = getTextContent(firstTh).trim();
  return TABLE_HEADERS_TO_MATCH.includes(text.toLowerCase());
}

function processOptionsTable(table: Element): void {
  const tbody = findElement(table.children as ElementContent[], 'tbody');
  if (!tbody) return;

  const rows = findAllElements(tbody.children as ElementContent[], 'tr');

  for (const row of rows) {
    const cells = row.children.filter((c) => isElement(c, 'td')) as Element[];
    if (cells.length === 0) continue;

    const firstCell = cells[0];
    const codeEl = findElement(firstCell.children as ElementContent[], 'code');
    if (!codeEl) continue;

    const optionText = getTextContent(codeEl).trim();
    if (!optionText) continue;

    const slug = optionSlug(optionText);
    if (!slug) continue;

    // Set id on the row for anchor targeting
    row.properties = row.properties || {};
    row.properties.id = slug;

    // Find the index of the code element in the cell's children
    const codeIndex = firstCell.children.indexOf(codeEl);
    if (codeIndex === -1) continue;

    // Wrap the <code> element in an <a> link
    const anchorLink: Element = {
      type: 'element',
      tagName: 'a',
      properties: {
        href: `#${slug}`,
        className: ['sl-option-link'],
      },
      children: [codeEl, makeAnchorIcon()],
    };

    firstCell.children[codeIndex] = anchorLink;
  }
}

export default function rehypeTableOptionLinks() {
  return (tree: Root) => {
    const tables = findAllElements(tree.children as ElementContent[], 'table');
    for (const table of tables) {
      if (isOptionsTable(table)) {
        processOptionsTable(table);
      }
    }
  };
}
