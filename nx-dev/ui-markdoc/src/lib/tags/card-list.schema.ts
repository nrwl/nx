import { Schema } from '@markdoc/markdoc';

export const cardList: Schema = {
  render: 'CardList',
  description: 'Display a list of card with link',
  attributes: {
    items: {
      type: 'String',
      required: true,
    },
  },
};
