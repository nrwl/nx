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

  // Offer the linter the workspace already uses first, so a workspace that has
  // adopted Oxlint is not pushed back onto ESLint by the prompt's own ordering.
  // An empty result means the workspace opted out of linting, so the
  // opted-out case needs no separate branch here.
  const detected = detectLinters(tree)[0] ?? 'none';
  const others = (['eslint', 'oxlint', 'none'] as const).filter(
    (l) => l !== detected
  );

  return await promptWhenInteractive<{
    linter: LinterType;
  }>(
    {
      type: 'autocomplete',
      name: 'linter',
      message: `Which linter would you like to use?`,
      choices: [{ name: detected }, ...others.map((name) => ({ name }))],
      initial: 0,
    },
    { linter: detected }
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
