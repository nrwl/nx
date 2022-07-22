import { Schema, Tag } from '@markdoc/markdoc';

export const tabs: Schema = {
  render: 'Tabs',
  attributes: {},
  transform(node, config) {
    const labels = node
      .transformChildren(config)
      .filter((child) => child && child.name === 'Tab')
      .map((tab) => (typeof tab === 'object' ? tab.attributes.label : null));

    return new Tag(this.render, { labels }, node.transformChildren(config));
  },
};

export const tab: Schema = {
  render: 'Tab',
  attributes: {
    label: {
      type: 'String',
    },
  },
};
