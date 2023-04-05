import { Schema } from '@markdoc/markdoc';

export const cards: Schema = {
  render: 'Cards',
  attributes: {
    cols: {
      type: 'Number',
      description: 'The number of colums per row',
    },
  },
};

export const card: Schema = {
  render: 'Card',
  attributes: {
    title: {
      type: 'String',
      required: true,
    },
    description: {
      type: 'String',
      default: '',
    },
    type: {
      type: 'String',
      default: 'documentation',
    },
    url: {
      type: 'String',
      default: '',
    },
  },
};
export const titleCard: Schema = {
  render: 'TitleCard',
  attributes: {
    title: {
      type: 'String',
      required: true,
    },
    url: {
      type: 'String',
      required: true,
    },
  },
};
