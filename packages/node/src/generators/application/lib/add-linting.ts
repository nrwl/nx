import { GeneratorCallback, joinPathFragments, Tree } from '@nx/devkit';
import { lintProjectGenerator } from '@nx/eslint';
import { isTypedLintingEnabled } from '@nx/eslint/internal';
import { NormalizedSchema } from './normalized-schema';

export async function addLintingToApplication(
  tree: Tree,
  options: NormalizedSchema
): Promise<GeneratorCallback> {
  const lintTask = await lintProjectGenerator(tree, {
    linter: options.linter,
    project: options.name,
    tsConfigPaths: [
      joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
    ],
    unitTestRunner: options.unitTestRunner,
    skipFormat: true,
    enableTypedLinting: isTypedLintingEnabled(options),
    rootProject: options.rootProject,
    addPlugin: options.addPlugin,
  });

  return lintTask;
}
