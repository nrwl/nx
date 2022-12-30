import { Schema, Tag } from '@markdoc/markdoc';

export const fence: Schema = {
  render: 'Fence',
  attributes: {
    content: { type: 'String', render: false, required: true },
    language: { type: 'String' },
    fileName: { type: 'String', default: '' },
    command: { type: 'String', default: '' },
    path: { type: 'String', default: '~/workspace' },
    process: { type: 'Boolean', render: false, default: true },
  },
  transform(node, config) {
    const attributes = node.transformAttributes(config);
    const children = node.children.length
      ? node.transformChildren(config)
      : [node.attributes['content']];
    return new Tag('Fence', attributes, children);
  },
};
