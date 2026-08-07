import type { Tree } from '@nx/devkit';
import { promptWhenInteractive } from '@nx/devkit/internal';
import { isUsingTsSolutionSetup } from './typescript/ts-solution-setup';
import { detectLinters, type LinterType } from './linter';

export async function normalizeLinterOption(
  tree: Tree,
  linter: undefined | LinterType
): Promise<LinterType> {
  if (linter) {
    return linter;
  }

  // Following the workspace is not a question. When it already has a linter,
  // use it — including in a hybrid workspace, where `detectLinters` puts the
  // one being migrated *to* first. Pass `--linter` to choose something else.
  const [detected] = detectLinters(tree);
  if (detected) {
    return detected;
  }

  // Nothing to follow, so this is a real choice. `none` leads because a
  // workspace with no linter has opted out, and a skipped prompt resolves to
  // the first choice rather than to `initial`.
  return await promptWhenInteractive<{
    linter: LinterType;
  }>(
    {
      type: 'autocomplete',
      name: 'linter',
      message: `Which linter would you like to use?`,
      choices: [{ name: 'none' }, { name: 'eslint' }, { name: 'oxlint' }],
      initial: 0,
    },
    { linter: 'none' }
  ).then(({ linter }) => linter);
}

export async function normalizeUnitTestRunnerOption<
  T extends 'none' | 'jest' | 'vitest',
>(
  tree: Tree,
  unitTestRunner: undefined | T,
  testRunners: Array<'jest' | 'vitest'> = ['jest', 'vitest']
): Promise<T> {
  if (unitTestRunner) {
    return unitTestRunner;
  }

  const isTsSolutionSetup = isUsingTsSolutionSetup(tree);
  const choices = isTsSolutionSetup
    ? [{ name: 'none' }, ...testRunners.map((runner) => ({ name: runner }))]
    : [...testRunners.map((runner) => ({ name: runner })), { name: 'none' }];
  const defaultValue = (isTsSolutionSetup ? 'none' : testRunners[0]) as T;

  return await promptWhenInteractive<{
    unitTestRunner: T;
  }>(
    {
      type: 'autocomplete',
      name: 'unitTestRunner',
      message: `Which unit test runner would you like to use?`,
      choices,
      initial: 0,
    },
    { unitTestRunner: defaultValue }
  ).then(({ unitTestRunner }) => unitTestRunner);
}
