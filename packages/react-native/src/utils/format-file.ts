import { stripIndents } from '@nrwl/devkit';
import { format } from 'prettier';

export function formatFile(content, ...values) {
  return format(
    stripIndents(content, values)
      .split('\n')
      .map((line) => line.trim())
      .join('')
      .trim(),
    {
      singleQuote: true,
      parser: 'typescript',
    }
  );
}
