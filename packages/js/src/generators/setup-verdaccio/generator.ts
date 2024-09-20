import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
  formatFiles,
  generateFiles,
  ProjectConfiguration,
  readJson,
  readNxJson,
  TargetConfiguration,
  Tree,
  updateJson,
} from '@nx/devkit';
import * as path from 'path';
import { SetupVerdaccioGeneratorSchema } from './schema';
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
          windowsHide: true,
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
  if (isUsingTypeScriptPlugin(tree)) {
    updateJson(tree, 'package.json', (json) => {
      json.nx ??= {};
      json.nx.includedScripts ??= [];
      json.nx.targets ??= {};
      json.nx.targets['local-registry'] ??= verdaccioTarget;
      return json;
    });
  } else if (!tree.exists('project.json')) {
    const { name } = readJson(tree, 'package.json');
    updateJson(tree, 'package.json', (json) => {
      if (!json.nx) {
        json.nx = {
          includedScripts: [],
        };
      }
      return json;
    });
    addProjectConfiguration(tree, name, {
      root: '.',
      targets: {
        ['local-registry']: verdaccioTarget,
      },
    });
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

function isUsingTypeScriptPlugin(tree: Tree) {
  const nxJson = readNxJson(tree);

  const addPlugin =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;
  const addTsPlugin = addPlugin && process.env.NX_ADD_TS_PLUGIN === 'true';
  // is going to be added or it's already there
  const hasPlugin =
    addTsPlugin ||
    nxJson.plugins?.some((p) =>
      typeof p === 'string'
        ? p === '@nx/js/typescript'
        : p.plugin === '@nx/js/typescript'
    );

  return hasPlugin;
}
