import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
  formatFiles,
  generateFiles,
  ProjectConfiguration,
  readJson,
  TargetConfiguration,
  Tree,
  updateJson,
} from '@nx/devkit';
import * as path from 'path';
import { SetupVerdaccioGeneratorSchema } from './schema';
import { isUsingTsSolutionSetup } from '../../utils/typescript/ts-solution-setup';
import { verdaccioVersion } from '../../utils/versions';
import { execSync } from 'child_process';

export async function setupVerdaccio(
  tree: Tree,
  options: SetupVerdaccioGeneratorSchema
) {
  if (!tree.exists('.verdaccio/config.yml')) {
    generateFiles(tree, path.join(__dirname, 'files'), '.verdaccio', {
      npmUplinkRegistry:
        execSync('npm config get registry', {
          windowsHide: false,
        })
          ?.toString()
          ?.trim() ?? 'https://registry.npmjs.org',
    });
  }

  const verdaccioTarget: TargetConfiguration = {
    executor: '@nx/js:verdaccio',
    options: {
      port: 4873,
      config: '.verdaccio/config.yml',
      storage: 'tmp/local-registry/storage',
    },
  };
  if (!tree.exists('project.json')) {
    const isUsingNewTsSetup = isUsingTsSolutionSetup(tree);

    const { name } = readJson(tree, 'package.json');
    updateJson(tree, 'package.json', (json) => {
      json.nx ??= { includedScripts: [] };
      if (isUsingNewTsSetup) {
        json.nx.targets ??= {};
        json.nx.targets['local-registry'] ??= verdaccioTarget;
      }
      return json;
    });
    if (!isUsingNewTsSetup) {
      addProjectConfiguration(tree, name, {
        root: '.',
        targets: {
          ['local-registry']: verdaccioTarget,
        },
      });
    }
  } else {
    // use updateJson instead of updateProjectConfiguration due to unknown project name
    updateJson(tree, 'project.json', (json: ProjectConfiguration) => {
      if (!json.targets) {
        json.targets = {};
      }
      json.targets['local-registry'] ??= verdaccioTarget;

      return json;
    });
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return addDependenciesToPackageJson(
    tree,
    {},
    { verdaccio: verdaccioVersion }
  );
}

export default setupVerdaccio;
