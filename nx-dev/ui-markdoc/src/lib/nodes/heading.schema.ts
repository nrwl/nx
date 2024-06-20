import { RenderableTreeNode, Schema, Tag } from '@markdoc/markdoc';

export function generateID(
  children: RenderableTreeNode[],
  attributes: Record<string, any>
) {
  if (attributes['id'] && typeof attributes['id'] === 'string') {
    return attributes['id'];
  }

  const validChildrenNodes: RenderableTreeNode[] = [];

  for (const child of children) {
    if (!child) {
      continue;
    }

    if (typeof child === 'string') {
      validChildrenNodes.push(child);
    } else if (
      // allow rendering titles that are wrapped in `code` tags
      typeof child === 'object' &&
      'children' in child &&
      child.name === 'code' &&
      Array.isArray(child.children)
    ) {
      const validNestedChild = child.children.filter(
        (c) => typeof c === 'string'
      );
      validChildrenNodes.push(...validNestedChild);
    }
  }

  return validChildrenNodes
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export const heading: Schema = {
  render: 'Heading',
  children: ['inline'],
  attributes: {
    id: { type: 'String' },
    level: { type: 'Number', required: true, default: 1 },
    className: { type: 'String' },
  },
  transform(node, config) {
    const attributes = node.transformAttributes(config);
    const children = node.transformChildren(config);
    const id = generateID(children, attributes);

    return new Tag(
      this.render,
      // `h${node.attributes['level']}`,
      { ...attributes, id },
      children
    );
  },
};
