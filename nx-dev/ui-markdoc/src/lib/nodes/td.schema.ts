import { Schema } from '@markdoc/markdoc';

export const td: Schema = {
  render: 'td',
  attributes: {
    className: { type: 'String', default: 'text-center' },
  },
};
