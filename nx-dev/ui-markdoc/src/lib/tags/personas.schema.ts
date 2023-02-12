import { Schema } from '@markdoc/markdoc';

export const personas: Schema = {
  render: 'Personas',
  description: 'Display multiple persons in a grid 2x2',
};
export const persona: Schema = {
  render: 'Persona',
  description: 'Display the enclosed content in a persona box',
  children: ['paragraph', 'tag', 'list'],
  attributes: {
    title: {
      type: 'String',
      description: 'The title displayed at the top of the persona callout.',
    },
    type: {
      type: 'String',
      default: 'integrated',
      required: true,
      matches: [
        'cache',
        'distribute',
        'javascript',
        'lerna',
        'react',
        'angular',
        'integrated',
      ],
      errorLevel: 'critical',
      description: 'Controls the icon of the persona.',
    },
    url: {
      type: 'String',
      required: true,
      errorLevel: 'critical',
      description: 'Link to navigate to when the card is clicked.',
    },
  },
};
