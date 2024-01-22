import { Schema } from '@markdoc/markdoc';

export const pill: Schema = {
  render: 'Pill',
  attributes: {
    url: {
      type: 'String',
      default: '',
    },
  },
};
