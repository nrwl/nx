import {
  joinPathFragments,
  readProjectConfiguration,
  Tree,
  updateJson,
} from '@nx/devkit';
import { getDefinedCustomConditionName } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { maybeJs } from '../../../utils/maybe-js.js';
import { NormalizedSchema } from '../../application/schema.js';

export function setupPackageJsonExportsForRemote(
  tree: Tree,
  options: NormalizedSchema
) {
  const project = readProjectConfiguration(tree, options.projectName);
  const packageJsonPath = joinPathFragments(project.root, 'package.json');

  if (!tree.exists(packageJsonPath)) {
    throw new Error(
      `package.json not found at ${packageJsonPath}. ` +
        `TypeScript solution setup requires package.json for all projects.`
    );
  }

  const exportPath = maybeJs(options, './src/remote-entry.ts');
  const customCondition = getDefinedCustomConditionName(tree);

  updateJson(tree, packageJsonPath, (json) => {
    json.exports = {
      ...json.exports,
      './Module': {
        [customCondition]: exportPath,
        types: exportPath,
        import: exportPath,
        default: exportPath,
      },
    };

    // Set types for IDE support (no main needed - this is an app, not a library)
    json.types = exportPath;

    return json;
  });
}
