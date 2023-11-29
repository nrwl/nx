import { Schema } from '@markdoc/markdoc';

export const disclosure: Schema = {
  render: 'Disclosure',
  description: 'Display the enclosed content in a collapsible box',
  children: ['paragraph', 'tag', 'list'],
  attributes: {
    title: {
      type: 'String',
      required: true,
      description: 'The title displayed at the top of the collapsible box',
    },
  },
};
