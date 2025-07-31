import { Schema } from '@markdoc/markdoc';

export const callout: Schema = {
  render: 'Callout',
  children: ['paragraph', 'tag', 'list'],
  attributes: {
    type: {
      type: 'String',
      default: 'note',
      matches: [
        'announcement',
        'caution',
        'check',
        'note',
        'warning',
        'deepdive',
      ],
      errorLevel: 'critical',
    },
    title: {
      type: 'String',
      required: true,
    },
    expanded: {
      type: 'Boolean',
      default: false,
    },
  },
};
