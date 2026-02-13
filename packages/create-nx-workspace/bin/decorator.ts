import { styleText } from 'node:util';

export const yargsDecorator = {
  'Options:': `${styleText('green', 'Options')}:`,
  'Examples:': `${styleText('green', 'Examples')}:`,
  boolean: `${styleText('blue', 'boolean')}`,
  count: `${styleText('blue', 'count')}`,
  string: `${styleText('blue', 'string')}`,
  array: `${styleText('blue', 'array')}`,
  required: `${styleText('blue', 'required')}`,
  'default:': `${styleText('blue', 'default')}:`,
  'choices:': `${styleText('blue', 'choices')}:`,
  'aliases:': `${styleText('blue', 'aliases')}:`,
};
