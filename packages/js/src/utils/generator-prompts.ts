import type { Tree } from '@nx/devkit';
import { promptWhenInteractive } from '@nx/devkit/internal';
import { isUsingTsSolutionSetup } from './typescript/ts-solution-setup';
import { detectLinter, type LinterType } from './linter';

export async function normalizeLinterOption(
  tree: Tree,
  linter: undefined | LinterType
): Promise<LinterType> {
  if (linter) {
    return linter;
  }

  const isTsSolutionSetup = isUsingTsSolutionSetup(tree);
  // Offer the linter the workspace already uses first, so a workspace that has
  // adopted Oxlint is not pushed back onto ESLint by the prompt's own ordering.
  const detected = detectLinter(tree);
  const others = (['eslint', 'oxlint'] as const).filter((l) => l !== detected);
  const choices = isTsSolutionSetup
    ? [
        { name: 'none' },
        { name: detected },
        ...others.map((name) => ({ name })),
      ]
    : [
        { name: detected },
        ...others.map((name) => ({ name })),
        { name: 'none' },
      ];
  const defaultValue = isTsSolutionSetup ? 'none' : detected;

  return await promptWhenInteractive<{
    linter: LinterType;
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
