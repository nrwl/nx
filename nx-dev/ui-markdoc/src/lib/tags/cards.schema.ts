import { Schema } from '@markdoc/markdoc';

export const cards: Schema = {
  render: 'Cards',
  attributes: {
    cols: {
      type: 'Number',
      required: true,
    },
    smCols: {
      type: 'Number',
      required: true,
    },
    mdCols: {
      type: 'Number',
      required: true,
    },
    lgCols: {
      type: 'Number',
      required: true,
    },
    moreLink: {
      type: 'String',
      required: false,
    },
  },
};

export const linkCard: Schema = {
  render: 'LinkCard',
  attributes: {
    title: {
      type: 'String',
      required: true,
    },
    type: {
      type: 'String',
      required: true,
    },
    icon: {
      type: 'String',
      required: false,
    },
    url: {
      type: 'String',
      default: '',
    },
    appearance: {
      type: 'String',
      default: 'default',
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
