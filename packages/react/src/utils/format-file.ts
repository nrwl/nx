import { format } from 'prettier';
import { stripIndents } from '@nx/devkit';

export function formatFile(content, ...values) {
  return format(stripIndents(content, values), {
    singleQuote: true,
    parser: 'typescript',
  });
}
