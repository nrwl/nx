import {
  formatFiles,
  joinPathFragments,
  type Tree,
  updateJson,
} from '@nx/devkit';
import { readCompilerOptionsFromTsConfig } from '../../generators/utils/tsconfig-utils';
import { allProjectTargets, allTargetOptions } from '../../utils/targets';
import { getProjectsFilteredByDependencies } from '../utils/projects';

type TsConfig = {
  compilerOptions?: {
    isolatedModules?: boolean;
  };
};

export default async function (tree: Tree) {
  const uniqueSpecTsConfigs = new Set<string>();

  const projects = await getProjectsFilteredByDependencies([
    'npm:@angular/core',
    'npm:jest-preset-angular',
  ]);

  for (const graphNode of projects) {
    const projectRoot = graphNode.data.root;

    // add tsconfig.spec.json if it exists
    const specTsConfigPath = joinPathFragments(
      projectRoot,
      'tsconfig.spec.json'
    );
    if (tree.exists(specTsConfigPath)) {
      uniqueSpecTsConfigs.add(specTsConfigPath);
    }

    // look for tsConfig in @nx/jest:jest tasks in case there are any
    // custom test tsconfig files
    for (const [, target] of allProjectTargets(graphNode.data)) {
      if (target.executor !== '@nx/jest:jest') {
        continue;
      }

      for (const [, options] of allTargetOptions<{ tsConfig?: string }>(
        target
      )) {
        if (
          typeof options?.tsConfig === 'string' &&
          tree.exists(options.tsConfig)
        ) {
          uniqueSpecTsConfigs.add(options.tsConfig);
        }
      }
    }
  }

  for (const tsConfig of uniqueSpecTsConfigs) {
    setIsolatedModules(tree, tsConfig);
  }

  await formatFiles(tree);
}

function setIsolatedModules(tree: Tree, tsConfigPath: string): void {
  const compilerOptions = readCompilerOptionsFromTsConfig(tree, tsConfigPath);

  if (compilerOptions.isolatedModules === true) {
    // already set to true
    return;
  }

  // set isolatedModules to true
  updateJson<TsConfig>(tree, tsConfigPath, (json) => {
    json.compilerOptions ??= {};
    json.compilerOptions.isolatedModules = true;
    return json;
  });
}
