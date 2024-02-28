import { Schema, Tag } from '@markdoc/markdoc';

export const fence: Schema = {
  render: 'FenceWrapper',
  attributes: {
    content: { type: 'String', render: false, required: true },
    language: { type: 'String' },
    fileName: { type: 'String', default: '' },
    highlightLines: { type: 'Array', default: [] },
    lineGroups: { type: 'Object', default: {} },
    command: { type: 'String', default: '' },
    path: { type: 'String', default: '~/workspace' },
    process: { type: 'Boolean', render: false, default: true },
    skipRescope: { type: 'Boolean', default: false },
    enableCopy: { type: 'Boolean', default: true },
  },
  transform(node, config) {
    const attributes = node.transformAttributes(config);
    const children = node.children.length
      ? node.transformChildren(config)
      : [node.attributes['content']];
    return new Tag('FenceWrapper', attributes, children);
  },
};
