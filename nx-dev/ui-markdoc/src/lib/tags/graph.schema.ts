import { Schema } from '@markdoc/markdoc';

export const graph: Schema = {
  render: 'Graph',
  children: [],

  attributes: {
    type: {
      type: 'String',
      matches: ['project', 'task'],
      default: 'project',
    },
    height: {
      type: 'String',
      required: true,
    },
  },
};
