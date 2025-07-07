import { Schema } from '@markdoc/markdoc';
import markdoc from '@markdoc/markdoc';
const { Tag } = markdoc;

export const steps: Schema = {
  render: 'Steps',
  attributes: {},
  transform(node, config) {
    return new Tag(this.render, {}, node.transformChildren(config));
  },
};

export const step: Schema = {
  render: 'Step',
  attributes: {
    title: {
      type: 'String',
      required: false,
    },
  },
};
