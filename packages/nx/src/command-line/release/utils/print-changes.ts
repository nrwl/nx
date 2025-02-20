import * as chalk from 'chalk';
import { diff } from 'jest-diff';
import { readFileSync } from 'node:fs';
import { Tree, flushChanges } from '../../../generators/tree';
import { workspaceRoot } from '../../../utils/workspace-root';
import { joinPathFragments } from '../../../utils/path';
import { logger } from '../../../utils/logger';

// jest-diff does not export this constant
const NO_DIFF_MESSAGE = 'Compared values have no visual difference.';

export function printDiff(
  before: string,
  after: string,
  contextLines = 1,
  noDiffMessage = NO_DIFF_MESSAGE
) {
  const diffOutput = diff(before, after, {
    omitAnnotationLines: true,
    contextLines,
    expand: false,
    aColor: chalk.red,
    bColor: chalk.green,
    patchColor: (s) => '',
  });
  // It is not an exact match because of the color codes
  if (diffOutput.includes(NO_DIFF_MESSAGE)) {
    console.log(noDiffMessage);
  } else {
    console.log(diffOutput);
  }
  console.log('');
}

export function printAndFlushChanges(
  tree: Tree,
  isDryRun: boolean,
  diffContextLines = 1,
  shouldPrintDryRunMessage = true,
  noDiffMessage?: string,
  changePredicate?: (f: { path: string; content?: Buffer }) => boolean
) {
  changePredicate = changePredicate || (() => true);
  const changes = tree.listChanges();

  console.log('');

  if (changes.length === 0 && noDiffMessage) {
    console.log(noDiffMessage);
    return;
  }

  // Print the changes
  changes.filter(changePredicate).forEach((f) => {
    if (f.type === 'CREATE') {
      console.error(
        `${chalk.green('CREATE')} ${f.path}${
          isDryRun ? chalk.keyword('orange')(' [dry-run]') : ''
        }`
      );
      printDiff(
        '',
        f.content?.toString() || '',
        diffContextLines,
        noDiffMessage
      );
    } else if (f.type === 'UPDATE') {
      console.error(
        `${chalk.white('UPDATE')} ${f.path}${
          isDryRun ? chalk.keyword('orange')(' [dry-run]') : ''
        }`
      );
      const currentContentsOnDisk = readFileSync(
        joinPathFragments(tree.root, f.path)
      ).toString();
      printDiff(
        currentContentsOnDisk,
        f.content?.toString() || '',
        diffContextLines,
        noDiffMessage
      );
    } else if (f.type === 'DELETE') {
      throw new Error(
        'Unexpected DELETE change, please report this as an issue'
      );
    }
  });

  if (!isDryRun) {
    flushChanges(workspaceRoot, changes);
  }

  if (isDryRun && shouldPrintDryRunMessage) {
    logger.warn(`\nNOTE: The "dryRun" flag means no changes were made.`);
  }
}
