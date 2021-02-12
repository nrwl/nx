import * as prettier from 'prettier';
import { stripIndents } from '@nrwl/devkit';

export function formatFile(content, ...values) {
  return prettier.format(stripIndents(content, values), {
    singleQuote: true,
    parser: 'typescript',
  });
}
