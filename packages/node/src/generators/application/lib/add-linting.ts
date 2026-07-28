import { GeneratorCallback, joinPathFragments, Tree } from '@nx/devkit';
import { isTypedLintingEnabled } from '@nx/eslint/internal';
import { addLintingToProject } from '@nx/js';
import { NormalizedSchema } from './normalized-schema';

export async function addLintingToApplication(
  tree: Tree,
  options: NormalizedSchema
): Promise<GeneratorCallback> {
  return addLintingToProject(tree, {
    linter: options.linter,
    project: options.name,
    tsConfigPaths: [
      joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
    ],
    unitTestRunner: options.unitTestRunner,
    enableTypedLinting: isTypedLintingEnabled(options),
    rootProject: options.rootProject,
    addPlugin: options.addPlugin,
  });
}
