import type {
  NxJsonConfiguration,
  ProjectConfiguration,
  Tree,
} from '@nx/devkit';
import {
  formatFiles,
  getProjects,
  readNxJson,
  updateNxJson,
  updateProjectConfiguration,
} from '@nx/devkit';

const GENERATORS = ['application', 'host', 'remote'];
const CANDIDATE_GENERATOR_COLLECTIONS = ['@nrwl/angular', '@nx/angular'];

export default async function removeProtractorDefaults(tree: Tree) {
  const nxJson = readNxJson(tree);

  if (nxJson.generators) {
    const updatedConfig = updateE2ETestRunner(nxJson.generators);

    if (updatedConfig) {
      updateNxJson(tree, nxJson);
    }
  }

  const projects = getProjects(tree);

  for (const [projectName, projectConfig] of projects) {
    if (projectConfig.generators) {
      const updatedProject = updateE2ETestRunner(projectConfig.generators);

      if (updatedProject) {
        updateProjectConfiguration(tree, projectName, projectConfig);
      }
    }
  }

  await formatFiles(tree);
}

function updateE2ETestRunner(
  generatorsConfig:
    | NxJsonConfiguration['generators']
    | ProjectConfiguration['generators']
) {
  const generators = Object.entries(generatorsConfig);

  let updatedConfig = false;
  for (const [generatorName, generatorDefaults] of generators) {
    if (CANDIDATE_GENERATOR_COLLECTIONS.includes(generatorName)) {
      for (const possibleGenerator of GENERATORS) {
        if (
          generatorDefaults[possibleGenerator] &&
          generatorDefaults[possibleGenerator]['e2eTestRunner'] &&
          generatorDefaults[possibleGenerator]['e2eTestRunner'] === 'protractor'
        ) {
          generatorsConfig[generatorName][possibleGenerator]['e2eTestRunner'] =
            undefined;
          updatedConfig = true;
        }
      }
    }

    if (
      !GENERATORS.map((v) => `@nrwl/angular:${v}`).includes(generatorName) &&
      !GENERATORS.map((v) => `@nx/angular:${v}`).includes(generatorName)
    ) {
      continue;
    }

    if (
      generatorDefaults['e2eTestRunner'] &&
      generatorDefaults['e2eTestRunner'] === 'protractor'
    ) {
      generatorsConfig[generatorName]['e2eTestRunner'] = undefined;
      updatedConfig = true;
    }
  }

  return updatedConfig;
}
