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

const GENERATORS = ['application', 'library', 'host', 'remote'];
const CANDIDATE_GENERATOR_COLLECTIONS = ['@nrwl/angular', '@nx/angular'];

export default async function removeKarmaDefaults(tree: Tree) {
  const nxJson = readNxJson(tree);

  if (nxJson.generators) {
    const updatedConfig = updateUnitTestRunner(nxJson.generators);

    if (updatedConfig) {
      updateNxJson(tree, nxJson);
    }
  }

  const projects = getProjects(tree);

  for (const [projectName, projectConfig] of projects) {
    if (projectConfig.generators) {
      const updatedProject = updateUnitTestRunner(projectConfig.generators);

      if (updatedProject) {
        updateProjectConfiguration(tree, projectName, projectConfig);
      }
    }
  }

  await formatFiles(tree);
}

function updateUnitTestRunner(
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
          generatorDefaults[possibleGenerator]['unitTestRunner'] &&
          generatorDefaults[possibleGenerator]['unitTestRunner'] === 'karma'
        ) {
          generatorsConfig[generatorName][possibleGenerator]['unitTestRunner'] =
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
      generatorDefaults['unitTestRunner'] &&
      generatorDefaults['unitTestRunner'] === 'karma'
    ) {
      generatorsConfig[generatorName]['unitTestRunner'] = undefined;
      updatedConfig = true;
    }
  }

  return updatedConfig;
}
