import { Schema } from '@markdoc/markdoc';

export const tableOfContents: Schema = {
  render: 'TableOfContents',
  attributes: {
    maxDepth: {
      type: 'Number',
      default: 3,
    },
  },
};
