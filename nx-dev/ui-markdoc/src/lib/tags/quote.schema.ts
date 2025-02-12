import { Schema } from '@markdoc/markdoc';

export const quote: Schema = {
  render: 'Quote',
  attributes: {
    quote: {
      type: 'String',
      required: true,
    },
    author: {
      type: 'String',
      required: true,
    },
    title: {
      type: 'String',
      required: false,
    },
    image: {
      type: 'String',
      required: false,
    },
    companyIcon: {
      type: 'String',
      required: false,
    },
  },
};
