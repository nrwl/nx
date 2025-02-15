import { Schema } from '@markdoc/markdoc';

export interface Metric {
  value: string;
  label: string;
}

export const metrics: Schema = {
  render: 'Metrics',
  attributes: {
    metrics: {
      type: 'Array',
      required: true,
    },
  },
};
