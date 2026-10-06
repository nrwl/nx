import type { Tree } from '@nx/devkit';
import { isInteractive, selectPrompt } from '@nx/devkit/internal';
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

  // Nothing to follow, so this is a real choice. `none` is the non-interactive
  // answer, and leads the list so the interactive default matches it.
  return isInteractive()
    ? selectPrompt<LinterType>({
        message: `Which linter would you like to use?`,
        choices: [{ value: 'none' }, { value: 'eslint' }, { value: 'oxlint' }],
      })
    : 'none';
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
  const choices = (
    isTsSolutionSetup ? ['none', ...testRunners] : [...testRunners, 'none']
  ).map((value) => ({ value: value as T }));
  const defaultValue = (isTsSolutionSetup ? 'none' : testRunners[0]) as T;

  return isInteractive()
    ? selectPrompt<T>({
        message: `Which unit test runner would you like to use?`,
        choices,
      })
    : defaultValue;
}
