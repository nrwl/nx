import { format } from 'prettier';
import { stripIndents } from '@nrwl/devkit';

export function formatFile(content, ...values) {
  return format(stripIndents(content, values), {
    singleQuote: true,
    parser: 'typescript',
  });
}
