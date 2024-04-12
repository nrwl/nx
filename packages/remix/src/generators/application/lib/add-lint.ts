import {
  GeneratorCallback,
  Tree,
  ensurePackage,
  joinPathFragments,
  stripIndents,
} from '@nx/devkit';
import { type NormalizedSchema } from './normalize-options';
import { getPackageVersion } from '@nx/remix/src/utils/versions';

/** Configure eslint for the project */
export async function addLint(
  tree: Tree,
  options: NormalizedSchema
): Promise<GeneratorCallback> {
  const { lintProjectGenerator } = ensurePackage<typeof import('@nx/eslint')>(
    '@nx/eslint',
    getPackageVersion(tree, 'nx')
  );
  const eslintTask = await lintProjectGenerator(tree, {
    linter: options.linter,
    project: options.projectName,
    tsConfigPaths: [
      joinPathFragments(options.projectRoot, 'tsconfig.app.json'),
    ],
    unitTestRunner: options.unitTestRunner,
    skipFormat: true,
    rootProject: options.rootProject,
    addPlugin: options.addPlugin,
  });

  tree.write(
    joinPathFragments(options.projectRoot, '.eslintignore'),
    stripIndents`build
    public/build`
  );

  return eslintTask;
}
