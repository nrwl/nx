import * as chalk from 'chalk';
import { diff } from 'jest-diff';

export function printDiff(before: string, after: string) {
  console.error(
    diff(before, after, {
      omitAnnotationLines: true,
      contextLines: 1,
      expand: false,
      aColor: chalk.red,
      bColor: chalk.green,
      patchColor: (s) => '',
    })
  );
  console.log('');
}
