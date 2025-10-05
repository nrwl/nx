import type { Tree } from '@nx/devkit';
import { promptWhenInteractive } from '@nx/devkit/src/generators/prompt';
import { isUsingTsSolutionSetup } from './typescript/ts-solution-setup';

export async function normalizeLinterOption(
  tree: Tree,
  linter: undefined | 'none' | 'eslint'
): Promise<'none' | 'eslint'> {
  if (linter) {
    return linter;
  }

  const isTsSolutionSetup = isUsingTsSolutionSetup(tree);
  const choices = isTsSolutionSetup
    ? [{ name: 'none' }, { name: 'eslint' }]
    : [{ name: 'eslint' }, { name: 'none' }];
  const defaultValue = isTsSolutionSetup ? 'none' : 'eslint';

  return await promptWhenInteractive<{
    linter: 'none' | 'eslint';
  }>(
    {
      type: 'autocomplete',
      name: 'linter',
      message: `Which linter would you like to use?`,
      choices,
      initial: 0,
    },
    { linter: defaultValue }
  ).then(({ linter }) => linter);
}

export async function normalizeUnitTestRunnerOption<
  T extends 'none' | 'jest' | 'vitest'
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
