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

export default async function removeLibraryGeneratorSimpleModuleNameOption(
  tree: Tree
): Promise<void> {
  const nxJson = readNxJson(tree);

  // update global config
  const nxJsonUpdated = replaceSimpleModuleNameInConfig(nxJson);
  if (nxJsonUpdated) {
    updateNxJson(tree, nxJson);
  }

  // update project configs
  const projects = getProjects(tree);
  for (const [name, project] of projects) {
    const projectUpdated = replaceSimpleModuleNameInConfig(project);
    if (projectUpdated) {
      updateProjectConfiguration(tree, name, project);
    }
  }

  await formatFiles(tree);
}

function replaceSimpleModuleNameInConfig(
  configObject: {
    generators?:
      | NxJsonConfiguration['generators']
      | ProjectConfiguration['generators'];
  } | null
): boolean {
  if (!configObject?.generators) {
    return false;
  }

  let updated = false;

  if (configObject.generators['@nrwl/angular']?.['library']?.simpleModuleName) {
    configObject.generators['@nrwl/angular']['library'].simpleName ??=
      configObject.generators['@nrwl/angular']['library'].simpleModuleName;
    delete configObject.generators['@nrwl/angular']['library'].simpleModuleName;
    updated = true;
  } else if (
    configObject.generators['@nrwl/angular:library']?.simpleModuleName
  ) {
    configObject.generators['@nrwl/angular:library'].simpleName ??=
      configObject.generators['@nrwl/angular:library'].simpleModuleName;
    delete configObject.generators['@nrwl/angular:library'].simpleModuleName;
    updated = true;
  }

  return updated;
}
