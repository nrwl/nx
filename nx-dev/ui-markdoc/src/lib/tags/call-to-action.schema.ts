import { Schema } from '@markdoc/markdoc';

export const callToAction: Schema = {
  // 'Display content in a large button.',
  render: 'CallToAction',
  attributes: {
    url: {
      // 'The url to link to',
      type: 'String',
      required: true,
    },
    title: {
      // 'Title of the call to action',
      type: 'String',
      required: true,
    },
    description: {
      // 'Description of the call to action.  Defaults to an empty string',
      type: 'String',
      required: false,
    },
    icon: {
      // 'Icon displayed to the left of the call to actions.  Defaults to the Nx icon',
      // Choose from the list in nx-dev/ui-markdoc/src/lib/icons.tsx
      type: 'String',
      required: false,
    },
    size: {
      // 'Size of the call to action.  Defaults to "sm".',
      type: 'String',
      required: false,
      default: 'sm',
      matches: ['sm', 'md', 'lg'],
    },
  },
};
