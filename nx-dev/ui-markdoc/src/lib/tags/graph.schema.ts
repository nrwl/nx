import { Schema } from '@markdoc/markdoc';

export const graph: Schema = {
  render: 'Graph',
  children: [],

  attributes: {
    height: {
      type: 'String',
      required: true,
    },
  },
};
