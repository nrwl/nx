import { RenderableTreeNode, Schema, Tag } from '@markdoc/markdoc';

export function generateID(
  children: RenderableTreeNode[],
  attributes: Record<string, any>
) {
  if (attributes['id'] && typeof attributes['id'] === 'string') {
    return attributes['id'];
  }
  return children
    .filter((child) => typeof child === 'string')
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
