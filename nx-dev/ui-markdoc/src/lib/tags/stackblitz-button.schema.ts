import { Schema } from '@markdoc/markdoc';

export const stackblitzButton: Schema = {
  render: 'StackblitzButton',
  description: 'Renders a button to open a given repository in Stackblitz',
  attributes: {
    url: {
      type: 'String',
      required: true,
      description: 'The url of the GitHub repository to open in Stackblitz',
    },
    title: {
      type: 'String',
      required: false,
      description:
        'An optional title to display on the button; "Open in Stackblitz" by default',
    },
  },
};
