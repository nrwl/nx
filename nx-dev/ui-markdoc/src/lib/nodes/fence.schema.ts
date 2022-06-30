import { Schema } from '@markdoc/markdoc';

export const fence: Schema = {
  render: 'Fence',
  attributes: {
    text: { type: 'String', required: true },
    language: { type: 'String' },
  },
};
