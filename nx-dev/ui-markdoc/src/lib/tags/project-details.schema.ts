import { Schema } from '@markdoc/markdoc';

export const projectDetails: Schema = {
  render: 'ProjectDetails',
  children: [],

  attributes: {
    jsonFile: {
      type: 'String',
    },
    title: {
      type: 'String',
    },
    height: {
      type: 'String',
    },
    expandedTargets: {
      type: 'Array',
    },
  },
};
