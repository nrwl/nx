import {
  formatFiles,
  installPackagesTask,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';
import { CypressExecutorOptions } from '../../executors/cypress/cypress.impl';
import { cypressVersion } from '../../utils/versions';
import { updateProject } from './conversion.util';
import { CypressConvertOptions } from './schema';

function normalizeOptions(
  options: CypressConvertOptions
): CypressConvertOptions {
  // ignore project as that will always be the default project if not provided
  options.targets = options.targets || ['e2e'];
  if (options.all) {
    return {
      all: true,
      project: undefined,
      targets: options.targets,
    };
  }

  if (!options.project && !options.all) {
    throw new Error(
      'Missing project to convert. Specify --project OR --all to convert all e2e projects'
    );
  }

  return options;
}

export async function convertCypressProject(
  tree: Tree,
  options: CypressConvertOptions
) {
  options = normalizeOptions(options);
  let didConvert: boolean;
  if (options.all) {
    let projectConversionStatus = [];
    forEachExecutorOptions(
      tree,
      '@nrwl/cypress:cypress',
      (currentValue: CypressExecutorOptions, project) => {
        const status = updateProject(tree, {
          ...options,
          project,
        });
        projectConversionStatus.push(status);
      }
    );

    // if any projects were converted, update the version
    didConvert = projectConversionStatus.some((status) => status);
  } else {
    didConvert = updateProject(tree, options);
  }

  if (didConvert) {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies['cypress'] = cypressVersion;
      return json;
    });
  }

  await formatFiles(tree);
  return () => {
    installPackagesTask(tree);
  };
}

export default convertCypressProject;
