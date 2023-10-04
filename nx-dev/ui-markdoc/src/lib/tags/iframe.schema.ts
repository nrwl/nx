import { Schema } from '@markdoc/markdoc';

export const iframe: Schema = {
  render: 'Iframe',
  attributes: {
    src: {
      type: 'String',
      required: true,
    },
    title: {
      type: 'String',
      required: true,
    },
    width: {
      type: 'String',
      default: '50%',
    },
  },
};
